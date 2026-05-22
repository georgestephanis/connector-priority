/**
 * webpack.config.js
 *
 * Extends @wordpress/scripts defaults:
 *   - connector-priority-nav.js  → bundled IIFE in build/
 *   - priority-content.js        → copied as-is (native ES module; must stay
 *                                   untransformed for wp_register_script_module)
 *   - priority-content.css       → copied as-is alongside the module
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const CopyPlugin = require( 'copy-webpack-plugin' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,
	entry: {
		'connector-priority-nav': path.resolve( __dirname, 'src/connector-priority-nav.js' ),
	},
	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'build' ),
	},
	plugins: [
		...defaultConfig.plugins,
		new CopyPlugin( {
			patterns: [
				{ from: 'src/priority-content.js',  to: 'priority-content.js' },
				{ from: 'src/priority-content.css', to: 'priority-content.css' },
			],
		} ),
	],
};
