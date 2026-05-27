# Required / Recommended Core Changes for Full Connector Priority Support

This document describes upstream WordPress core changes that would allow the
`connector-priority` plugin to be fully effective. The plugin already handles
the **UI and data-storage** side; these changes are needed to make the stored
priority actually influence **which AI provider is selected at runtime**.

---

## 1. Honour priority in `ProviderRegistry::findModelsMetadataForSupport()`

**File:** `wp-includes/php-ai-client/src/Providers/ProviderRegistry.php`

**Problem:** `findModelsMetadataForSupport()` iterates providers in PHP array
insertion order, which equals plugin-activation order — essentially random from
the site owner's perspective.

**Proposed change:**

```php
// Current (iterates in registration order)
foreach ($this->registeredIdsToClassNames as $providerId => $className) {
    ...
}

// Proposed: accept an optional priority list
public function findModelsMetadataForSupport(
    ModelRequirements $modelRequirements,
    array $preferredProviderOrder = []  // NEW optional param
): array {
    $ids = $this->getRegisteredProviderIds();

    // Re-sort ids so preferred providers come first
    if ( $preferredProviderOrder ) {
        $ordered   = array_values( array_intersect( $preferredProviderOrder, $ids ) );
        $remainder = array_values( array_diff( $ids,  $preferredProviderOrder ) );
        $ids       = array_merge( $ordered, $remainder );
    }

    $results = [];
    foreach ($ids as $providerId) {
        $className      = $this->registeredIdsToClassNames[$providerId];
        $providerResults = $this->findProviderModelsMetadataForSupport($providerId, $modelRequirements);
        if (!empty($providerResults)) {
            $providerMetadata = $className::metadata();
            $results[] = new ProviderModelsMetadata($providerMetadata, $providerResults);
        }
    }
    return $results;
}
```

**Why this matters:** `PromptBuilder` calls `findModelsMetadataForSupport()` to
discover candidate models. Returning results in priority order means the first
match wins when multiple providers support the same capability.

---

## 2. Pass priority order when calling `findModelsMetadataForSupport()`

**File:** `wp-includes/php-ai-client/src/Builders/PromptBuilder.php`

**Problem:** `PromptBuilder` never passes a priority list to the registry.

**Proposed change:** Apply the `wp_ai_provider_priority` filter at build time:

```php
// In PromptBuilder where findModelsMetadataForSupport() is called:
$preferredOrder = apply_filters( 'wp_ai_provider_priority', [] );
$providerModels = $this->registry->findModelsMetadataForSupport(
    $requirements,
    $preferredOrder          // NEW
);
```

This lets the `connector-priority` plugin wire itself up with a single hook:

```php
// In connector-priority.php (plugin, no core edits needed after this change):
add_filter( 'wp_ai_provider_priority', 'wp_get_connector_priority_order' );
```

**Prior art — `ai` plugin:** The bundled `ai` plugin (`wp-content/plugins/ai`) already
implements a comparable pattern one level down, at the model-pair level rather than
the provider level.  Three filters in `wp-content/plugins/ai/includes/helpers.php`
let plugins reorder the `[provider_id, model_slug]` preference lists that are passed
to `PromptBuilder::usingModelPreference()`:

| Filter | Capability |
|--------|------------|
| `wpai_preferred_text_models` | Text generation |
| `wpai_preferred_image_models` | Image generation |
| `wpai_preferred_vision_models` | Vision (image input) |

Each filter receives and must return `array<int, array{string, string}>` — an ordered
list of `[provider_id, model_slug]` pairs.  `connector-priority` hooks all three today
(see §5 in `connector-priority.php`) as a partial workaround: it re-sorts the pairs so
those belonging to higher-priority connectors come first, without removing any entries.

**Scope limitation:** These filters only apply to code that goes through the `ai`
plugin's `get_preferred_models_for_text_generation()` / `get_preferred_image_models()` /
`get_preferred_vision_models()` helpers — i.e., abilities that extend `Abstract_Ability`
and call `set_provider_model_preference()`.  Any code that calls `wp_ai_client_prompt()`
directly bypasses them entirely.  The `wp_ai_provider_priority` filter proposed above
would close this gap by acting at the `PromptBuilder` layer.

---

## 3. Add `wp_ai_provider_priority` filter documentation to `connectors.php`

**File:** `wp-includes/connectors.php`

