export function EngineRuntimeDiagram() {
	return (
		<div
			style={{
				background: 'linear-gradient(135deg, #122457 0%, #0d1b43 100%)',
				borderRadius: '12px',
				padding: '16px',
				margin: '1rem 0 1.5rem'
			}}
		>
			<p style={{ margin: '0 0 12px', color: '#ffffff', fontWeight: 700 }}>Engine Runtime Model</p>
			<div style={{ display: 'grid', gap: '10px' }}>
				<div style={{ background: '#e8e8ea', borderRadius: '8px', padding: '10px 12px' }}>
					<strong>Config Input</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						IEngineConfig.types provides the component and connector type entries to initialise.
					</div>
				</div>
				<div style={{ background: '#4b84e0', borderRadius: '8px', padding: '10px 12px' }}>
					<strong>Type Initialisers</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						Each registered initialiser resolves a config type, constructs an instance, and returns
						factory registration metadata.
					</div>
				</div>
				<div
					style={{
						background: '#1a3370',
						color: '#eef4ff',
						borderRadius: '8px',
						padding: '10px 12px'
					}}
				>
					<strong>Instance Registries</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						ComponentFactory and connector factories store named instances. Engine tracks defaults,
						features, and registered instance types.
					</div>
				</div>
				<div style={{ background: '#f6aa42', borderRadius: '8px', padding: '10px 12px' }}>
					<strong>Lifecycle</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						bootstrap, start, and stop execute in a controlled sequence over
						context.componentInstances.
					</div>
				</div>
			</div>
		</div>
	);
}

export function ComponentWorkflowDiagram() {
	return (
		<div
			style={{
				background: 'linear-gradient(135deg, #122457 0%, #0d1b43 100%)',
				borderRadius: '12px',
				padding: '16px',
				margin: '1rem 0 1.5rem'
			}}
		>
			<p style={{ margin: '0 0 12px', color: '#ffffff', fontWeight: 700 }}>
				Component Workflow Inside Engine Initialisation
			</p>
			<ol
				style={{
					margin: 0,
					paddingLeft: '1.2rem',
					color: '#f7faff',
					display: 'grid',
					gap: '8px'
				}}
			>
				<li>
					<strong>Type selection:</strong> the engine reads `types.&lt;componentType&gt;[]` and
					selects each entry in order.
				</li>
				<li>
					<strong>Factory-level type resolution:</strong> `createComponent` is chosen from the
					component type (for example service or rest-client).
				</li>
				<li>
					<strong>Options merge:</strong> default options and config options are merged, commonly
					injecting active connector instance types.
				</li>
				<li>
					<strong>Instance creation:</strong> the component is created once and pushed into
					`context.componentInstances`.
				</li>
				<li>
					<strong>Instance registration:</strong> the instance is registered in `ComponentFactory`
					under `overrideInstanceType` or generated default instance name.
				</li>
				<li>
					<strong>Runtime resolution:</strong> routes and processors call
					`ComponentFactory.get(...)` and execute business logic through the selected component
					instance.
				</li>
			</ol>
		</div>
	);
}
