/**
 * connector-priority-nav.js
 *
 * Injected on the Settings > Connectors page (options-connectors screen).
 * Uses MutationObserver to wait for the Boot module SPA to render the
 * page header's action slot, then inserts a "Set AI Priority Order" button
 * there — inline with the "Connectors" page title on the right side.
 *
 * The link targets the /priority route inside the same SPA by setting the
 * `p` search-parameter that the Boot module's createPathHistory() reads.
 *
 * Selector note: WordPress core uses the global class `admin-ui-page__header-actions`
 * while the Gutenberg plugin compiles the same component with CSS Modules, producing
 * a hashed class like `b7cb5b9daf3a3b25__header-actions`. Both share the substring
 * `__header-actions`, so `[class*="__header-actions"]` matches either version.
 */
/* global MutationObserver */
( function () {
	'use strict';

	/**
	 * Build the URL for the /priority route.
	 * The Boot module reads the current path from window.location.search ?p=...
	 */
	function priorityUrl() {
		const url = new URL( window.location.href );
		url.searchParams.set( 'p', '/priority' );
		return url.toString();
	}

	/**
	 * Returns true when the current SPA route is already /priority.
	 */
	function isOnPriorityRoute() {
		const p = new URLSearchParams( window.location.search ).get( 'p' );
		return p === '/priority';
	}

	/**
	 * Inject the link into the page header's action slot. Idempotent.
	 *
	 * @param {Element} actions
	 */
	function injectLink( actions ) {
		if ( actions.querySelector( '.cp-priority-nav-link' ) ) {
			return;
		}

		const link = document.createElement( 'a' );
		link.href = priorityUrl();
		link.className = 'cp-priority-nav-link button';
		link.textContent = 'Set AI Priority Order';

		actions.appendChild( link );
	}

	function tryInject() {
		if ( isOnPriorityRoute() ) {
			return;
		}
		// .boot-layout__stage is a stable class from the Boot module (both core and
		// Gutenberg versions). Search within it to avoid matching stale or off-screen
		// elements from prior navigations.
		const stage = document.querySelector( '.boot-layout__stage' );
		if ( ! stage ) {
			return;
		}
		// Core renders .admin-ui-page__header-actions; Gutenberg compiles the same
		// component with CSS Modules, giving a hash-prefixed class that still ends in
		// __header-actions. The substring selector matches both without version checks.
		const actions = stage.querySelector( '[class*="__header-actions"]' );
		if ( actions ) {
			injectLink( actions );
		}
	}

	// Watch for the Boot module to render the stage and for subsequent SPA
	// navigations that swap the stage content.
	const observer = new MutationObserver( tryInject );
	observer.observe( document.body, { childList: true, subtree: true } );

	// Also try immediately in case the SPA already rendered before this script ran.
	tryInject();
} )();