Document the filter so plugin and theme developers know it exists. Example:

```php
/**
 * Filters the preferred AI provider order used when auto-discovering models.
 *
 * Return an array of provider IDs (e.g. ['openai', 'anthropic', 'google'])
 * from highest to lowest priority. Providers not listed are appended in
 * registration order.
 *
 * @since 7.x
 *
 * @param string[] $order Ordered provider IDs. Default empty array (registration order).
 */
$preferred_order = apply_filters( 'wp_ai_provider_priority', [] );
```

---

## 4. Sort connectors by priority in `_wp_connectors_get_connector_script_module_data()`

**Status: Resolved at the plugin level — no core change needed.**

Core added `ksort( $connectors )` (see `wp-includes/connectors.php` L725-730)
and registers `_wp_connectors_get_connector_script_module_data` on the
`script_module_data_options-connectors-wp-admin` filter at priority 10.
Because the plugin's filter callbacks on the same hook are registered later
(plugins load after core), `$data['connectors']` is already fully populated
when our callbacks run.

The plugin now reorders `$data['connectors']` inside those callbacks via
`_connector_priority_reorder()`, so the JavaScript receives connectors in the
user's saved priority order without any core change.

**Original proposed core change (kept for reference):**

```php
// Replace ksort( $connectors ) with priority-aware ordering:
$priority_order = wp_get_connector_priority_order();
$ordered        = array();
foreach ( $priority_order as $id ) {
    if ( isset( $connectors[ $id ] ) ) {
        $ordered[ $id ] = $connectors[ $id ];
    }
}
// Append any connectors not yet in the priority list (e.g. newly registered)
foreach ( $connectors as $id => $data ) {
    if ( ! isset( $ordered[ $id ] ) ) {
        $ordered[ $id ] = $data;
    }
}
$data['connectors'] = $ordered;
```

The plugin-level workaround is equivalent; the proposed core change would only
matter if the goal were to bake priority ordering into core without requiring
this plugin.

---

## 5. Expose JS filter hooks in the connectors React stage

**File:** `packages/connectors-home/stage.tsx` (Gutenberg / WP core source)

**Problem:** The connectors page React component has no JS `applyFilters()`
call-sites, so plugins cannot inject UI elements (e.g. a priority banner or
reorder affordance) without MutationObserver hacks.

**Proposed additions using `@wordpress/hooks`:**

```tsx
import { applyFilters } from '@wordpress/hooks';

// Before the connector list renders:
const ConnectorListHeader = applyFilters(
    'connectors.listHeader',
    null          // default: nothing
) as React.ReactNode | null;

// Inside the Stage JSX:
return (
    <Page title={ __( 'Connectors' ) } hasPadding>
        { ConnectorListHeader }
        { /* existing connector list … */ }
    </Page>
);
```

With this in place, the `connector-priority` plugin could add its navigation
link purely through JS without any DOM manipulation:

```js
// In a script module registered on options-connectors-wp-admin_init:
import { addFilter }       from '@wordpress/hooks';
import { createElement: h } from '@wordpress/element';

addFilter(
    'connectors.listHeader',
    'connector-priority/nav-link',
    () => h( 'a', {
        href:      new URL( window.location.href ).searchParams.set( 'p', '/priority' ) || '#',
        className: 'button',
    }, 'Set AI Priority Order' )
);
```

---

## 6. Add `WP_Connector_Registry::unregister_all()` or reorder support

**File:** `wp-includes/class-wp-connector-registry.php`

Currently there is no way to reorder registered connectors. Adding a
`reorder( array $ids )` method would let the connector-priority plugin apply
the saved order before `wp_get_connectors()` returns, making the priority
transparent to all callers.

```php
/**
 * Reorders registered connectors.
 *
 * @param string[] $ids Connector IDs in desired order.
 *                      IDs not present in $ids are appended in their
 *                      current order.
 */
public function reorder( array $ids ): void {
    $ordered   = [];
    foreach ( $ids as $id ) {
        if ( isset( $this->registered_connectors[ $id ] ) ) {
            $ordered[ $id ] = $this->registered_connectors[ $id ];
        }
    }
    foreach ( $this->registered_connectors as $id => $data ) {
        if ( ! isset( $ordered[ $id ] ) ) {
            $ordered[ $id ] = $data;
        }
    }
    $this->registered_connectors = $ordered;
}
```

