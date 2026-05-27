=== Connector Priority ===
Contributors: georgestephanis
Tags: ai, connectors, openai, anthropic, priority
Requires at least: 7.0
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Drag-and-drop priority ordering for AI connectors on Settings > Connectors.

== Description ==

When multiple AI provider connectors are active — for example, OpenAI, Anthropic,
and Google are all connected — WordPress has no built-in way to express which one
should be preferred. This plugin fills that gap.

**What it adds:**

* A **"Set AI Priority Order"** button on the Connectors screen that opens a
  dedicated priority editor inside the same admin interface.
* A **drag-and-drop list** of all registered AI providers — drag rows to reorder
  them, then click **Save Priority Order**.
* The saved order is stored in the `wp_connector_priority_order` site option and
  is exposed via the `/wp/v2/settings` REST endpoint.
* Two public PHP functions for use by other plugins and themes:
  * `wp_get_connector_priority_order()` — returns the full ordered list of
    connector IDs, padded with any connectors not yet explicitly ordered.
  * `wp_get_preferred_ai_connector()` — returns the ID of the highest-priority
    AI connector that is currently active.

**Developer example:**

`$provider = wp_get_preferred_ai_connector(); // e.g. 'openai'`

Note: full runtime enforcement (making the AI client actually *use* the
top-ranked provider during model auto-discovery) requires upstream core changes.
See the bundled `CORE-CHANGES.md` for proposed patches.

== Installation ==

1. Upload the `connector-priority` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin from the **Plugins > Installed Plugins** screen.
3. Visit **Settings > Connectors** — a "Set AI Priority Order" button will appear
   at the top of the connector list.

== Frequently Asked Questions ==

= Does this work without any AI provider plugins installed? =

The plugin activates and saves priority data regardless, but the drag-and-drop
list will be empty until at least one AI provider plugin is installed and its
connector is registered.

= Is the priority used automatically or do I need extra code? =

For the **Connectors screen UI** and all **`ai` plugin features** (excerpt generation,
alt-text, content suggestions, etc.) the saved order is applied automatically — no
extra code needed.

For code that calls `wp_ai_client_prompt()` directly (outside the `ai` plugin),
the priority is not yet applied automatically. The bundled `CORE-CHANGES.md` proposes
the upstream patches needed to wire this up fully. Until those land in core, call
`wp_get_preferred_ai_connector()` explicitly in your own plugin and pass the result
to the AI client.

= Does this affect Akismet or other non-AI connectors? =

No. The priority editor only lists AI provider connectors (those with
`type => 'ai_provider'`). Akismet and other service connectors are unaffected.

= Where is the priority stored? =

In the `wp_connector_priority_order` WordPress option (a JSON array of connector
IDs). It is also available via `GET /wp/v2/settings` and updatable via
`POST /wp/v2/settings` for users with the `manage_options` capability.

== Screenshots ==

1. The "Set AI Priority Order" button on the Settings > Connectors screen.
2. The drag-and-drop priority editor showing three AI providers.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release. No upgrade steps required.
