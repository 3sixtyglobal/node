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

export function ConnectorFactoryDiagram() {
	return (
		<div
			style={{
				background: 'linear-gradient(135deg, #122457 0%, #0d1b43 100%)',
				borderRadius: '12px',
				padding: '16px',
				margin: '1rem 0 1.5rem'
			}}
		>
			<style>{`
        .twin-cf-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 10px;
          align-items: center;
        }

        .twin-cf-arrow {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #a0b8f0;
        }

        @media (max-width: 680px) {
          .twin-cf-grid {
            grid-template-columns: 1fr;
          }

          .twin-cf-arrow {
            flex-direction: row;
            justify-content: center;
          }
        }
      `}</style>
			<p style={{ margin: '0 0 12px', color: '#ffffff', fontWeight: 700 }}>
				Connector Factory: Registration and Resolution
			</p>
			<div className="twin-cf-grid">
				<div
					style={{
						background: '#263f83',
						color: '#f7faff',
						borderRadius: '8px',
						padding: '10px 12px'
					}}
				>
					<strong>Engine Initialisation</strong>
					<div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
						Creates a connector instance and calls{' '}
						<M>XxxConnectorFactory.register('name', () =&gt; instance)</M> — once per configured
						entry during <M>EngineCore.start()</M>.
					</div>
				</div>

				<div className="twin-cf-arrow">
					<span style={{ fontSize: '1.3rem' }}>→</span>
					<div
						style={{
							background: '#4b84e0',
							color: '#071127',
							borderRadius: '8px',
							padding: '10px 12px',
							textAlign: 'center',
							minWidth: '130px'
						}}
					>
						<strong>Factory</strong>
						<div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
							Named generators held in SharedStore — accessible across all module boundaries
						</div>
					</div>
					<span style={{ fontSize: '1.3rem' }}>→</span>
				</div>

				<div
					style={{
						background: '#1a3370',
						color: '#eef4ff',
						borderRadius: '8px',
						padding: '10px 12px'
					}}
				>
					<strong>Service or Route Code</strong>
					<div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
						Calls <M>XxxConnectorFactory.get('name')</M> to resolve the registered instance — no
						compile-time import dependency on the engine or initialisers required.
					</div>
				</div>
			</div>
		</div>
	);
}

export function ConnectorCompositionDiagram() {
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
				Connector Composition: EntityStorageVaultConnector
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
					<strong>IVaultConnector</strong>
					<div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
						Capability contract — sign, verify, encrypt, decrypt, key management, secret storage
					</div>
				</div>

				<div
					style={{
						textAlign: 'center',
						color: '#aec6f0',
						fontSize: '0.82rem',
						lineHeight: 1.6
					}}
				>
					▼ implemented by
				</div>

				<div
					style={{
						background: '#4b84e0',
						color: '#071127',
						borderRadius: '8px',
						padding: '10px 14px',
						textAlign: 'center'
					}}
				>
					<strong>EntityStorageVaultConnector</strong>
					<div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
						Full IVaultConnector implementation that delegates all persistence to entity storage
						instances — no external vault service or network dependency required
					</div>
				</div>

				<div
					style={{
						textAlign: 'center',
						color: '#aec6f0',
						fontSize: '0.82rem',
						lineHeight: 1.6
					}}
				>
					▼ delegates to two named IEntityStorageConnector instances
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
					<div
						style={{
							background: '#263f83',
							color: '#f7faff',
							borderRadius: '8px',
							padding: '10px 12px'
						}}
					>
						<strong>key-material store</strong>
						<div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
							IEntityStorageConnector — stores cryptographic key material
						</div>
					</div>
					<div
						style={{
							background: '#263f83',
							color: '#f7faff',
							borderRadius: '8px',
							padding: '10px 12px'
						}}
					>
						<strong>secrets store</strong>
						<div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
							IEntityStorageConnector — stores opaque secret values
						</div>
					</div>
				</div>

				<div
					style={{
						textAlign: 'center',
						color: '#aec6f0',
						fontSize: '0.82rem',
						lineHeight: 1.6
					}}
				>
					▼ backed by any configured entity storage backend
				</div>

				<div
					style={{
						background: '#f6aa42',
						color: '#091124',
						borderRadius: '8px',
						padding: '10px 14px',
						textAlign: 'center'
					}}
				>
					<strong>Backend</strong>
					<div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
						MongoDB, MySQL, PostgreSQL, ScyllaDB, DynamoDB, CosmosDB, Firestore, file system, or
						in-memory — selected in engine configuration with no vault connector code change
					</div>
				</div>
			</div>
		</div>
	);
}
