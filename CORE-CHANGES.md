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

**File:** `wp-includes/connectors.php` — function
`_wp_connectors_get_connector_script_module_data()`

**Problem:** The current code does `ksort($connectors)` (alphabetical sort)
before handing the list to the JavaScript. This loses any meaningful ordering
for the UI.

**Proposed change:**

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

This means the connectors screen renders providers in the user's preferred order
without any extra JavaScript.

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

## Summary

| Change | Impact | Complexity |
|--------|--------|------------|
| `ProviderRegistry::findModelsMetadataForSupport()` accepts priority | AI client respects order | Low |
| `PromptBuilder` applies `wp_ai_provider_priority` filter | Plugin can set preference | Low |
| `_wp_connectors_get_connector_script_module_data()` sorts by priority | Connectors UI respects order | Low |
| `applyFilters` hooks in `stage.tsx` | Plugins can inject UI cleanly | Medium |
| `WP_Connector_Registry::reorder()` | Full chain priority in one hook | Low-Medium |

Of these, **#6 (`reorder()`)** combined with **#1+#2 (AI client priority)**
would give complete end-to-end priority support with minimal core surface area.
