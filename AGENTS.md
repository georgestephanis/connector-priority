# AI Instructions — connector-priority plugin

## Plugin purpose

`connector-priority` adds drag-and-drop priority ordering for AI connectors on
the WordPress 7.0+ Settings > Connectors screen. Refer to [README.md](README.md)
for a user-facing overview and [CORE-CHANGES.md](CORE-CHANGES.md) for upstream
change proposals.

## File map

| File | Role |
|------|------|
| `connector-priority.php` | Main plugin file. PHP hooks, public API, route registration. Serves assets from `build/`. |
| `src/priority-content.js` | Source ES module. Exports `stage` — the React drag-and-drop component rendered at the `/priority` SPA route. Bundled by webpack (includes dnd-kit); React/ReactDOM are externalised to `window.React`/`window.ReactDOM`. Output as a native ES module. |
| `src/connector-priority-nav.js` | Source ES module. Uses `MutationObserver` to inject a "Set AI Priority Order" button inline with the page title on the right. Locates the flex row containing the title by walking `h1 → parentElement → parentElement` inside `.boot-layout__stage`; appends the button with `margin-left:auto`. Also strips `?p=/` from the URL via `history.replaceState` when the SPA navigates back to the root route. Compiled and minified by webpack into `build/`. |
| `src/priority-content.css` | Source stylesheet for the priority UI. Copied verbatim to `build/`. |
| `build/` | Compiled output committed to git. Ready to serve — no build step needed to use the plugin. |
| `webpack.config.js` | Extends `@wordpress/scripts` defaults: bundles both JS entries as native ES modules (`experiments.outputModule: true`, `library: { type: 'module' }`). React/ReactDOM externalised to WP globals (`externalsType: 'global'`). Copies CSS unchanged via CopyPlugin. |
| `assets/` | Plugin directory and README images: `icon.svg`, `icon-128x128.png`, `icon-256x256.png`, `banner.svg`, `banner-772x250.png`, `banner-1544x500.png`. |
| `DESIGN_SYSTEM.md` | Visual design spec: color tokens, typography, spacing, component rules. Read this before touching any CSS or adding new UI. |
| `GUTENBERG-COMPAT.md` | Diff between core and Gutenberg plugin implementations of the connectors page. Read before touching route registration or the init callbacks. Includes the versions it was written against so you can tell if it's stale. |
| `CORE-CHANGES.md` | Proposed upstream WordPress core patches for full priority enforcement. |
| `README.md` | User-facing documentation and development workflow. |
| `readme.txt` | WordPress.org plugin directory readme. |

## Key constraints

- **Build required before testing.** Run `npm run build` to populate `build/`
  from `src/`. The `build/` directory is committed to git so the plugin is
  immediately usable without a local build step (e.g. via `git:directory` in
  Playground), but always rebuild after editing source files.

- **Both built files are native ES modules.** `priority-content.js` and
  `connector-priority-nav.js` are output with `experiments.outputModule: true`
  so WordPress's Script Module system loads them as `type="module"`. dnd-kit is
  bundled into `priority-content.js`; React and ReactDOM are externalised to
  `window.React` / `window.ReactDOM`. The named `export { stage }` from
  `priority-content.js` must survive — do not remove `library: { type: 'module' }`
  from the webpack config. Use `window.wp.*` globals for all WordPress core APIs
  (element, i18n, apiFetch).

- **No core file edits.** All functionality is implemented via WordPress hooks
  (`add_action`, `add_filter`). Core changes belong in `CORE-CHANGES.md` as
  proposals, not in code.

- **WordPress 7.0+ only.** The plugin depends on:
  - `WP_Connector_Registry` / `wp_get_connectors()`
  - `wp_register_options_connectors_wp_admin_route()`
  - `options-connectors-wp-admin_init` action
  - `script_module_data_*` filter system
  - The Boot module SPA (`?p=` path-param routing via `createPathHistory`)

## Data flow

```
PHP: register_setting('wp_connector_priority_order')
  ↓
REST POST /wp/v2/settings  ← priority-content.js (save button)
  ↓
get_option('wp_connector_priority_order')
  ↓
wp_get_connector_priority_order()          ← PHP API for other plugins
wp_get_preferred_ai_connector()            ← PHP API for other plugins
  ↓
script_module_data_connector-priority      ← populates JSON tag read by JS
script_module_data_options-connectors-wp-admin  ← adds connectorPriorityOrder
                                               ← reorders data['connectors'] by priority
  ↓
wpai_preferred_text_models   \
wpai_preferred_image_models   ├── ai plugin filters (partial workaround)
wpai_preferred_vision_models /    reorders [provider,model] pairs by priority
```

The three `wpai_preferred_*` filters affect all `ai` plugin features that route
through `Abstract_Ability::set_provider_model_preference()`.  They do **not**
affect code that calls `wp_ai_client_prompt()` directly — that requires the core
changes described in [CORE-CHANGES.md](CORE-CHANGES.md) §1–2.

## How routing works

