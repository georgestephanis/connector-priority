# Gutenberg Plugin Compatibility — Connectors Page

> **Validity snapshot**
> This document was written on **2026-05-22** against:
> - WordPress core **7.1-alpha-62409** (trunk)
> - Gutenberg plugin **23.2.2**
>
> Before acting on any detail here, compare the file modification dates of
> `wp-includes/build/pages/options-connectors/page-wp-admin.php` and
> `wp-content/plugins/gutenberg/build/pages/options-connectors/page-wp-admin.php`
> against the date above.  If either has changed after 2026-05-22, re-read
> those files and update this document before relying on it.

This document describes the differences between the WordPress core (trunk)
implementation of the Settings > Connectors page and the Gutenberg plugin's
parallel implementation, and explains how to account for both when extending
the page.

## Background

WordPress 7.0 introduced Settings > Connectors as a Boot-module SPA.  When the
Gutenberg plugin is active it ships its own version of that SPA — complete
build, separate PHP files, separate globals — and registers a separate admin
menu page at `admin.php?page=options-connectors-wp-admin`.  The two
implementations fire the **same PHP action hooks** but maintain **separate
internal state**, so code that only calls core's registration functions will be
silently ignored when Gutenberg is active.

## Entry points

| Variant | URL | Who provides it |
|---------|-----|-----------------|
| Core wp-admin file | `/wp-admin/options-connectors.php` | WordPress core |
| Gutenberg menu page | `admin.php?page=options-connectors-wp-admin` | Gutenberg plugin |
| Standalone renderer | `admin.php?page=options-connectors` | Both (each has its own `page.php`) |

Both the core file and the Gutenberg menu page render identically and fire
`options-connectors-wp-admin_init`.  The standalone renderer fires
`options-connectors_init`.

## Shared hooks (safe to use)

Both implementations fire the same init actions so `add_action` callbacks on
these hooks run in both environments:

| Action | Fired by |
|--------|----------|
| `options-connectors-wp-admin_init` | Core `page-wp-admin.php` AND Gutenberg `page-wp-admin.php` |
| `options-connectors_init` | Core `page.php` AND Gutenberg `page.php` |

These are the correct places to call `wp_register_script_module()`,
`wp_enqueue_style()`, `wp_enqueue_script()`, and to register routes.

## Where the implementations diverge

### 1. Route registry globals and functions

This is the critical difference.  Each implementation maintains its own
in-memory route list in a separate PHP global:

| | Core | Gutenberg plugin |
|-|------|-----------------|
| Registration function | `wp_register_options_connectors_wp_admin_route()` | `gutenberg_register_options_connectors_wp_admin_route()` |
| Getter function | `wp_get_options_connectors_wp_admin_routes()` | `gutenberg_get_options_connectors_wp_admin_routes()` |
| Global variable | `$wp_options_connectors_wp_admin_routes` | `$gutenberg_options_connectors_wp_admin_routes` |

The enqueue function calls `do_action('options-connectors-wp-admin_init')` and
**then** reads from its own getter.  Because the getters read different globals,
calling `wp_register_options_connectors_wp_admin_route()` inside an
`options-connectors-wp-admin_init` callback will register the route in core's
global — but when Gutenberg is active, Gutenberg's getter reads its own global
and the route is silently missing.

The same split applies to the standalone path:

| | Core | Gutenberg plugin |
|-|------|-----------------|
| Registration function | `wp_register_options_connectors_route()` | `gutenberg_register_options_connectors_route()` |
| Getter function | `wp_get_options_connectors_routes()` | `gutenberg_get_options_connectors_routes()` |
| Global variable | `$wp_options_connectors_routes` | `$gutenberg_options_connectors_routes` |

### 2. Boot module asset path

The two builds bundle `@wordpress/boot` from different locations:

| | Path to `index.min.asset.php` |
|-|-------------------------------|
| Core | `ABSPATH . WPINC . '/js/dist/script-modules/boot/index.min.asset.php'` |
| Gutenberg | `{gutenberg-build}/modules/boot/index.min.asset.php` |

This only matters if you are reading that file directly (unusual); route
registration via the API is unaffected.

### 3. Boot dependency filter

Gutenberg's `page-wp-admin.php` exposes a filter for adding extra script-module
dependencies **after** routes are collected:

```php
apply_filters( 'options-connectors-wp-admin_boot_dependencies', $boot_dependencies )
```

Core's `page-wp-admin.php` does **not** have this filter.

Gutenberg's `page.php` (standalone) exposes:

```php
apply_filters( 'options-connectors_boot_dependencies', $boot_dependencies )
```

Core's standalone `page.php` does **not** have this filter either.

These filters are a secondary hook point.  The primary approach (route
registration via the init action) is preferred; see §4 below.

### 4. `initSinglePage` call style (JS)

Both implementations call `initSinglePage` from `@wordpress/boot`, but the
inline script differs slightly:

**Core** wraps the import in a `DOMContentLoaded` guard to avoid a race with
classic script dependencies:

```js
( ( mountId, routes ) => {
    const run = async () => {
        const mod = await import( '@wordpress/boot' );
        mod.initSinglePage( { mountId, routes } );
    };
    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', run );
    } else {
        run();
    }
} )( mountId, routes );
```

**Gutenberg** uses a simple promise chain:

```js
import('@wordpress/boot').then(mod => mod.initSinglePage({ mountId, routes }));
```

This is an internal detail; plugin code does not call `initSinglePage` directly.

### 5. Route content CSS class names and DOM structure (JS targeting)

