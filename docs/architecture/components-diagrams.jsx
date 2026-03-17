const M = ({ children }) => (
	<span
		style={{
			fontFamily: 'monospace',
			background: 'rgba(0,0,0,0.25)',
			color: 'inherit',
			borderRadius: '3px',
			padding: '1px 5px',
			fontSize: '0.9em'
		}}
	>
		{children}
	</span>
);

export function ComponentLayerDiagram() {
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
				Request Path Through Component and Connector Layers
			</p>
			<div style={{ display: 'grid', gap: '6px' }}>
				<div
					style={{
						background: '#e8e8ea',
						color: '#091124',
						borderRadius: '8px',
						padding: '10px 14px',
						textAlign: 'center'
					}}
				>
					<strong>HTTP Request or WebSocket Message</strong>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div
					style={{
						background: '#263f83',
						color: '#f7faff',
						borderRadius: '8px',
						padding: '10px 14px'
					}}
				>
					<strong>Route</strong>
					<div style={{ marginTop: '5px', fontSize: '0.88rem' }}>
						Transport adapter — parses request inputs, validates path and query parameters, calls{' '}
						<M>ComponentFactory.get(...)</M>, and serialises the response.
					</div>
				</div>

				<div
					style={{ textAlign: 'center', color: '#aec6f0', fontSize: '0.82rem', lineHeight: 1.6 }}
				>
					▼ <M>ComponentFactory.get(...)</M>
				</div>

				<div
					style={{
						background: '#4b84e0',
						color: '#071127',
						borderRadius: '8px',
						padding: '10px 14px'
					}}
				>
					<strong>Component</strong>
					<div style={{ marginTop: '5px', fontSize: '0.88rem' }}>
						Domain logic — validates inputs with guards, applies business rules, orchestrates calls
						across one or more connectors or other components, and assembles domain responses.
					</div>
				</div>

				<div
					style={{ textAlign: 'center', color: '#aec6f0', fontSize: '0.82rem', lineHeight: 1.6 }}
				>
					▼ <M>ConnectorFactory.get(...)</M>
				</div>

				<div
					style={{
						background: '#1a3370',
						color: '#eef4ff',
						borderRadius: '8px',
						padding: '10px 14px'
					}}
				>
					<strong>Connector</strong>
					<div style={{ marginTop: '5px', fontSize: '0.88rem' }}>
						Infrastructure adapter — implements the domain capability interface and translates calls
						into backend-specific operations. Swappable at configuration time without changing
						component or route code.
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div
					style={{
						background: '#f6aa42',
						color: '#091124',
						borderRadius: '8px',
						padding: '10px 14px'
					}}
				>
					<strong>Backend</strong>
					<div style={{ marginTop: '5px', fontSize: '0.88rem' }}>
						A database, cloud storage service, distributed ledger, messaging system, or in-memory
						adapter — selected in engine configuration.
					</div>
				</div>
			</div>
		</div>
	);
}
