/**
 * webpack.config.js
 *
 * Single config — both entries output as native ES modules so they can be
 * loaded via wp_enqueue_script_module / wp_register_script_module.
 *
 *   connector-priority-nav.js  — side-effect-only module (no exports)
 *   priority-content.js        — exports `stage` for the Boot module SPA
 *
 * dnd-kit is bundled in; React/ReactDOM are externalised to the WP globals
 * (window.React / window.ReactDOM) to keep a single React instance on the page.
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const CopyPlugin = require( 'copy-webpack-plugin' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,
	entry: {
		'connector-priority-nav': path.resolve( __dirname, 'src/connector-priority-nav.js' ),
		'priority-content':       path.resolve( __dirname, 'src/priority-content.js' ),
	},
	output: {
		...defaultConfig.output,
		path:    path.resolve( __dirname, 'build' ),
		module:  true,
		library: { type: 'module' },
	},
	experiments: {
		...( defaultConfig.experiments ?? {} ),
		outputModule: true,
	},
	// React is accessed via window.wp.element in our source; dnd-kit imports it
	// as 'react'/'react-dom'. Externalise both to the WP globals.
	externalsType: 'global',
	externals: {
		react:     'React',
		'react-dom': 'ReactDOM',
	},
	plugins: [
		...defaultConfig.plugins.filter(
			( p ) =>
				// Asset files are for classic wp_enqueue_script; not needed for modules.
				p.constructor.name !== 'DependencyExtractionWebpackPlugin' &&
				// Replace the default CopyPlugin with our own patterns below.
				p.constructor.name !== 'CopyPlugin'
		),
		new CopyPlugin( {
			patterns: [
				{ from: 'src/priority-content.css', to: 'priority-content.css' },
			],
		} ),
	],
};
