/**
 * connector-priority-nav.js
 *
 * Injected on the Settings > Connectors page (options-connectors screen).
 * Uses MutationObserver to wait for the Boot module SPA to render the page
 * header, then inserts a "Set AI Priority Order" button inline with the
 * "Connectors" title on the right side.
 *
 * The link targets the /priority route inside the same SPA by setting the
 * `p` search-parameter that the Boot module's createPathHistory() reads.
 *
 * DOM targeting note: The page header-actions slot is omitted from the DOM
 * when no built-in actions are registered (Gutenberg's HStack skips rendering
 * when children is undefined). The reliable hook is the flex row that wraps
 * the title — two levels above the h1 (h1 → title-stack → header-content).
 * header-content is a flex row; margin-left: auto on our button pins it right.
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
	 * Remove ?p=/ from the URL when the SPA has navigated back to the root
	 * route. The Boot module always sets p=/ for root; strip it so the address
	 * bar stays clean. Called on every observer tick so it catches both
	 * programmatic navigation and browser back/forward.
	 */
	function cleanRootParam() {
		const url = new URL( window.location.href );
		if ( url.searchParams.get( 'p' ) === '/' ) {
			url.searchParams.delete( 'p' );
			history.replaceState( history.state, '', url.toString() );
		}
	}

	/**
	 * Inject the link into the header-content flex row. Idempotent.
	 *
	 * @param {Element} headerContent
	 */
	function injectLink( headerContent ) {
		if ( headerContent.querySelector( '.cp-priority-nav-link' ) ) {
			return;
		}

		const link = document.createElement( 'a' );
		link.href = priorityUrl();
		link.className = 'cp-priority-nav-link button';
		link.style.marginLeft = 'auto';
		link.textContent = 'Set AI Priority Order';

		headerContent.appendChild( link );
	}

	function tryInject() {
		if ( isOnPriorityRoute() ) {
			return;
		}

		const stage = document.querySelector( '.boot-layout__stage' );
		if ( ! stage ) {
			return;
		}

		// Find the h1 page title, then walk up to the flex row that contains it.
		// Structure (both core and Gutenberg): h1 → title-stack → header-content.
		// header-content is a flex row; appending with margin-left:auto places
		// our button at the right end regardless of justify-content value.
		const h1 = stage.querySelector( 'h1' );
		if ( ! h1 || ! h1.parentElement || ! h1.parentElement.parentElement ) {
			return;
		}

		injectLink( h1.parentElement.parentElement );
	}

	// Watch for the Boot module to render the stage and for subsequent SPA
	// navigations that swap the stage content.
	const observer = new MutationObserver( tryInject );
	observer.observe( document.body, { childList: true, subtree: true } );

	// Also try immediately in case the SPA already rendered before this script ran.
	tryInject();
} )();
