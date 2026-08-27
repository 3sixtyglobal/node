const bg = '#F8F9FB';
const surface = '#FFFFFF';
const border = '#E2E8F0';
const textPrimary = '#1E293B';
const textMuted = '#64748B';

const roles = {
	globalAdmin:  { label: 'global-admin',  bg: '#EDE9FE', color: '#5B21B6', border: '#C4B5FD' },
	identityAdmin:{ label: 'identity-admin', bg: '#E0F2FE', color: '#0369A1', border: '#BAE6FD' },
	userAdmin:    { label: 'user-admin',     bg: '#CCFBF1', color: '#0F766E', border: '#99F6E4' },
	devops:       { label: 'devops',         bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
	tenantAdmin:  { label: 'tenant-admin',   bg: '#F3E8FF', color: '#6D28D9', border: '#DDD6FE' },
	user:         { label: 'user',           bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
};

const perms = {
	identity: { color: '#0369A1', bg: 'rgba(3,105,161,0.08)' },
	user:     { color: '#475569', bg: 'rgba(71,85,105,0.08)' },
	auth:     { color: '#0F766E', bg: 'rgba(15,118,110,0.08)' },
	devops:   { color: '#92400E', bg: 'rgba(146,64,14,0.08)' },
	tenant:   { color: '#6D28D9', bg: 'rgba(109,40,217,0.08)' },
};

function RoleChip({ role, small }) {
	const r = roles[role];
	return (
		<span style={{
			display: 'inline-flex',
			alignItems: 'center',
			fontFamily: '"IBM Plex Mono", "Fira Mono", monospace',
			fontSize: small ? '11px' : '12px',
			fontWeight: 500,
			padding: small ? '2px 7px' : '3px 9px',
			borderRadius: '5px',
			background: r.bg,
			color: r.color,
			border: `1px solid ${r.border}`,
			whiteSpace: 'nowrap',
		}}>
			{r.label}
		</span>
	);
}

function PermChip({ ns, label }) {
	const p = perms[ns];
	return (
		<span style={{
			display: 'inline-flex',
			alignItems: 'center',
			fontFamily: '"IBM Plex Mono", "Fira Mono", monospace',
			fontSize: '11px',
			fontWeight: 500,
			padding: '2px 7px',
			borderRadius: '4px',
			background: p.bg,
			color: p.color,
			whiteSpace: 'nowrap',
		}}>
			{label}
		</span>
	);
}

export function RoleHierarchyDiagram() {
	const rowStyle = {
		display: 'flex',
		alignItems: 'center',
		gap: '10px',
		padding: '8px 0',
	};

	const connectorCol = {
		width: '32px',
		flexShrink: 0,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
	};

	const rows = [
		{ role: 'identityAdmin', last: false },
		{ role: 'userAdmin',     last: false },
		{ role: 'devops',        last: false, note: null },
		{ role: 'tenantAdmin',   last: false, note: 'multi-tenant mode only' },
		{ role: 'user',          last: true,  note: 'base authenticated role' },
	];

	return (
		<div style={{
			background: bg,
			border: `1px solid ${border}`,
			borderRadius: '10px',
			padding: '24px 28px',
			margin: '1rem 0 1.5rem',
			fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
		}}>
			<p style={{ margin: '0 0 4px', fontSize: '11px', fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: textMuted }}>
				Role Hierarchy
			</p>

			{/* global-admin root */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0 14px', borderBottom: `1px solid ${border}`, marginBottom: '6px' }}>
				<RoleChip role="globalAdmin" />
				<span style={{ fontSize: '12px', color: textMuted, fontFamily: '"IBM Plex Mono", monospace' }}>
					inherits all roles below
				</span>
			</div>

			{/* rows */}
			{rows.map(({ role, last, note }, i) => (
				<div key={role} style={rowStyle}>
					{/* tree connector */}
					<div style={{ ...connectorCol, position: 'relative', alignSelf: 'stretch' }}>
						{!last && (
							<div style={{
								position: 'absolute',
								left: '50%',
								top: 0,
								bottom: 0,
								width: '1px',
								background: border,
								transform: 'translateX(-50%)',
							}} />
						)}
						{last && (
							<div style={{
								position: 'absolute',
								left: '50%',
								top: 0,
								height: '50%',
								width: '1px',
								background: border,
								transform: 'translateX(-50%)',
							}} />
						)}
						<div style={{
							position: 'absolute',
							left: '50%',
							top: '50%',
							width: '14px',
							height: '1px',
							background: border,
						}} />
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
						<RoleChip role={role} />
						{role !== 'user' && (
							<span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: textMuted, fontFamily: '"IBM Plex Mono", monospace' }}>
								→ inherits <RoleChip role="user" small />
							</span>
						)}
						{note && (
							<span style={{ fontSize: '11px', color: textMuted, fontStyle: 'italic' }}>
								{note}
							</span>
						)}
					</div>
				</div>
			))}
		</div>
	);
}

export function PermissionNamespacesDiagram() {
	const namespaces = [
		{
			ns: 'identity',
			label: 'identity:*',
			desc: 'Identity and credential management',
			role: 'identityAdmin',
			items: [
				{ perm: 'identity:write', note: 'Create/remove DIDs, VCs, proofs; revoke/unrevoke credentials' },
				{ perm: 'user:read', note: 'Verify VC/presentation, resolve DID (verb fallback)', fallback: true },
			],
		},
		{
			ns: 'user',
			label: 'user:*',
			desc: 'Authenticated user operations and user administration',
			roles: ['user', 'userAdmin'],
			items: [
				{ perm: 'user:read',  note: 'Standard GET operations (verb fallback)', fallback: true },
				{ perm: 'user:write', note: 'Standard POST/PUT/PATCH/DELETE (verb fallback); inherits user:read', fallback: true },
				{ perm: 'user:read',  note: 'Admin get user, get by identity, profile admin get, audit query', role: 'userAdmin' },
				{ perm: 'user:write', note: 'Admin create/update/remove user, password reset, profile admin, audit; inherits user:read', role: 'userAdmin' },
			],
		},
		{
			ns: 'auth',
			label: 'authorization:*',
			desc: 'Authorization policy management',
			role: 'userAdmin',
			items: [
				{ perm: 'authorization:read',  note: 'Get policies, roles, role assignments, inheritances, check access' },
				{ perm: 'authorization:write', note: 'Build model, add/remove policies, role assignments, inheritances; inherits authorization:read' },
			],
		},
		{
			ns: 'devops',
			label: 'health:*  /  logging:*  /  tracing:*  /  telemetry:*',
			desc: 'Observability and infrastructure',
			role: 'devops',
			items: [
				{ perm: 'health:read',     note: 'Server health status' },
				{ perm: 'logging:read',    note: 'List log entries' },
				{ perm: 'logging:write',   note: 'Create log entries; inherits logging:read' },
				{ perm: 'tracing:read',    note: 'List spans, get traces' },
				{ perm: 'tracing:write',   note: 'Start and end spans; inherits tracing:read' },
				{ perm: 'telemetry:read',  note: 'Get metrics, list entries, get values' },
				{ perm: 'telemetry:write', note: 'Create/update/remove metrics, add values; inherits telemetry:read' },
			],
		},
		{
			ns: 'tenant',
			label: 'tenant:*',
			desc: 'Tenant administration',
			role: 'tenantAdmin',
			note: 'Seeded only when TWIN_TENANT_ENABLED=true',
			items: [
				{ perm: 'tenant:read',  note: 'List and get tenants' },
				{ perm: 'tenant:write', note: 'Create, update, and remove tenants; inherits tenant:read' },
			],
		},
	];

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			gap: '10px',
			margin: '1rem 0 1.5rem',
			fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
		}}>
			{namespaces.map(({ ns, label, desc, role, roles: multiRoles, items, note }) => {
				const p = perms[ns];
				return (
					<div key={ns} style={{
						background: bg,
						border: `1px solid ${border}`,
						borderRadius: '10px',
						overflow: 'hidden',
					}}>
						{/* header */}
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: '10px',
							padding: '10px 16px',
							borderBottom: `1px solid ${border}`,
							background: surface,
							flexWrap: 'wrap',
						}}>
							<span style={{
								fontFamily: '"IBM Plex Mono", "Fira Mono", monospace',
								fontSize: '12px',
								fontWeight: 500,
								color: p.color,
							}}>
								{label}
							</span>
							<span style={{ fontSize: '12px', color: textMuted }}>{desc}</span>
							{note && (
								<span style={{ fontSize: '11px', color: textMuted, fontStyle: 'italic' }}>{note}</span>
							)}
							<div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
								{multiRoles
									? multiRoles.map(r => <RoleChip key={r} role={r} small />)
									: <RoleChip role={role} small />
								}
							</div>
						</div>

						{/* permission rows */}
						<div style={{ padding: '4px 0' }}>
							{items.map((item, i) => (
								<div key={i} style={{
									display: 'grid',
									gridTemplateColumns: 'minmax(160px, auto) 1fr',
									gap: '12px',
									padding: '7px 16px',
									borderBottom: i < items.length - 1 ? `1px solid ${border}` : 'none',
									alignItems: 'center',
								}}>
									<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
										<PermChip ns={ns} label={item.perm} />
										{item.fallback && (
											<span style={{
												fontFamily: '"IBM Plex Mono", monospace',
												fontSize: '10px',
												color: textMuted,
												background: surface,
												border: `1px solid ${border}`,
												padding: '1px 5px',
												borderRadius: '10px',
											}}>
												verb fallback
											</span>
										)}
										{item.role && !item.fallback && (
											<RoleChip role={item.role} small />
										)}
									</div>
									<span style={{ fontSize: '12px', color: textMuted }}>{item.note}</span>
								</div>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}

export function VerbFallbackDiagram() {
	const methods = [
		{ method: 'GET', perm: 'user:read',  role: 'user', inherits: null },
		{ method: 'POST  /  PUT  /  PATCH  /  DELETE', perm: 'user:write', role: 'user', inherits: 'user:read' },
	];

	return (
		<div style={{
			background: bg,
			border: `1px solid ${border}`,
			borderRadius: '10px',
			overflow: 'hidden',
			margin: '1rem 0 1.5rem',
			fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
		}}>
			<div style={{
				display: 'grid',
				gridTemplateColumns: '1fr 1fr 1fr',
				background: surface,
				borderBottom: `1px solid ${border}`,
			}}>
				{['HTTP Method', 'Permission', 'Role'].map(h => (
					<div key={h} style={{
						padding: '8px 16px',
						fontFamily: '"IBM Plex Mono", monospace',
						fontSize: '10px',
						fontWeight: 500,
						letterSpacing: '0.06em',
						textTransform: 'uppercase',
						color: textMuted,
					}}>
						{h}
					</div>
				))}
			</div>
			{methods.map(({ method, perm, role, inherits }, i) => (
				<div key={i} style={{
					display: 'grid',
					gridTemplateColumns: '1fr 1fr 1fr',
					borderBottom: i < methods.length - 1 ? `1px solid ${border}` : 'none',
					alignItems: 'center',
				}}>
					<div style={{
						padding: '10px 16px',
						fontFamily: '"IBM Plex Mono", monospace',
						fontSize: '11px',
						color: textPrimary,
						whiteSpace: 'nowrap',
					}}>
						{method}
					</div>
					<div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
						<PermChip ns="user" label={perm} />
						{inherits && (
							<span style={{
								fontFamily: '"IBM Plex Mono", monospace',
								fontSize: '10px',
								color: textMuted,
								background: surface,
								border: `1px solid ${border}`,
								padding: '1px 5px',
								borderRadius: '10px',
								whiteSpace: 'nowrap',
							}}>
								inherits {inherits}
							</span>
						)}
					</div>
					<div style={{ padding: '10px 16px' }}>
						<RoleChip role="user" small />
					</div>
				</div>
			))}
		</div>
	);
}
