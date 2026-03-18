export function NodeBootstrapDiagram() {
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
				Node Bootstrap Sequence
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
				<li>Initialise execution directories, locales, and command-line processing.</li>
				<li>
					Merge environment defaults, process variables, option overrides, and optional env files.
				</li>
				<li>Build engine config from env values (`buildEngineConfiguration`).</li>
				<li>Build engine-server config from env values (`buildEngineServerConfiguration`).</li>
				<li>Create engine with state storage and custom context ID bootstrap.</li>
				<li>Create engine server, apply extensions, then start server and engine.</li>
			</ol>
		</div>
	);
}

export function EnvBuildDiagram() {
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
				Environment to Runtime Configuration Flow
			</p>
			<div style={{ display: 'grid', gap: '10px' }}>
				<div style={{ background: '#e8e8ea', borderRadius: '8px', padding: '10px 12px' }}>
					<strong>Input Sources</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						defaults + process env + node option environment variables + `.env` files + config files
						+ extension hooks.
					</div>
				</div>
				<div style={{ background: '#4b84e0', borderRadius: '8px', padding: '10px 12px' }}>
					<strong>Environment Expansion</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						`@text:` and `@json:` environment values are expanded from local files at startup.
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
					<strong>Config Builders</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						engine and engine-server builders transform environment values into typed runtime
						config.
					</div>
				</div>
				<div style={{ background: '#f6aa42', borderRadius: '8px', padding: '10px 12px' }}>
					<strong>Runtime Assembly</strong>
					<div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
						node start creates engine and server, configures context IDs, and boots full runtime.
					</div>
				</div>
			</div>
		</div>
	);
}
