export function ExtensionPhaseDiagram() {
	const nodeStyle = {
		background: '#e8e8ea',
		color: '#091124',
		borderRadius: '8px',
		padding: '8px 12px'
	};

	const hookStyle = {
		background: '#263f83',
		color: '#f7faff',
		borderRadius: '8px',
		padding: '8px 12px'
	};

	const runningStyle = {
		background: '#f6aa42',
		color: '#091124',
		borderRadius: '8px',
		padding: '8px 12px'
	};

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
				Extension Hook Timing Relative to Node Startup
			</p>
			<div style={{ display: 'grid', gap: '6px' }}>
				<div style={nodeStyle}>
					<strong>node.run() starts</strong>
					<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
						Environment variables merged, engine and server config built from env values
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={hookStyle}>
					<strong>extensionInitialise(envVars, nodeEngineConfig)</strong>
					<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
						Can read and mutate engine config before engine is created — the only hook that can
						influence type configuration
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={nodeStyle}>
					<strong>engine created and started</strong>
					<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
						Connector and component type initialisers run, context IDs registered, bootstrap and
						start lifecycle phases complete
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={hookStyle}>
					<strong>extensionInitialiseEngine(engineCore)</strong>
					<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
						Can read engine state, register additional component instances, or configure
						supplementary engine behaviour
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={nodeStyle}>
					<strong>engine server created</strong>
					<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
						Web host, ports, CORS, route processors, and REST routes configured
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={hookStyle}>
					<strong>extensionInitialiseEngineServer(engineCore, engineServer)</strong>
					<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
						Can add middleware, register additional routes, or modify server configuration before
						the server begins accepting requests
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={runningStyle}>
					<strong>runtime active — server accepting requests</strong>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={nodeStyle}>
					<strong>SIGTERM or SIGINT received</strong>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={hookStyle}>
					<strong>extensionShutdown()</strong>
					<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
						Release any resources acquired during earlier hooks — called before server and engine
						stop
					</div>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div style={nodeStyle}>
					<strong>server and engine stopped</strong>
				</div>
			</div>
		</div>
	);
}
