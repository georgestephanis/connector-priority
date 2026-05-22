<?php
/**
 * Plugin Name:  Connector Priority
 * Description:  Drag-and-drop priority ordering for AI connectors on Settings > Connectors.
 * Version:      1.0.0
 * Requires at least: 7.0
 * Author:       George Stephanis
 * Author URI:   https://stephanis.me
 * License:      GPL-2.0-or-later
 * Text Domain:  connector-priority
 *
 * Provides:
 *   wp_get_connector_priority_order()  – ordered array of all connector IDs
 *   wp_get_preferred_ai_connector()    – ID of highest-priority active AI connector
 *
 * Priority is stored in the `wp_connector_priority_order` option and exposed via
 * the /wp/v2/settings REST endpoint so the in-page drag-and-drop editor can save it.
 *
 * The drag-and-drop UI is injected into Settings > Connectors as a dedicated route
 * (/priority) in the existing Boot-module SPA, registered via the
 * `options-connectors-wp-admin_init` action.
 *
 * @see CORE-CHANGES.md for recommended upstream changes that would let this plugin
 *      fully control which provider the AI client selects by default.
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// 1. Register the priority option
// ---------------------------------------------------------------------------

add_action(
	'init',
	static function () {
		register_setting(
			'connectors',
			'wp_connector_priority_order',
			array(
				'type'              => 'array',
				'description'       => 'Priority order of AI connector IDs (highest-priority first).',
				'default'           => array(),
				'show_in_rest'      => array(
					'schema' => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
				),
				'sanitize_callback' => static function ( $value ) {
					if ( ! is_array( $value ) ) {
						return array();
					}
					return array_values( array_filter( array_map( 'sanitize_key', $value ) ) );
				},
			)
		);
	},
	20
);

// ---------------------------------------------------------------------------
// 2. Public PHP API
// ---------------------------------------------------------------------------

/**
 * Returns the full connector priority order, padded with any connectors that
 * have not yet been explicitly ordered.
 *
 * @return string[] Ordered connector IDs.
 */
function wp_get_connector_priority_order(): array {
	$saved      = (array) get_option( 'wp_connector_priority_order', array() );
	$registered = array_keys( array_filter(
		wp_get_connectors(),
		static fn( array $info ): bool => 'ai_provider' === $info['type']
	) );
	$ordered    = array_values( array_intersect( $saved, $registered ) );
	$remainder  = array_values( array_diff( $registered, $ordered ) );

	return array_merge( $ordered, $remainder );
}

/**
 * Returns the highest-priority AI connector that is currently active.
 *
 * @return string|null Connector ID, or null when no AI connector is active.
 */
function wp_get_preferred_ai_connector(): ?string {
	foreach ( wp_get_connector_priority_order() as $id ) {
		$connector = wp_get_connector( $id );
		if ( ! $connector || 'ai_provider' !== $connector['type'] ) {
			continue;
		}
		$is_active_cb = $connector['plugin']['is_active'] ?? null;
		if ( is_callable( $is_active_cb ) && ! call_user_func( $is_active_cb ) ) {
			continue;
		}
		return $id;
	}
	return null;
}

// ---------------------------------------------------------------------------
// 3. Expose priority data to the connectors-page script module
// ---------------------------------------------------------------------------

/**
 * Adds `connectorPriorityOrder` to the data supplied to the connectors script
 * module for both the wp-admin integrated version and the standalone version.
 */
add_filter(
	'script_module_data_options-connectors-wp-admin',
	static function ( array $data ): array {
		$data['connectorPriorityOrder'] = wp_get_connector_priority_order();
		return $data;
	}
);

add_filter(
	'script_module_data_options-connectors',
	static function ( array $data ): array {
		$data['connectorPriorityOrder'] = wp_get_connector_priority_order();
		return $data;
	}
);

/**
 * Provides the data bundle consumed by our own priority-content.js module.
 *
 * The module reads this from the JSON script tag:
 *   <script type="application/json" id="wp-script-module-data-connector-priority">
 */
