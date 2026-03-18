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

export function ContextIdFlowDiagram() {
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
				Context IDs: Async Propagation Through a Request
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
					<strong>Incoming Request</strong>
				</div>

				<div style={{ textAlign: 'center', color: '#aec6f0', lineHeight: 1.2 }}>▼</div>

				<div
					style={{
						background: '#1a3370',
						color: '#eef4ff',
						borderRadius: '8px',
						padding: '12px 14px',
						border: '1px dashed #4b84e0'
					}}
				>
					<div style={{ fontSize: '0.82rem', opacity: 0.8, marginBottom: '8px' }}>
						API server: <M>ContextIdStore.run(contextIds, handler)</M> — establishes async scope
					</div>

					<div style={{ display: 'grid', gap: '6px' }}>
						<div
							style={{
								background: '#263f83',
								color: '#f7faff',
								borderRadius: '6px',
								padding: '8px 10px'
							}}
						>
							<strong>TenantProcessor</strong>
							<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
								Resolves tenant from <M>x-api-key</M> (or query parameter fallback) and writes{' '}
								<M>contextIds.tenant</M>
							</div>
						</div>

						<div
							style={{
								background: '#263f83',
								color: '#f7faff',
								borderRadius: '6px',
								padding: '8px 10px'
							}}
						>
							<strong>AuthHeaderProcessor</strong>
							<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
								Verifies JWT and writes <M>contextIds.organization</M> (from <M>org</M> claim) and{' '}
								<M>contextIds.user</M> (from <M>sub</M> claim)
							</div>
						</div>

						<div
							style={{
								background: '#4b84e0',
								color: '#071127',
								borderRadius: '6px',
								padding: '8px 10px'
							}}
						>
							<strong>Route → Component → Connector</strong>
							<div style={{ marginTop: '3px', fontSize: '0.85rem' }}>
								Any code anywhere in the call stack calls <M>ContextIdStore.getContextIds()</M> to
								read the full active context — no parameter threading required
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function PartitionKeyDiagram() {
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
        .twin-pk-row {
          display: grid;
          grid-template-columns: 2fr auto 1.3fr auto 1.2fr;
          gap: 8px;
          align-items: center;
        }

        .twin-pk-arrow {
          text-align: center;
          color: #a0b8f0;
          font-size: 1.2rem;
        }

        @media (max-width: 700px) {
          .twin-pk-row {
            grid-template-columns: 1fr;
          }

          .twin-pk-arrow {
            transform: rotate(90deg);
          }
        }
      `}</style>
			<p style={{ margin: '0 0 12px', color: '#ffffff', fontWeight: 700 }}>
				Partition Key Derivation
			</p>
			<div style={{ display: 'grid', gap: '8px' }}>
				<div className="twin-pk-row">
					<div
						style={{
							background: '#263f83',
							color: '#f7faff',
							borderRadius: '6px',
							padding: '8px 10px'
						}}
					>
						<div style={{ fontSize: '0.78rem', opacity: 0.75 }}>node (full form)</div>
						<M>did:iota:0x8c3f4a5e...1f0a</M>
					</div>
					<div className="twin-pk-arrow">→</div>
					<div
						style={{
							background: '#4b84e0',
							color: '#071127',
							borderRadius: '6px',
							padding: '8px 10px',
							textAlign: 'center'
						}}
					>
						<div style={{ fontSize: '0.8rem', fontWeight: 600 }}>DidContextIdHandler</div>
						<div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
							extracts id segment, compacts hex to base64url
						</div>
					</div>
					<div className="twin-pk-arrow">→</div>
					<div
						style={{
							background: '#1a3370',
							color: '#eef4ff',
							borderRadius: '6px',
							padding: '8px 10px'
						}}
					>
						<div style={{ fontSize: '0.78rem', opacity: 0.75 }}>node (short form)</div>
						<M>jD9KXo2ae2x...</M>
					</div>
				</div>

				<div className="twin-pk-row">
					<div
						style={{
							background: '#263f83',
							color: '#f7faff',
							borderRadius: '6px',
							padding: '8px 10px'
						}}
					>
						<div style={{ fontSize: '0.78rem', opacity: 0.75 }}>tenant (full form)</div>
						<M>7f3a9c1e0b4d6f8a...4e6f</M>
					</div>
					<div className="twin-pk-arrow">→</div>
					<div
						style={{
							background: '#4b84e0',
							color: '#071127',
							borderRadius: '6px',
							padding: '8px 10px',
							textAlign: 'center'
						}}
					>
						<div style={{ fontSize: '0.8rem', fontWeight: 600 }}>TenantIdContextIdHandler</div>
						<div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
							converts 32-hex tenant id to base64url
						</div>
					</div>
					<div className="twin-pk-arrow">→</div>
					<div
						style={{
							background: '#1a3370',
							color: '#eef4ff',
							borderRadius: '6px',
							padding: '8px 10px'
						}}
					>
						<div style={{ fontSize: '0.78rem', opacity: 0.75 }}>tenant (short form)</div>
						<M>fzqcHgtNb4...</M>
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
					▼ <M>ContextIdHelper.combinedContextKey(...)</M> joins short forms with /
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
					<strong>Combined Partition Key</strong>
					<div style={{ marginTop: '5px' }}>
						<M>jD9KXo2ae2x.../fzqcHgtNb4...</M>
					</div>
					<div style={{ marginTop: '5px', fontSize: '0.85rem' }}>
						Used by connectors to isolate stored data by partition — entity storage includes it as a
						filter, blob storage prefixes keys with it
					</div>
				</div>
			</div>
		</div>
	);
}
