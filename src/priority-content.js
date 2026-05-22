/**
 * priority-content.js
 *
 * Content module for the /priority route in the connectors SPA.
 * Registered via wp_register_options_connectors_wp_admin_route() in connector-priority.php.
 */

import {
	DndContext,
	closestCenter,
	PointerSensor,
	KeyboardSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	arrayMove,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const {
	createElement: h,
	useState,
	useCallback,
	useEffect,
} = window.wp.element;
const { __ } = window.wp.i18n;
const apiFetch = window.wp.apiFetch;

// ---------------------------------------------------------------------------
// Read module data injected by WordPress (connector-priority.php)
// ---------------------------------------------------------------------------
function getModuleData() {
	const el = document.getElementById(
		'wp-script-module-data-connector-priority'
	);
	if ( ! el ) {
		return { connectors: {}, priorityOrder: [] };
	}
	try {
		return JSON.parse( el.textContent );
	} catch {
		return { connectors: {}, priorityOrder: [] };
	}
}

// ---------------------------------------------------------------------------
// SortableItem component
// ---------------------------------------------------------------------------
function SortableItem( { item, index } ) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: item.id } );

	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity: isDragging ? 0.4 : undefined,
	};

	return h(
		'li',
		{
			ref: setNodeRef,
			style,
			className: 'cp-item',
			...attributes,
		},
		h(
			'span',
			{
				className: 'cp-drag-handle',
				'aria-hidden': 'true',
				...listeners,
			},
			'⠇'
		),
		h(
			'span',
			{
				className: 'cp-rank',
				'aria-label':
					__( 'Priority', 'connector-priority' ) + ' ' + ( index + 1 ),
			},
			index + 1
		),
		item.logoUrl
			? h( 'img', {
					src: item.logoUrl,
					alt: '',
					className: 'cp-logo',
					width: 32,
					height: 32,
			  } )
			: h( 'span', { className: 'cp-logo cp-logo--placeholder' } ),
		h(
			'div',
			{ className: 'cp-info' },
			h( 'strong', { className: 'cp-name' }, item.name ),
			h( 'span', { className: 'cp-desc' }, item.description )
		),
		item.isActive
			? h(
					'span',
					{ className: 'cp-badge cp-badge--connected' },
					__( 'Active', 'connector-priority' )
			  )
			: h(
					'span',
					{ className: 'cp-badge cp-badge--inactive' },
					__( 'Not connected', 'connector-priority' )
			  )
	);
}

// ---------------------------------------------------------------------------
// Main stage component
// ---------------------------------------------------------------------------
function PriorityPage() {
	const { connectors, priorityOrder: initialOrder } = getModuleData();

	const [ order, setOrder ] = useState( initialOrder );
	const [ saveState, setSaveState ] = useState( 'idle' ); // 'idle'|'saving'|'saved'|'error'

	const sensors = useSensors(
		useSensor( PointerSensor ),
		useSensor( KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		} )
	);

	const items = order.map( ( id ) => connectors[ id ] ).filter( Boolean );

	const backUrl = new URL( window.location.href );
	backUrl.searchParams.set( 'p', '/' );

	const handleDragEnd = useCallback( ( { active, over } ) => {
		if ( over && active.id !== over.id ) {
			setOrder( ( prev ) => {
				const oldIndex = prev.indexOf( active.id );
				const newIndex = prev.indexOf( over.id );
				return arrayMove( prev, oldIndex, newIndex );
			} );
		}
	}, [] );

	const handleSave = useCallback( async () => {
		setSaveState( 'saving' );
		try {
			await apiFetch( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: { wp_connector_priority_order: order },
			} );
			setSaveState( 'saved' );
		} catch ( err ) {
			// eslint-disable-next-line no-console
			console.error( 'connector-priority: save failed', err );
			setSaveState( 'error' );
		}
	}, [ order ] );

	useEffect( () => {
		if ( saveState !== 'saved' ) {
			return;
		}
		const t = setTimeout( () => setSaveState( 'idle' ), 3000 );
		return () => clearTimeout( t );
	}, [ saveState ] );

	if ( ! items.length ) {
		return h(
			'div',
			{ className: 'cp-page' },
			h(
				'a',
				{ href: backUrl.toString(), className: 'cp-page__back' },
				'← ' + __( 'Back to Connectors', 'connector-priority' )
			),
			h(
				'h1',
				{ className: 'cp-page__title' },
				__( 'AI Connector Priority', 'connector-priority' )
			),
			h(
				'p',
				{ className: 'cp-empty' },
				__(
					'No AI connectors are registered. Install an AI provider plugin to get started.',
					'connector-priority'
				)
			)
		);
	}

	return h(
		'div',
		{ className: 'cp-page' },
		h(
			'a',
			{ href: backUrl.toString(), className: 'cp-page__back' },
			'← ' + __( 'Back to Connectors', 'connector-priority' )
		),
		h(
			'h1',
			{ className: 'cp-page__title' },
			__( 'AI Connector Priority', 'connector-priority' )
		),
		h(
			'p',
			{ className: 'cp-page__desc' },
			__(
				'Drag connectors to set the order in which they are tried. The top-ranked provider is used whenever multiple connectors are active.',
				'connector-priority'
			)
		),
		h(
			DndContext,
			{
				sensors,
				collisionDetection: closestCenter,
				onDragEnd: handleDragEnd,
			},
			h(
				SortableContext,
				{ items: order, strategy: verticalListSortingStrategy },
				h(
					'ul',
					{
						className: 'cp-list',
						role: 'list',
						'aria-label': __(
							'AI connector priority order',
							'connector-priority'
						),
					},
					items.map( ( item, index ) =>
						h( SortableItem, {
							key: item.id,
							item,
							index,
						} )
					)
				)
			)
		),
		h(
			'div',
			{ className: 'cp-actions' },
			h(
				'button',
				{
					className: 'button button-primary',
					onClick: handleSave,
					disabled: saveState === 'saving',
				},
				saveState === 'saving'
					? __( 'Saving…', 'connector-priority' )
					: __( 'Save Priority Order', 'connector-priority' )
			),
			saveState === 'saved' &&
				h(
					'span',
					{ className: 'cp-save-success' },
					'✓ ' + __( 'Saved!', 'connector-priority' )
				),
			saveState === 'error' &&
				h(
					'span',
					{ className: 'cp-save-error' },
					__(
						'Error saving — please try again.',
						'connector-priority'
					)
				)
		)
	);
}

export { PriorityPage as stage };
