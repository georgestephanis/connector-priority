/**
 * webpack.config.js
 *
 * Two separate webpack configs:
 *
 *   1. connector-priority-nav.js  — standard IIFE bundle via @wordpress/scripts
 *   2. priority-content.js        — ES module bundle (experiments.outputModule)
 *                                   so wp_register_script_module can load it.
 *                                   dnd-kit is bundled in; @wordpress/* globals
 *                                   are accessed via window.wp.* at runtime.
 *   3. priority-content.css       — copied as-is (no CSS transformation needed)
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const CopyPlugin = require( 'copy-webpack-plugin' );
const path = require( 'path' );

// Strip plugins that are specific to the default single-entry setup and would
// conflict with the module build (e.g. DependencyExtractionWebpackPlugin,
// which adds WP asset files we don't want for the module entry).
const sharedPlugins = defaultConfig.plugins.filter(
	( p ) =>
		p.constructor.name !== 'DependencyExtractionWebpackPlugin' &&
		p.constructor.name !== 'CopyPlugin'
);

// -- Config 1: standard IIFE bundle for the nav script ----------------------
const navConfig = {
	...defaultConfig,
	entry: {
		'connector-priority-nav': path.resolve( __dirname, 'src/connector-priority-nav.js' ),
	},
	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'build' ),
	},
};

// -- Config 2: ES module bundle for the script module -----------------------
const moduleConfig = {
	...defaultConfig,
	entry: {
		'priority-content': path.resolve( __dirname, 'src/priority-content.js' ),
	},
	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'build' ),
		// Output as a native ES module so the browser can import it and
		// the named `stage` export is preserved.
		module: true,
		library: { type: 'module' },
	},
	experiments: {
		...( defaultConfig.experiments ?? {} ),
		outputModule: true,
	},
	// React is accessed via window.wp.element in our code; dnd-kit imports
	// it as 'react'/'react-dom'. Externalize both to the WP globals so there
	// is only one React instance on the page.
	externalsType: 'global',
	externals: {
		react: 'React',
		'react-dom': 'ReactDOM',
	},
	plugins: [
		...sharedPlugins,
		new CopyPlugin( {
			patterns: [
				{ from: 'src/priority-content.css', to: 'priority-content.css' },
			],
		} ),
	],
};

module.exports = [ navConfig, moduleConfig ];
