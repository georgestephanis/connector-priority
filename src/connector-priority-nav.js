/**
 * connector-priority-nav.js
 *
 * Injected on the Settings > Connectors page (options-connectors screen).
 * Uses MutationObserver to wait for the React SPA to render the connector list,
 * then inserts a "Set AI Priority Order" link at the top of .connectors-page.
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
	 * Inject the link into the top of the connectors page element.
	 * Idempotent — skips if already present.
	 *
	 * @param {Element} connectorsPage
	 */
	function injectLink( connectorsPage ) {
		if ( connectorsPage.querySelector( '.cp-priority-nav-link' ) ) {
			return;
		}

		const wrapper = document.createElement( 'div' );
		wrapper.style.cssText = 'margin-bottom:16px';

		const link = document.createElement( 'a' );
		link.href = priorityUrl();
		link.className = 'cp-priority-nav-link button';
		link.textContent = 'Set AI Priority Order';

		wrapper.appendChild( link );
		connectorsPage.insertBefore( wrapper, connectorsPage.firstChild );
	}

	function tryInject() {
		const page = document.querySelector( '.connectors-page' );
		if ( page ) {
			injectLink( page );
		}
	}

	// Watch for the React app to render .connectors-page into the DOM.
	const observer = new MutationObserver( tryInject );
	observer.observe( document.body, { childList: true, subtree: true } );

	// Also try immediately in case the SPA already rendered before this script ran.
	tryInject();
} )();