The connectors SPA uses the Boot module's `createPathHistory()`, which reads the
current route from the `p` URL search parameter (e.g. `?p=/priority`). There are
three entry points across two code paths:

### Entry points

| Who registers it | URL | How detected | Init action fired |
|------------------|-----|--------------|-------------------|
| **WordPress core** | `/wp-admin/options-connectors.php` | `$screen->id === 'options-connectors'` (set by `admin.php` bootstrap) | `options-connectors-wp-admin_init` |
| **Gutenberg plugin** | `/wp-admin/admin.php?page=options-connectors-wp-admin` | `$_GET['page'] === 'options-connectors-wp-admin'` | `options-connectors-wp-admin_init` |
| **Standalone renderer** | `/wp-admin/admin.php?page=options-connectors` | intercepted at `admin_init` by `page.php` | `options-connectors_init` |

**WordPress core** ships `wp-admin/options-connectors.php` — a classic wp-admin
file that loads `admin.php` (so the full admin chrome is present), then calls
`wp_options_connectors_wp_admin_render_page()`. This is what users see when
Gutenberg is **not** active.

**Gutenberg plugin** registers a separate admin menu page at the slug
`options-connectors-wp-admin`, which also calls
`wp_options_connectors_wp_admin_render_page()`. Because it uses a different slug,
the URL changes to `admin.php?page=options-connectors-wp-admin`. Both the core
file and the Gutenberg menu page render identically and fire the same
`options-connectors-wp-admin_init` action — they are the same code path,
different entry point.

**Standalone renderer** (`page.php`) intercepts `admin_init` for
`?page=options-connectors` and calls `wp_options_connectors_render_page()`, which
outputs a full standalone HTML page (no wp-admin chrome) and fires
`options-connectors_init`. `admin_enqueue_scripts` never fires here — all assets
for this path must be enqueued inside `options-connectors_init`.

### Route registrars

| Init action | Route registrar function |
|-------------|--------------------------|
| `options-connectors-wp-admin_init` | `wp_register_options_connectors_wp_admin_route()` |
| `options-connectors_init` | `wp_register_options_connectors_route()` |

The shared helper `_connector_priority_init( callable $register_route )` in
`connector-priority.php` handles script module registration, route registration,
and asset enqueueing for both paths. Each init action calls it with the
appropriate registrar.

> **Gutenberg compatibility:** When the Gutenberg plugin is active it shadows
> core's route registry under a `gutenberg_` prefix with a completely separate
> global, so the `options-connectors-wp-admin_init` callback detects at runtime
> which registration function exists and passes the correct one to
> `_connector_priority_init`. See [GUTENBERG-COMPAT.md](GUTENBERG-COMPAT.md)
> for the full diff between the two implementations.

All three entry points mount the Boot module and render content inside
`.boot-layout__stage`.

## Testing checklist

- [ ] Activate plugin; visit Settings > Connectors — "Set AI Priority Order"
      button appears inline with the "Connectors" page title on the right.
- [ ] Click button; page navigates to `?p=/priority` and shows the priority UI.
- [ ] Navigate back (back link or browser back); URL returns to the connectors
      page with no `?p=` parameter — `?p=%2F` must not appear in the address bar.
- [ ] All registered AI providers appear in the list with name, logo (if any),
      and Connected/Not connected badge.
- [ ] Drag a row to a new position; ranking numbers update.
- [ ] Drag the first (blue) item to another position — the newly promoted item
      animates white → blue and the demoted item animates blue → white (~0.5 s).
- [ ] Click "Save Priority Order"; a "✓ Saved!" confirmation appears briefly.
- [ ] Reload page; the saved order persists.
- [ ] `wp_get_connector_priority_order()` returns the saved order (padded with
      any unordered connectors at the end).
- [ ] Return to Settings > Connectors; the main connector list shows AI providers
      in the saved priority order (highest-priority first).
- [ ] Deactivate plugin; Settings > Connectors returns to normal.

## Known limitations

The saved priority order is **partially** honoured at runtime:

- **Connectors screen UI**: AI connectors are now delivered to the JavaScript in
  priority order via `_connector_priority_reorder()` on the
  `script_module_data_options-connectors-wp-admin` /
  `script_module_data_options-connectors` filters — fully working today.
- **`ai` plugin features** (anything using `Abstract_Ability::set_provider_model_preference()`):
  priority is applied today via the `wpai_preferred_text_models`,
  `wpai_preferred_image_models`, and `wpai_preferred_vision_models` filters.
- **Direct `wp_ai_client_prompt()` callers**: priority is NOT applied — that requires
  the core changes in [CORE-CHANGES.md](CORE-CHANGES.md) §1–2.  Until those land,
  callers must use `wp_get_preferred_ai_connector()` explicitly.

The "Set AI Priority Order" button is injected via `MutationObserver` by walking
`h1 → parentElement → parentElement` inside `.boot-layout__stage` rather than
targeting a stable header-actions element, because: (a) the connectors SPA exposes
no `applyFilters()` SlotFill hook points, and (b) the `header-actions` DOM element
is absent when no built-in actions are registered. See CORE-CHANGES.md §5 and §7.