The plugin would then hook into `wp_connectors_init` (after all connectors are
registered) at a late priority:

```php
add_action( 'wp_connectors_init', function ( WP_Connector_Registry $registry ) {
    $registry->reorder( wp_get_connector_priority_order() );
}, 100 );
```

This single change would propagate priority through the entire chain:
`wp_get_connectors()` → `_wp_connectors_pass_default_keys_to_ai_client()` →
`ProviderRegistry` → `PromptBuilder`.

---

## 7. Always render the `header-actions` slot in the Page component

**File:** `packages/admin-ui/src/page/index.tsx` (or equivalent in both core and
Gutenberg builds)

**Problem:** The `Page` component only renders the `header-actions` container
element when the `actions` prop is non-null.  This means plugins have no stable
DOM node to inject into, forcing structural DOM traversal (e.g. walking from
`h1` up two levels to its containing flex row) as a fragile substitute.

Compounding this, Gutenberg compiles the component with CSS Modules, so the
container's class name is an unpredictable hash that changes between releases.

**Proposed change:** Always render the header-actions container, and give it a
stable, non-hashed global class as a hook point alongside whatever CSS-Modules
class the build system assigns:

```tsx
// Before (conditional render)
{ actions && (
    <HStack className={ styles['header-actions'] } … >
        { actions }
    </HStack>
) }

// After (always rendered, stable hook class added)
<HStack
    className={ `admin-ui-page__header-actions ${ styles['header-actions'] }` }
    …
>
    { actions }
</HStack>
```

With this change, `document.querySelector('.admin-ui-page__header-actions')`
reliably finds the element in both core and Gutenberg builds, and plugins can
`appendChild` into it without DOM traversal hacks.

---

## 8. `createPathHistory` should omit `?p=` for the root route

**File:** `packages/boot/src/create-path-history.ts`

**Problem:** `createPathHistory()` unconditionally sets the `p` search parameter
on every navigation, including when navigating back to the root route (`/`).
This leaves `?p=%2F` in the browser address bar, which looks like a URL error
to users and breaks "clean URL" sharing.

**Current implementation:**

```js
createHref: ( href ) => {
    const searchParams = new URLSearchParams( window.location.search );
    searchParams.set( 'p', href );
    return `${ window.location.pathname }?${ searchParams }`;
},
```

**Proposed change:** Delete the `p` parameter when navigating to `/`:

```js
createHref: ( href ) => {
    const searchParams = new URLSearchParams( window.location.search );
    if ( href === '/' ) {
        searchParams.delete( 'p' );
    } else {
        searchParams.set( 'p', href );
    }
    const qs = searchParams.toString();
    return qs
        ? `${ window.location.pathname }?${ qs }`
        : window.location.pathname;
},
```

This also benefits any future SPA that uses `createPathHistory` — the root
route never pollutes the URL.

---

## Summary

| Change | Impact | Complexity |
|--------|--------|------------|
| `ProviderRegistry::findModelsMetadataForSupport()` accepts priority | AI client respects order | Low |
| `PromptBuilder` applies `wp_ai_provider_priority` filter | Plugin can set preference for all callers | Low |
| ~~`_wp_connectors_get_connector_script_module_data()` sorts by priority~~ | ~~Connectors UI respects order~~ | **Resolved** — plugin reorders via filter |
| `applyFilters` hooks in `stage.tsx` | Plugins can inject UI cleanly | Medium |
| `WP_Connector_Registry::reorder()` | Full chain priority in one hook | Low-Medium |
| Always render `header-actions` with stable global class | Plugins can inject without DOM traversal | Low |
| `createPathHistory` omits `?p=` for root route | Clean address bar on back-navigation | Low |

**Already handled without core changes:**
- The `ai` plugin exposes `wpai_preferred_text_models`, `wpai_preferred_image_models`,
  and `wpai_preferred_vision_models` filters that `connector-priority` hooks today.
  These cover `ai` plugin features but not direct `wp_ai_client_prompt()` callers.
- The connectors screen UI now delivers connectors to the client in priority order
  via the `script_module_data_options-connectors-wp-admin` filter (see §4).

Of these, **#6 (`reorder()`)** combined with **#1+#2 (AI client priority)**
would give complete end-to-end priority support with minimal core surface area.
**#7 and #8** are quality-of-life fixes that benefit all Boot-module SPA pages,
not just the connectors screen.