Gutenberg overrides the `wp/routes/connectors-home/content` script module by
calling `wp_deregister_script_module()` on it before registering its own
version.  This means **when Gutenberg is active, Gutenberg's content build is
loaded on every entry point** — including the core direct-file entry point
`/wp-admin/options-connectors.php`.

Gutenberg's content build uses **CSS Modules**, which hashes every class name
at compile time.  The classes observed in the DOM (verified 2026-05-22):

```
_956b6df0898efed0__page           (the page root)
_0625b55e82a0d93d__header         (the sticky header bar, flex column)
a43c44d5ae28b2e8__header-content  (flex row inside header, space-between)
_19ce0419607e1896__stack          (generic Stack component class)
_8113be94e7caf73c__header-title   (h1 wrapper)
```

These hashes change with Gutenberg releases and cannot be hardcoded.

**The header-actions element is absent from the DOM when there are no
built-in actions.**  Gutenberg's `HStack` component does not render a DOM node
when its `children` prop is `undefined`, so `admin-ui-page__header-actions` (or
its hashed equivalent) simply does not exist on the connectors home page.
Targeting it with any selector will always return `null`.

**Actual DOM hierarchy around the page title:**

```
.boot-layout__stage                          ← Boot module, stable, unhashed
└── ._956b6df0898efed0__page
    └── ._0625b55e82a0d93d__header           (flex column)
        └── .a43c44d5ae28b2e8__header-content (flex row, space-between)  ← inject here
            └── ._19ce0419607e1896__stack     (title stack)
                └── h1                        ← querySelector('h1') lands here
```

**Safe injection pattern:** Navigate structurally from the `h1` rather than
relying on class names.  The `h1` is always two levels below the header-content
flex row.  Appending to that row with `margin-left: auto` places the element at
the right end regardless of `justify-content`:

```js
const stage = document.querySelector( '.boot-layout__stage' );
const h1    = stage && stage.querySelector( 'h1' );
const row   = h1 && h1.parentElement && h1.parentElement.parentElement;
if ( row && ! row.querySelector( '.my-button' ) ) {
    const btn = document.createElement( 'a' );
    btn.className    = 'my-button button';
    btn.style.marginLeft = 'auto';
    btn.textContent  = 'My Action';
    row.appendChild( btn );
}
```

`.boot-layout__stage` is provided by the Boot module itself (not by route
content) and is unhashed in both core and Gutenberg builds — it is the correct
stable anchor for all DOM traversal.

### 6. Preload fields

The REST preload path includes slightly different `_fields` values.  Core
includes additional image-related fields (`image_output_formats`,
`jpeg_interlaced`, `png_interlaced`, `gif_interlaced`) that Gutenberg's version
omits.  This affects `wp.data` cache warming only and is not relevant to route
or script-module registration.

## How to account for both when building

### Registering a wp-admin route

Detect which function is available at the time the init action fires and pass
the correct one to your shared helper:

```php
add_action(
    'options-connectors-wp-admin_init',
    static function () {
        $register = function_exists( 'gutenberg_register_options_connectors_wp_admin_route' )
            ? 'gutenberg_register_options_connectors_wp_admin_route'
            : 'wp_register_options_connectors_wp_admin_route';
        my_plugin_init( $register );
    }
);
```

### Registering a standalone route

The same pattern applies to the standalone path:

```php
add_action(
    'options-connectors_init',
    static function () {
        $register = function_exists( 'gutenberg_register_options_connectors_route' )
            ? 'gutenberg_register_options_connectors_route'
            : 'wp_register_options_connectors_route';
        my_plugin_init( $register );
    }
);
```

### Shared helper pattern

A shared helper receiving the registrar callable keeps the duplication minimal:

```php
function my_plugin_init( callable $register_route ): void {
    wp_register_script_module( 'my-plugin', plugin_dir_url( __FILE__ ) . 'build/content.js', [], '1.0.0' );
    call_user_func( $register_route, '/my-route', 'my-plugin', null );
    wp_enqueue_style( 'my-plugin', plugin_dir_url( __FILE__ ) . 'build/content.css', [], '1.0.0' );
}
```

### Detecting Gutenberg at runtime

If you need to branch on Gutenberg's presence outside of a route registration
context, test for a Gutenberg-prefixed function:

```php
$gutenberg_active = function_exists( 'gutenberg_register_options_connectors_wp_admin_route' );
```

Do not rely on `is_plugin_active( 'gutenberg/gutenberg.php' )` — the plugin
file path may change between releases and that function requires
`plugin.php` to be loaded.

## Summary table

| Concern | Core | Gutenberg | Shared? |
|---------|------|-----------|---------|
| Init action | `options-connectors-wp-admin_init` | `options-connectors-wp-admin_init` | Yes |
| Route registration fn | `wp_register_options_connectors_wp_admin_route` | `gutenberg_register_options_connectors_wp_admin_route` | No |
| Boot dep filter (wp-admin) | — | `options-connectors-wp-admin_boot_dependencies` | No |
| Boot dep filter (standalone) | — | `options-connectors_boot_dependencies` | No |
| `script_module_data_*` filters | Yes | Yes | Yes |
| `admin_enqueue_scripts` fires | Yes | Yes | Yes |
| `admin_init` intercept (standalone) | Yes | Yes | Yes |
| Route content CSS class names | Global (`admin-ui-page__*`) | CSS Modules hashed | No — navigate from `h1` structurally |
| Header-actions DOM element | Always rendered | Absent when no built-in actions | No — do not target it |
| `.boot-layout__stage` class (boot module) | Global | Global | Yes — use as DOM anchor |
