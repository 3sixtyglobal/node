export function PackageLayersDiagram() {
	return (
		<div>
			<style>{`
        .twin-arch {
          background: linear-gradient(135deg, #122457 0%, #0d1b43 50%, #102450 100%);
          border-radius: 14px;
          padding: 18px;
          color: #f8fbff;
          margin: 1rem 0 1.5rem;
        }

        .twin-arch h3 {
          margin: 0 0 14px;
          font-size: 1.5rem;
          color: #ffffff;
        }

        .twin-row {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 16px;
          border-radius: 12px;
          padding: 12px 14px;
          margin: 10px 0;
          border: 1px solid rgba(255, 255, 255, 0.22);
        }

        .twin-row-base {
          background: #e8e8ea;
          color: #091124;
        }

        .twin-row-connectors,
        .twin-row-dlt {
          background: #263f83;
          color: #f7faff;
        }

        .twin-row-blocks {
          background: #4b84e0;
          color: #071127;
        }

        .twin-row-engine,
        .twin-row-node,
        .twin-row-ui {
          background: #f6aa42;
          color: #091124;
        }

        .twin-row-apps {
          background: #fa7e07;
          color: #091124;
        }

        .twin-label {
          font-weight: 700;
          align-self: center;
          font-size: 1.02rem;
          line-height: 1.2;
        }

        .twin-cols {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px 16px;
        }

        .twin-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .twin-cols-1 {
          grid-template-columns: 1fr;
        }

        .twin-list {
          margin: 0;
          padding-left: 1.1rem;
        }

        .twin-list li {
          margin: 0.1rem 0;
          line-height: 1.3;
        }

        .twin-runtime {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        @media (max-width: 900px) {
          .twin-row {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .twin-cols,
          .twin-cols-2,
          .twin-runtime {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

			<div className="twin-arch">
				<div className="twin-row twin-row-base">
					<div className="twin-label">Base Layer</div>
					<div className="twin-cols twin-cols-2">
						<ul className="twin-list">
							<li>Fundamentals (Is, Guards, i18n)</li>
							<li>Cryptography</li>
							<li>Tools (TypeScript to Schema, TypeScript to OpenAPI)</li>
						</ul>
						<ul className="twin-list">
							<li>Standards (Schema.org, DID, ODRL, GS1, UN/CEFACT)</li>
							<li>Data (JSON-LD)</li>
							<li>API Core</li>
						</ul>
					</div>
				</div>

				<div className="twin-row twin-row-connectors">
					<div className="twin-label">Components, Connectors</div>
					<div className="twin-cols twin-cols-2">
						<ul className="twin-list">
							<li>Logging, Telemetry, Background Tasks, Event Bus</li>
							<li>Entity Storage (MySql, Mongo, Scylla, AWS, Azure, GCP)</li>
							<li>Blob Storage (IPFS, AWS, Azure, GCP)</li>
						</ul>
						<ul className="twin-list">
							<li>Messaging (AWS)</li>
							<li>Vault (Hashicorp)</li>
						</ul>
					</div>
				</div>

				<div className="twin-row twin-row-dlt">
					<div className="twin-label">DLT Connectors</div>
					<div className="twin-cols twin-cols-2">
						<ul className="twin-list">
							<li>Wallet / Gas Station</li>
							<li>Identity</li>
						</ul>
						<ul className="twin-list">
							<li>NFT</li>
							<li>Verifiable Storage</li>
						</ul>
					</div>
				</div>

				<div className="twin-row twin-row-blocks">
					<div className="twin-label">Building Blocks</div>
					<div className="twin-cols">
						<ul className="twin-list">
							<li>Auditable Item Graph</li>
							<li>Auditable Item Streams</li>
							<li>Document Management</li>
						</ul>
						<ul className="twin-list">
							<li>Attestation</li>
							<li>Immutable Proof</li>
							<li>Rights Management</li>
						</ul>
						<ul className="twin-list">
							<li>Data Processing</li>
							<li>Federated Catalogue</li>
							<li>Dataspace</li>
						</ul>
					</div>
				</div>

				<div className="twin-runtime">
					<div>
						<div className="twin-row twin-row-engine" style={{ margin: 0 }}>
							<div className="twin-label">Engine</div>
							<div className="twin-cols twin-cols-1">
								<ul className="twin-list">
									<li>Engine Core</li>
									<li>Engine Server (REST/WebSocket)</li>
								</ul>
							</div>
						</div>

						<div className="twin-row twin-row-node">
							<div className="twin-label">Node</div>
							<div className="twin-cols twin-cols-1">
								<ul className="twin-list">
									<li>Node Core</li>
									<li>Node</li>
								</ul>
							</div>
						</div>
					</div>

					<div className="twin-row twin-row-ui" style={{ margin: 0 }}>
						<div className="twin-label">UI</div>
						<div className="twin-cols twin-cols-1">
							<ul className="twin-list">
								<li>React UI Components</li>
								<li>Svelte UI Components</li>
								<li>Identity Components (Future)</li>
							</ul>
						</div>
					</div>
				</div>

				<div className="twin-row twin-row-apps" style={{ marginBottom: 0 }}>
					<div className="twin-label">Applications</div>
					<div className="twin-cols twin-cols-2">
						<ul className="twin-list">
							<li>Playground</li>
							<li>TWIN Identity</li>
						</ul>
						<ul className="twin-list">
							<li>Supply Chain App</li>
							<li>TLIP</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
