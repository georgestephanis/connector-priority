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
| `src/priority-content.js` | Source ES module. Exports `stage` — the React drag-and-drop component rendered at the `/priority` SPA route. Copied verbatim to `build/` to preserve the native ES module format. |
| `src/connector-priority-nav.js` | Source IIFE script. Uses `MutationObserver` to inject a "Set AI Priority Order" link. Compiled and minified by webpack into `build/`. |
| `src/priority-content.css` | Source stylesheet for the priority UI. Copied verbatim to `build/`. |
| `build/` | Compiled output committed to git. Ready to serve — no build step needed to use the plugin. |
| `webpack.config.js` | Extends `@wordpress/scripts` defaults: compiles the nav script and copies the ES module + CSS unchanged. |
| `assets/` | Plugin directory and README images: `icon.svg`, `icon-128x128.png`, `icon-256x256.png`, `banner.svg`, `banner-772x250.png`, `banner-1544x500.png`. |
| `DESIGN_SYSTEM.md` | Visual design spec: color tokens, typography, spacing, component rules. Read this before touching any CSS or adding new UI. |
| `CORE-CHANGES.md` | Proposed upstream WordPress core patches for full priority enforcement. |
| `README.md` | User-facing documentation and development workflow. |
| `readme.txt` | WordPress.org plugin directory readme. |

## Key constraints

- **Build required before testing.** Run `npm run build` to populate `build/`
  from `src/`. The `build/` directory is committed to git so the plugin is
  immediately usable without a local build step (e.g. via `git:directory` in
  Playground), but always rebuild after editing source files.

- **`priority-content.js` must not be webpack-bundled.** It is a native ES
  module loaded by WordPress's Script Module system (`wp_register_script_module`)
  as `type="module"`. The webpack config copies it unchanged. Do not add npm
  `import` statements that require bundling, and do not change the webpack config
  to compile it — the named `export { stage }` must survive intact. Use
  `window.wp.*` globals for WordPress APIs.

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
```

## How routing works

The connectors SPA (options-connectors.php) uses the Boot module's
`createPathHistory()`, which reads the current route from the `p` URL search
parameter (e.g. `?p=/priority`). This plugin registers the `/priority` route via
`wp_register_options_connectors_wp_admin_route()` and the `connector-priority`
script module as its content module. The content module exports `stage`
(a React component), which the Boot system renders inside `.boot-layout__stage`.

## Testing checklist

- [ ] Activate plugin; visit Settings > Connectors — "Set AI Priority Order"
      button appears at top of connector list.
- [ ] Click button; page navigates to `?p=/priority` and shows the priority UI.
- [ ] All registered AI providers appear in the list with name, logo (if any),
      and Connected/Not connected badge.
- [ ] Drag a row to a new position; ranking numbers update.
- [ ] Click "Save Priority Order"; a "✓ Saved!" confirmation appears briefly.
- [ ] Reload page; the saved order persists.
- [ ] `wp_get_connector_priority_order()` returns the saved order (padded with
      any unordered connectors at the end).
- [ ] Deactivate plugin; Settings > Connectors returns to normal.

## Known limitations

The saved priority order is not yet automatically honoured by the AI client when
auto-discovering models — that requires the core changes described in
[CORE-CHANGES.md](CORE-CHANGES.md). Until those land, callers must use
`wp_get_preferred_ai_connector()` explicitly.

The "Set AI Priority Order" navigation link is injected via `MutationObserver`
rather than a proper JS SlotFill because the connectors SPA does not currently
expose `applyFilters()` hook points in its React tree (see CORE-CHANGES.md §5).