add_filter(
	'script_module_data_connector-priority',
	static function ( array $data ): array {
		if ( ! function_exists( 'wp_get_connectors' ) ) {
			return $data;
		}

		$connectors = array();
		foreach ( wp_get_connectors() as $id => $info ) {
			if ( 'ai_provider' !== $info['type'] ) {
				continue;
			}
			$is_active_cb = $info['plugin']['is_active'] ?? null;
			$is_active    = is_callable( $is_active_cb ) ? (bool) call_user_func( $is_active_cb ) : true;

			$connectors[ $id ] = array(
				'id'          => $id,
				'name'        => $info['name'],
				'description' => $info['description'],
				'logoUrl'     => $info['logo_url'] ?? null,
				'isActive'    => $is_active,
			);
		}

		$data['connectors']    = $connectors;
		$data['priorityOrder'] = wp_get_connector_priority_order();

		return $data;
	}
);

// ---------------------------------------------------------------------------
// 4. Register the /priority route in the connectors SPA
// ---------------------------------------------------------------------------

/**
 * Shared setup: registers the script module and enqueues CSS + nav script.
 * Called from both init actions so the correct route registrar can be passed.
 *
 * @param callable $register_route wp_register_options_connectors_route or
 *                                 wp_register_options_connectors_wp_admin_route.
 */
function _connector_priority_init( callable $register_route ): void {
	wp_register_script_module(
		'connector-priority',
		plugin_dir_url( __FILE__ ) . 'build/priority-content.js',
		array(),
		'1.0.0'
	);

	call_user_func( $register_route, '/priority', 'connector-priority', null );

	wp_enqueue_style(
		'connector-priority',
		plugin_dir_url( __FILE__ ) . 'build/priority-content.css',
		array(),
		'1.0.0'
	);

	wp_enqueue_script(
		'connector-priority-nav',
		plugin_dir_url( __FILE__ ) . 'build/connector-priority-nav.js',
		array(),
		'1.0.0',
		array( 'in_footer' => true )
	);
}

// Gutenberg active: wp-admin integrated page (?page=options-connectors-wp-admin).
// Gutenberg shadows core's route registry under a gutenberg_ prefix, so detect
// which registration function is available rather than hardcoding the core one.
add_action(
	'options-connectors-wp-admin_init',
	static function () {
		$register = function_exists( 'gutenberg_register_options_connectors_wp_admin_route' )
			? 'gutenberg_register_options_connectors_wp_admin_route'
			: 'wp_register_options_connectors_wp_admin_route';
		_connector_priority_init( $register );
	}
);

// Gutenberg inactive: standalone page (?page=options-connectors).
// admin_enqueue_scripts never fires here — everything must be enqueued inside
// this action, which runs before the HTML is output.
add_action(
	'options-connectors_init',
	static function () {
		_connector_priority_init( 'wp_register_options_connectors_route' );
	}
);

// ---------------------------------------------------------------------------
// 5. Integrate with the ai plugin's per-capability model preferences
// ---------------------------------------------------------------------------

/**
 * Reorders model preference arrays from the ai plugin so models belonging
 * to higher-priority connectors are tried first.
 *
 * Each entry is a [provider_id, model_slug] pair. All pairs are preserved;
 * only their order changes — pairs whose provider appears earlier in the
 * saved priority list come first.  Providers not in the list stay at the end
 * in their original relative order (stable sort via position tracking).
 *
 * Applies to: wpai_preferred_text_models, wpai_preferred_image_models,
 *             wpai_preferred_vision_models  (from the bundled ai plugin).
 *
 * This is a partial workaround until a core-level filter exists; see
 * CORE-CHANGES.md §2 for the upstream proposal.
 *
 * @param array<int, array{string, string}> $models Provider+model pairs.
 * @return array<int, array{string, string}> Re-sorted pairs.
 */
function _connector_priority_sort_models( array $models ): array {
	$priority = wp_get_connector_priority_order();
	if ( empty( $priority ) ) {
		return $models;
	}
	$rank = array_flip( $priority );
	usort(
		$models,
		static function ( array $a, array $b ) use ( $rank ): int {
			$ra = $rank[ $a[0] ] ?? PHP_INT_MAX;
			$rb = $rank[ $b[0] ] ?? PHP_INT_MAX;
			return $ra <=> $rb;
		}
	);
	return $models;
}

add_filter( 'wpai_preferred_text_models',   '_connector_priority_sort_models' );
add_filter( 'wpai_preferred_image_models',  '_connector_priority_sort_models' );
add_filter( 'wpai_preferred_vision_models', '_connector_priority_sort_models' );
