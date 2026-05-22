/**
 * connector-priority-nav.js
 *
 * Injected on the Settings > Connectors page (options-connectors screen).
 * Uses MutationObserver to wait for the Boot module SPA to render the
 * .admin-ui-page__header-actions slot, then inserts a "Set AI Priority Order"
 * button there — inline with the "Connectors" page title on the right side.
 *
 * The link targets the /priority route inside the same SPA by setting the
 * `p` search-parameter that the Boot module's createPathHistory() reads.
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
	 * Inject the link into .admin-ui-page__header-actions (right side of the
	 * page title bar). Idempotent — skips if already present.
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
		const actions = document.querySelector( '.admin-ui-page__header-actions' );
		if ( actions ) {
			injectLink( actions );
		}
	}

	// Watch for the Boot module to render .admin-ui-page__header-actions and for
	// subsequent SPA navigations that swap the stage content.
	const observer = new MutationObserver( tryInject );
	observer.observe( document.body, { childList: true, subtree: true } );

	// Also try immediately in case the SPA already rendered before this script ran.
	tryInject();
} )();
