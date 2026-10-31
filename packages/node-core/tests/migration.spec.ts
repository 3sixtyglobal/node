// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { type AccountData, AccountDataHelper } from "@3sixty/api-auth-account-service";
import {
	AuthenticationAccountHelper,
	AuthenticationProviderFactory
} from "@3sixty/api-auth-models";
import type {
	AuditableItemGraphVertexIndex,
	AuditableItemGraphVertexV1
} from "@3sixty/auditable-item-graph-service";
import { initSchema as initSchemaAuditableItemGraph } from "@3sixty/auditable-item-graph-service";
import { ContextIdStore } from "@3sixty/context";
import { BaseError, ComponentFactory, Converter, Factory, Is, RandomHelper } from "@3sixty/core";
import { PasswordGenerator, Sha256 } from "@3sixty/crypto";
import { MemoryStateStorage } from "@3sixty/engine-core";
import {
	AuthenticationAdminComponentType,
	AuthenticationComponentType
} from "@3sixty/engine-server-types";
import {
	AuthorizationConnectorType,
	BackgroundTaskComponentType,
	EntityStorageComponentType,
	EntityStorageConnectorType,
	IdentityConnectorType,
	IdentityProfileConnectorType,
	LoggingComponentType,
	LoggingConnectorType,
	SchemaVersionMigrationComponentType,
	VaultConnectorType
} from "@3sixty/engine-types";
import type { IEntitySchemaProperty } from "@3sixty/entity";
import {
	ComparisonOperator,
	entity,
	EntitySchemaFactory,
	EntitySchemaHelper,
	EntitySchemaPropertyType,
	LogicalOperator,
	property
} from "@3sixty/entity";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import {
	EntityStorageConnectorFactory,
	SchemaMigrationFactory
} from "@3sixty/entity-storage-models";
import type { IIdentityComponent } from "@3sixty/identity-models";
import type { ILogEntry } from "@3sixty/logging-models";
import type { OdrlPolicyIndex, OdrlPolicyV0 } from "@3sixty/rights-management-pap-service";
import { initSchema as initSchemaPolicyAdministrationPoint } from "@3sixty/rights-management-pap-service";
import { CI_ENV_VARS, getFreePort } from "./setupTestEnv.js";
import { finalizeMigrations } from "../src/migration.js";
import type { INodeOptions } from "../src/models/INodeOptions.js";
import { run } from "../src/node.js";

@entity({ version: 0 })
class MigrationTestEntityV0 {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public legacyField!: string;

	@property({ type: "integer" })
	public score!: number;
}

@entity({ version: 1 })
class MigrationTestEntity {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public newField!: string;

	@property({ type: "array", itemType: "string", optional: true })
	public tags?: string[];
}

@entity({ version: 0 })
class MultiTenantMigTestEntityV0 {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public legacyField!: string;

	@property({ type: "integer" })
	public score!: number;
}

@entity({ version: 1 })
class MultiTenantMigTestEntity {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public newField!: string;

	@property({ type: "array", itemType: "string", optional: true })
	public tags?: string[];
}

@entity({ version: 0 })
class SparseMigTestEntityV0 {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public legacyField!: string;

	@property({ type: "integer" })
	public score!: number;
}

@entity({ version: 1 })
class SparseMigTestEntity {
	@property({ type: "string", isPrimary: true })
	public id!: string;

	@property({ type: "string" })
	public newField!: string;

	@property({ type: "array", itemType: "string", optional: true })
	public tags?: string[];
}

const LOCALES_DIR = "./dist/locales/";
const TEST_NODE_ID = "did:iota:0x1234";
const TEST_NODE_ORG_ID = "did:iota:0x456";
const TEST_TENANT_ID_A = "a1111111111111111111111111111111";
const TEST_TENANT_ID_B = "b2222222222222222222222222222222";

const BASE_ENV: { [id: string]: string } = {
	TWIN_SILENT: "true",
	TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
	TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage,
	TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
};

// The account and organization services issue membership credentials with the identity component.
const IDENTITY_ENV: { [id: string]: string } = {
	TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
	TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage
};

const MULTI_TENANT_BASE_ENV: { [id: string]: string } = {
	...BASE_ENV,
	TWIN_TENANT_ENABLED: "true"
};

describe("migration", () => {
	beforeAll(async () => {
		// All copies of ContextIdStore share one AsyncLocalStorage via globalThis.__TWIN_SHARED__.
		// MigrationHelper calls ContextIdStore.run({}, fn) for empty partitions on first start,
		// which replaces any outer context with {}. Spying on getStore() on the shared instance
		// intercepts that and returns a usable node context so partition-aware connectors
		// (e.g. Tenant with partitionContextIds: ["node"]) don't throw contextIdMissing.
		const storage = await ContextIdStore.getStorage();
		const realGetStore = storage.getStore.bind(storage);
		vi.spyOn(storage, "getStore").mockImplementation(() => {
			const ctx = realGetStore();
			return !ctx || Object.keys(ctx).length === 0 ? { node: TEST_NODE_ID } : ctx;
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("SchemaVersionService writes version records for all registered schemas on first node start", async () => {
		const port = await getFreePort();

		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const nodeRun = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(port) },
				extendConfig: async (unusedEnvVars, config) => {
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			try {
				const versionConnector = EntityStorageConnectorFactory.get("schema-version");
				const { entities } = await versionConnector.query();
				const rows = entities ?? [];

				expect(rows.some(r => (r as { schemaName: string }).schemaName === "SchemaVersion")).toBe(
					true
				);
				expect(rows.some(r => (r as { schemaName: string }).schemaName === "BackgroundTask")).toBe(
					true
				);
				expect(rows.every(r => (r as { version: number }).version >= 0)).toBe(true);
			} finally {
				await nodeRun?.shutdown();
			}
		});
	});

	test("Can migrate a custom entity schema from v0 to v1 when a node starts", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const MIGRATION_KEY = "MigrationTestEntity_0_1";
			const PORT_1 = await getFreePort();
			const PORT_2 = await getFreePort();

			EntitySchemaFactory.register("MigrationTestEntityV0", () =>
				EntitySchemaHelper.getSchema(MigrationTestEntityV0)
			);
			EntitySchemaFactory.register("MigrationTestEntity", () =>
				EntitySchemaHelper.getSchema(MigrationTestEntity)
			);
			SchemaMigrationFactory.register(MIGRATION_KEY, () => ({
				renames: [
					{ from: "legacyField", to: "newField" },
					{ from: "score", to: "tags" }
				],
				transformEntityProperty: (
					migrationEntity: unknown,
					fromProp: IEntitySchemaProperty,
					toProp: IEntitySchemaProperty,
					value: unknown
				) => {
					if (toProp.type === EntitySchemaPropertyType.Array) {
						return [`item:${value as number}`];
					}
				}
			}));

			// Run 1: start the node with schemaVersionMigration to initialise the schema-version
			// connector and all version records. After startup we reset MigrationTestEntity's version
			// record to v0 and seed v0 entity data so that run 2 triggers the real migration.
			const run1 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_1) },
				extendConfig: async (envVars, config) => {
					config.types.entityStorageComponent ??= [];
					config.types.entityStorageComponent.push({
						type: EntityStorageComponentType.Service,
						options: { entityStorageType: "MigrationTestEntity", partitionContextIds: [] }
					});
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			// Reset MigrationTestEntity's schema-version record to v0 so run 2 detects it as
			// needing migration, then seed three v0-shaped entity records (bypassing schema
			// validation which would reject the missing newField/tags fields).
			const svConnector = EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{
					schemaName: string;
					version: number;
				}>
			>("schema-version");
			const svRecords = await svConnector.getStore();
			const svRecord = svRecords.find(r => r.schemaName === "MigrationTestEntity");
			if (svRecord) {
				await svConnector.set({ ...svRecord, version: 0 });
			}

			// Seed v0-shaped entities via a connector that uses the v0 schema so that
			// EntityStorageHelper.prepareEntity does not strip legacyField/score.
			const seedConnector = new MemoryEntityStorageConnector<MigrationTestEntityV0>({
				entitySchema: "MigrationTestEntityV0",
				config: { storageKey: "migration-test-entity" }
			});
			await seedConnector.setBatch([
				{ id: "entity-1", legacyField: "old-value-1", score: 1 },
				{ id: "entity-2", legacyField: "old-value-2", score: 2 },
				{ id: "entity-3", legacyField: "old-value-3", score: 3 }
			]);

			// Shut down run 1 without clearing factories so the pre-seeded connectors persist.
			await run1?.shutdown();

			// Run 2: restart the node reusing the existing connectors from run 1. New connectors are
			// not created because EntityStorageConnectorFactory already has them registered - the
			// engine skips re-registration when a connector name is already present.
			// SchemaVersionService detects that MigrationTestEntity is at v0 but the schema is v1,
			// and runs the registered migration against the three pre-seeded entities.
			// The entity-storage logging connector (backed by memory) captures all migration lifecycle
			// messages so they can be asserted structurally without parsing console output.
			let run2;

			try {
				run2 = await run({
					localesDirectory: LOCALES_DIR,
					stateStorage: new MemoryStateStorage(false, {
						nodeId: TEST_NODE_ID,
						nodeOrganizationId: TEST_NODE_ORG_ID
					}),
					disableProcessExitOnFailure: true,
					envVars: {
						...BASE_ENV,
						TWIN_PORT: String(PORT_2),
						TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
						TWIN_LOGGING_BATCH_SIZE: "1",
						TWIN_LOGGING_BATCH_FLUSH_INTERVAL: "0"
					},
					extendConfig: async (unusedEnvVars2, config) => {
						// Override the engine's internal "engine-logging-service" so that migration
						// lifecycle messages are routed to the entity-storage log-entry connector
						// instead of the default SilentLoggingConnector.
						// initialiseTypeConfig runs after setupEngineLogger, so this registration
						// overwrites the silent one in ComponentFactory.
						const loggingComponent = config.types.loggingComponent?.find(
							c => c.type === LoggingComponentType.Service
						);
						if (loggingComponent) {
							loggingComponent.overrideInstanceType = "engine-logging-service";
						}
						config.types.entityStorageComponent ??= [];
						config.types.entityStorageComponent.push({
							type: EntityStorageComponentType.Service,
							options: { entityStorageType: "MigrationTestEntity", partitionContextIds: [] }
						});
						config.types.schemaVersionMigrationComponent = [
							{ type: SchemaVersionMigrationComponentType.Service }
						];
						config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
					}
				});

				// SchemaVersion record must show the migration reached version 1.
				const versionConnector = EntityStorageConnectorFactory.get("schema-version");
				const { entities: versionRecords } = await versionConnector.query();
				const migrationRecord = (versionRecords ?? []).find(
					r => (r as { schemaName: string }).schemaName === "MigrationTestEntity"
				) as { version: number } | undefined;
				expect(migrationRecord?.version).toBe(1);

				// All three entities must be migrated: legacyField → newField, score → tags array.
				const migratedConnector = EntityStorageConnectorFactory.get("migration-test-entity");
				const { entities } = await migratedConnector.query();
				expect(entities).toHaveLength(3);
				const sorted = (
					[...(entities ?? [])] as (MigrationTestEntity & MigrationTestEntityV0)[]
				).sort((a, b) => a.id.localeCompare(b.id));
				for (const [i, item] of sorted.entries()) {
					const n = i + 1;
					expect(item.id).toBe(`entity-${n}`);
					expect(item.newField).toBe(`old-value-${n}`);
					expect(item.tags).toEqual([`item:${n}`]);
					expect((item as unknown as { legacyField: unknown }).legacyField).toBeUndefined();
					expect((item as unknown as { score: unknown }).score).toBeUndefined();
				}

				// Query the log-entry entity storage connector (memory-backed) that was populated
				// during run 2's startup migration. batchSize:1 + batchIntervalMs:0 ensures every
				// log() call is written synchronously before run() returns.
				const logConnector = EntityStorageConnectorFactory.get("log-entry");
				const { entities: logEntries } = await logConnector.query();
				const entries = (logEntries ?? []) as ILogEntry[];

				// Migration lifecycle messages.
				for (const key of ["migrationRequired", "migrateSchemaStarting", "migrateSchemaComplete"]) {
					expect(
						entries.some(e => e.message === key),
						`log entry "${key}" missing`
					).toBe(true);
				}

				// All six partition progress messages.
				for (const key of [
					"partitionStart",
					"partitionProgress",
					"partitionEnd",
					"partitionItemsStart",
					"partitionItemsProgress",
					"partitionItemsEnd"
				]) {
					expect(
						entries.some(e => e.data?.progressItem === key),
						`progress entry "${key}" missing`
					).toBe(true);
				}

				// Counts: one partition (partitionContextIds: [] → single default context),
				// three seeded entities migrated in a single batch.
				const byProgress = (key: string): { [k: string]: unknown } | undefined =>
					entries.find(e => e.data?.progressItem === key)?.data;
				expect(byProgress("partitionStart")?.itemTotal).toBe(1);
				expect(byProgress("partitionEnd")?.itemIndex).toBe(1);
				expect(byProgress("partitionItemsStart")?.itemTotal).toBe(3);
				expect(byProgress("partitionItemsEnd")?.itemTotal).toBe(3);
				expect(byProgress("partitionItemsEnd")?.itemIndex).toBe(3);
			} finally {
				await run2?.shutdown();
				try {
					SchemaMigrationFactory.unregister(MIGRATION_KEY);
				} catch {
					// Ignore if already removed.
				}
			}
		});
	});
});

describe("migration - multi-tenant", () => {
	beforeAll(async () => {
		// Return a context with both node and tenant keys when the store is empty so that
		// startup paths calling ContextIdStore.run({}, fn) don't leave tenant-partitioned
		// connectors without their required context IDs.
		const storage = await ContextIdStore.getStorage();
		const realGetStore = storage.getStore.bind(storage);
		vi.spyOn(storage, "getStore").mockImplementation(() => {
			const ctx = realGetStore();
			return !ctx || Object.keys(ctx).length === 0
				? { node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A }
				: ctx;
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("SchemaVersionService writes version records for all registered schemas in multi-tenant mode", async () => {
		const port = await getFreePort();

		await ContextIdStore.run({ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A }, async () => {
			const nodeRun = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
				disableProcessExitOnFailure: true,
				envVars: { ...MULTI_TENANT_BASE_ENV, TWIN_PORT: String(port) },
				extendConfig: async (unusedEnvVars, config) => {
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			try {
				const versionConnector = EntityStorageConnectorFactory.get("schema-version");
				const { entities } = await versionConnector.query();
				const rows = entities ?? [];

				expect(rows.some(r => (r as { schemaName: string }).schemaName === "SchemaVersion")).toBe(
					true
				);
				expect(rows.some(r => (r as { schemaName: string }).schemaName === "BackgroundTask")).toBe(
					true
				);
				expect(rows.every(r => (r as { version: number }).version >= 0)).toBe(true);
			} finally {
				await nodeRun?.shutdown();
			}
		});
	});

	test("Migrates entity data across two tenant partitions independently", async () => {
		const MIGRATION_KEY = "MultiTenantMigTestEntity_0_1";
		const PORT_1 = await getFreePort();
		const PORT_2 = await getFreePort();

		EntitySchemaFactory.register("MultiTenantMigTestEntityV0", () =>
			EntitySchemaHelper.getSchema(MultiTenantMigTestEntityV0)
		);
		EntitySchemaFactory.register("MultiTenantMigTestEntity", () =>
			EntitySchemaHelper.getSchema(MultiTenantMigTestEntity)
		);
		SchemaMigrationFactory.register(MIGRATION_KEY, () => ({
			renames: [
				{ from: "legacyField", to: "newField" },
				{ from: "score", to: "tags" }
			],
			transformEntityProperty: (
				migrationEntity: unknown,
				fromProp: IEntitySchemaProperty,
				toProp: IEntitySchemaProperty,
				value: unknown
			) => {
				if (toProp.type === EntitySchemaPropertyType.Array) {
					return [`item:${value as number}`];
				}
			}
		}));

		// Run 1: initialise schema-version records then back-date the entity to v0.
		const run1 = await run({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
			disableProcessExitOnFailure: true,
			envVars: { ...MULTI_TENANT_BASE_ENV, TWIN_PORT: String(PORT_1) },
			extendConfig: async (unusedEnvVars, config) => {
				config.types.entityStorageComponent ??= [];
				config.types.entityStorageComponent.push({
					type: EntityStorageComponentType.Service,
					options: {
						entityStorageType: "MultiTenantMigTestEntity",
						partitionContextIds: ["node", "tenant"]
					}
				});
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			}
		});

		// Back-date the schema-version record to v0 so run 2 detects it as needing migration.
		const svConnector = EntityStorageConnectorFactory.get<
			MemoryEntityStorageConnector<{
				schemaName: string;
				version: number;
			}>
		>("schema-version");
		const svRecords = await svConnector.getStore();
		const svRecord = svRecords.find(r => r.schemaName === "MultiTenantMigTestEntity");
		if (svRecord) {
			await svConnector.set({ ...svRecord, version: 0 });
		}

		// Seed 3 v0 entities for tenant A under its partition context.
		await ContextIdStore.run({ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A }, async () => {
			const seedConnector = new MemoryEntityStorageConnector<MultiTenantMigTestEntityV0>({
				entitySchema: "MultiTenantMigTestEntityV0",
				partitionContextIds: ["node", "tenant"],
				config: { storageKey: "multi-tenant-mig-test-entity" }
			});
			await seedConnector.setBatch([
				{ id: "entity-a1", legacyField: "a-value-1", score: 10 },
				{ id: "entity-a2", legacyField: "a-value-2", score: 20 },
				{ id: "entity-a3", legacyField: "a-value-3", score: 30 }
			]);
		});

		// Seed 2 v0 entities for tenant B under its own partition context.
		await ContextIdStore.run({ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_B }, async () => {
			const seedConnector = new MemoryEntityStorageConnector<MultiTenantMigTestEntityV0>({
				entitySchema: "MultiTenantMigTestEntityV0",
				partitionContextIds: ["node", "tenant"],
				config: { storageKey: "multi-tenant-mig-test-entity" }
			});
			await seedConnector.setBatch([
				{ id: "entity-b1", legacyField: "b-value-1", score: 100 },
				{ id: "entity-b2", legacyField: "b-value-2", score: 200 }
			]);
		});

		await run1?.shutdown();

		// Run 2: restart. SchemaVersionService detects v0 → v1 migration needed.
		// getPartitionContextIds() returns [{node,tenant:A},{node,tenant:B}].
		// Migration runs once per tenant partition independently.
		let run2;
		try {
			run2 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
				disableProcessExitOnFailure: true,
				envVars: { ...MULTI_TENANT_BASE_ENV, TWIN_PORT: String(PORT_2) },
				extendConfig: async (unusedEnvVars2, config) => {
					config.types.entityStorageComponent ??= [];
					config.types.entityStorageComponent.push({
						type: EntityStorageComponentType.Service,
						options: {
							entityStorageType: "MultiTenantMigTestEntity",
							partitionContextIds: ["node", "tenant"]
						}
					});
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			// Schema-version record must show migration reached version 1.
			const versionConnector = EntityStorageConnectorFactory.get("schema-version");
			const { entities: versionRecords } = await versionConnector.query();
			const migrationRecord = (versionRecords ?? []).find(
				r => (r as { schemaName: string }).schemaName === "MultiTenantMigTestEntity"
			) as { version: number } | undefined;
			expect(migrationRecord?.version).toBe(1);

			// Tenant A: all 3 entities migrated, old fields removed.
			const connector = EntityStorageConnectorFactory.get("multi-tenant-mig-test-entity");
			const { entities: entitiesA } = await ContextIdStore.run(
				{ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A },
				async () => connector.query()
			);
			expect(entitiesA).toHaveLength(3);
			const sortedA = (
				[...(entitiesA ?? [])] as (MultiTenantMigTestEntity & MultiTenantMigTestEntityV0)[]
			).sort((a, b) => a.id.localeCompare(b.id));
			const scoresA = [10, 20, 30];
			for (const [i, item] of sortedA.entries()) {
				const n = i + 1;
				expect(item.id).toBe(`entity-a${n}`);
				expect(item.newField).toBe(`a-value-${n}`);
				expect(item.tags).toEqual([`item:${scoresA[i]}`]);
				expect((item as unknown as { legacyField: unknown }).legacyField).toBeUndefined();
				expect((item as unknown as { score: unknown }).score).toBeUndefined();
			}

			// Tenant B: both 2 entities migrated, and isolated from tenant A's data.
			const { entities: entitiesB } = await ContextIdStore.run(
				{ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_B },
				async () => connector.query()
			);
			expect(entitiesB).toHaveLength(2);
			const sortedB = (
				[...(entitiesB ?? [])] as (MultiTenantMigTestEntity & MultiTenantMigTestEntityV0)[]
			).sort((a, b) => a.id.localeCompare(b.id));
			const scoresB = [100, 200];
			for (const [i, item] of sortedB.entries()) {
				const n = i + 1;
				expect(item.id).toBe(`entity-b${n}`);
				expect(item.newField).toBe(`b-value-${n}`);
				expect(item.tags).toEqual([`item:${scoresB[i]}`]);
				expect((item as unknown as { legacyField: unknown }).legacyField).toBeUndefined();
				expect((item as unknown as { score: unknown }).score).toBeUndefined();
			}

			// Migration ran across exactly 2 partitions (one per tenant that has data).
			// getPartitionContextIds() is called on the post-migration connector registered by
			// SchemaVersionService - the safest way to assert partition count without touching
			// the "log-entry" SharedObjectBuffer, which may be contaminated by earlier single-tenant runs.
			const migratedConnector = EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<MultiTenantMigTestEntity>
			>("multi-tenant-mig-test-entity");
			const partitions = await migratedConnector.getPartitionContextIds();
			expect(partitions, "both tenant partitions discovered").toHaveLength(2);
		} finally {
			await run2?.shutdown();
			try {
				SchemaMigrationFactory.unregister(MIGRATION_KEY);
			} catch {
				// Ignore if already removed.
			}
		}
	});

	test("Migration skips tenant partitions with no entity data", async () => {
		const MIGRATION_KEY = "SparseMigTestEntity_0_1";
		const PORT_1 = await getFreePort();
		const PORT_2 = await getFreePort();

		EntitySchemaFactory.register("SparseMigTestEntityV0", () =>
			EntitySchemaHelper.getSchema(SparseMigTestEntityV0)
		);
		EntitySchemaFactory.register("SparseMigTestEntity", () =>
			EntitySchemaHelper.getSchema(SparseMigTestEntity)
		);
		SchemaMigrationFactory.register(MIGRATION_KEY, () => ({
			renames: [
				{ from: "legacyField", to: "newField" },
				{ from: "score", to: "tags" }
			],
			transformEntityProperty: (
				migrationEntity: unknown,
				fromProp: IEntitySchemaProperty,
				toProp: IEntitySchemaProperty,
				value: unknown
			) => {
				if (toProp.type === EntitySchemaPropertyType.Array) {
					return [`item:${value as number}`];
				}
			}
		}));

		// Run 1: initialise schema-version records, then back-date entity to v0.
		const run1 = await run({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
			disableProcessExitOnFailure: true,
			envVars: { ...MULTI_TENANT_BASE_ENV, TWIN_PORT: String(PORT_1) },
			extendConfig: async (unusedEnvVars, config) => {
				config.types.entityStorageComponent ??= [];
				config.types.entityStorageComponent.push({
					type: EntityStorageComponentType.Service,
					options: {
						entityStorageType: "SparseMigTestEntity",
						partitionContextIds: ["node", "tenant"]
					}
				});
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			}
		});

		// Back-date to v0.
		const svConnector = EntityStorageConnectorFactory.get<
			MemoryEntityStorageConnector<{
				schemaName: string;
				version: number;
			}>
		>("schema-version");
		const svRecords = await svConnector.getStore();
		const svRecord = svRecords.find(r => r.schemaName === "SparseMigTestEntity");
		if (svRecord) {
			await svConnector.set({ ...svRecord, version: 0 });
		}

		// Seed 1 entity ONLY for tenant A. Tenant B has no data for this entity type.
		await ContextIdStore.run({ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A }, async () => {
			const seedConnector = new MemoryEntityStorageConnector<SparseMigTestEntityV0>({
				entitySchema: "SparseMigTestEntityV0",
				partitionContextIds: ["node", "tenant"],
				config: { storageKey: "sparse-mig-test-entity" }
			});
			await seedConnector.setBatch([{ id: "entity-a1", legacyField: "only-a", score: 42 }]);
		});

		await run1?.shutdown();

		// Run 2: only tenant A's partition exists - tenant B is skipped entirely.
		let run2;
		try {
			run2 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, { nodeId: TEST_NODE_ID }),
				disableProcessExitOnFailure: true,
				envVars: { ...MULTI_TENANT_BASE_ENV, TWIN_PORT: String(PORT_2) },
				extendConfig: async (unusedEnvVars2, config) => {
					config.types.entityStorageComponent ??= [];
					config.types.entityStorageComponent.push({
						type: EntityStorageComponentType.Service,
						options: {
							entityStorageType: "SparseMigTestEntity",
							partitionContextIds: ["node", "tenant"]
						}
					});
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			// Schema-version bumped to 1.
			const versionConnector = EntityStorageConnectorFactory.get("schema-version");
			const { entities: versionRecords } = await versionConnector.query();
			const migrationRecord = (versionRecords ?? []).find(
				r => (r as { schemaName: string }).schemaName === "SparseMigTestEntity"
			) as { version: number } | undefined;
			expect(migrationRecord?.version).toBe(1);

			// Tenant A's single entity migrated correctly.
			const connector = EntityStorageConnectorFactory.get("sparse-mig-test-entity");
			const { entities: entitiesA } = await ContextIdStore.run(
				{ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A },
				async () => connector.query()
			);
			expect(entitiesA).toHaveLength(1);
			const item = (entitiesA ?? [])[0] as SparseMigTestEntity & SparseMigTestEntityV0;
			expect(item.id).toBe("entity-a1");
			expect(item.newField).toBe("only-a");
			expect(item.tags).toEqual(["item:42"]);
			expect((item as unknown as { legacyField: unknown }).legacyField).toBeUndefined();

			// Tenant B has no entities - it was never seeded.
			const { entities: entitiesB } = await ContextIdStore.run(
				{ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_B },
				async () => connector.query()
			);
			expect(entitiesB ?? []).toHaveLength(0);

			// Only 1 partition discovered - tenant B has no data and is never touched.
			const migratedConnector =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<SparseMigTestEntity>>(
					"sparse-mig-test-entity"
				);
			const partitions = await migratedConnector.getPartitionContextIds();
			expect(partitions, "only tenant A partition discovered").toHaveLength(1);
		} finally {
			await run2?.shutdown();
			try {
				SchemaMigrationFactory.unregister(MIGRATION_KEY);
			} catch {
				// Ignore if already removed.
			}
		}
	});
});

describe("migration - index rebuilds", () => {
	beforeAll(async () => {
		// See the note in the "migration" suite - MigrationHelper calls ContextIdStore.run({}, fn)
		// for empty partitions, which would otherwise leave partition-aware connectors without a
		// node context.
		const storage = await ContextIdStore.getStorage();
		const realGetStore = storage.getStore.bind(storage);
		vi.spyOn(storage, "getStore").mockImplementation(() => {
			const ctx = realGetStore();
			return !ctx || Object.keys(ctx).length === 0 ? { node: TEST_NODE_ID } : ctx;
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("Rebuilds the auditable item graph vertex indexes when migrating a vertex from v1 to v2", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const PORT_1 = await getFreePort();
			const PORT_2 = await getFreePort();

			// Registers AuditableItemGraphVertex (v2), its v0/v1 history and the new index entity,
			// so SchemaVersionService resolves the v1 to v2 step against the real schemas.
			initSchemaAuditableItemGraph();

			const extendConfig = async (
				unusedEnvVars: unknown,
				config: { types: { [id: string]: unknown[] | undefined } }
			): Promise<void> => {
				config.types.entityStorageComponent ??= [];
				config.types.entityStorageComponent.push(
					{
						type: EntityStorageComponentType.Service,
						options: { entityStorageType: "AuditableItemGraphVertex", partitionContextIds: [] }
					},
					{
						type: EntityStorageComponentType.Service,
						options: {
							entityStorageType: "AuditableItemGraphVertexIndex",
							partitionContextIds: []
						}
					}
				);
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			};

			// Run 1: bring the storage and the schema-version records up, then back-date the vertex
			// record to v1 and seed v1-shaped vertices so run 2 performs the real migration.
			const run1 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_1) },
				extendConfig
			});

			const svConnector = EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{
					schemaName: string;
					version: number;
				}>
			>("schema-version");
			const svRecords = await svConnector.getStore();
			const svRecord = svRecords.find(r => r.schemaName === "AuditableItemGraphVertex");
			expect(svRecord?.version, "vertex schema registered at v2").toBe(2);
			if (svRecord) {
				await svConnector.set({ ...svRecord, version: 1 });
			}

			// Seed through the v1 schema so the pipe delimited indexes are not stripped.
			// The first vertex exercises case folding on the vertex id, the multi-value alias index
			// and the resource type index. The second carries neither index, proving a vertex which
			// had nothing to index still gets its own entry.
			const seedConnector = new MemoryEntityStorageConnector<AuditableItemGraphVertexV1>({
				entitySchema: "AuditableItemGraphVertexV1",
				config: { storageKey: "auditable-item-graph-vertex" }
			});
			await seedConnector.setBatch([
				{
					id: "vertex-AAA",
					organizationIdentity: TEST_NODE_ORG_ID,
					dateCreated: "2026-01-01T00:00:00.000Z",
					dateModified: "2026-01-02T00:00:00.000Z",
					aliasIndex: "||alias-one||Alias-Two||",
					resourceTypeIndex: "||Note||"
				},
				{
					id: "vertex-bbb",
					organizationIdentity: TEST_NODE_ORG_ID,
					dateCreated: "2026-02-01T00:00:00.000Z"
				}
			]);

			await run1?.shutdown();

			let run2;
			try {
				run2 = await run({
					localesDirectory: LOCALES_DIR,
					stateStorage: new MemoryStateStorage(false, {
						nodeId: TEST_NODE_ID,
						nodeOrganizationId: TEST_NODE_ORG_ID
					}),
					disableProcessExitOnFailure: true,
					envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_2) },
					extendConfig
				});

				const versionConnector = EntityStorageConnectorFactory.get("schema-version");
				const { entities: versionRecords } = await versionConnector.query();
				const migrationRecord = (versionRecords ?? []).find(
					r => (r as { schemaName: string }).schemaName === "AuditableItemGraphVertex"
				) as { version: number } | undefined;
				expect(migrationRecord?.version).toBe(2);

				// The vertices themselves must have dropped the old columns.
				const vertexConnector = EntityStorageConnectorFactory.get("auditable-item-graph-vertex");
				const { entities: vertices } = await vertexConnector.query();
				expect(vertices).toHaveLength(2);
				for (const vertex of vertices ?? []) {
					expect((vertex as { aliasIndex?: string }).aliasIndex).toBeUndefined();
					expect((vertex as { resourceTypeIndex?: string }).resourceTypeIndex).toBeUndefined();
				}

				const indexConnector = EntityStorageConnectorFactory.get(
					"auditable-item-graph-vertex-index"
				);
				const { entities: indexEntities } = await indexConnector.query();
				const rows = (indexEntities ?? []) as AuditableItemGraphVertexIndex[];

				// 4 entries for the first vertex (itself, two aliases, one resource type) and 1 for
				// the second. Every entry carries its own id, which is what keeps two vertices
				// sharing an alias or a resource type from overwriting each other.
				expect(rows).toHaveLength(5);
				expect(new Set(rows.map(r => r.id)).size, "index entry ids are unique").toBe(5);

				const firstVertexRows = rows.filter(r => r.vertexId === "vertex-AAA");
				expect(firstVertexRows).toHaveLength(4);
				expect(firstVertexRows.map(r => `${r.type}:${r.value}`).sort()).toEqual([
					"alias:alias-one",
					"alias:alias-two",
					"resourceType:note",
					"vertex:vertex-aaa"
				]);
				for (const row of firstVertexRows) {
					expect(row.dateCreated).toBe("2026-01-01T00:00:00.000Z");
					expect(row.dateModified).toBe("2026-01-02T00:00:00.000Z");
				}

				// A vertex with no aliases and no resources still gets its own entry, and its
				// modified date falls back to the creation date so both can be paged the same way.
				const secondVertexRows = rows.filter(r => r.vertexId === "vertex-bbb");
				expect(secondVertexRows).toHaveLength(1);
				expect(secondVertexRows[0].type).toBe("vertex");
				expect(secondVertexRows[0].value).toBe("vertex-bbb");
				expect(secondVertexRows[0].dateCreated).toBe("2026-02-01T00:00:00.000Z");
				expect(secondVertexRows[0].dateModified).toBe("2026-02-01T00:00:00.000Z");
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Rebuilds the policy administration point indexes when migrating a policy from v0 to v1", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const PORT_1 = await getFreePort();
			const PORT_2 = await getFreePort();

			// Registers OdrlPolicy (v1), its v0 history and the new index entity.
			initSchemaPolicyAdministrationPoint();

			const extendConfig = async (
				unusedEnvVars: unknown,
				config: { types: { [id: string]: unknown[] | undefined } }
			): Promise<void> => {
				config.types.entityStorageComponent ??= [];
				config.types.entityStorageComponent.push(
					{
						type: EntityStorageComponentType.Service,
						options: { entityStorageType: "OdrlPolicy", partitionContextIds: [] }
					},
					{
						type: EntityStorageComponentType.Service,
						options: { entityStorageType: "OdrlPolicyIndex", partitionContextIds: [] }
					}
				);
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			};

			const run1 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_1) },
				extendConfig
			});

			const svConnector = EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{
					schemaName: string;
					version: number;
				}>
			>("schema-version");
			const svRecords = await svConnector.getStore();
			const svRecord = svRecords.find(r => r.schemaName === "OdrlPolicy");
			expect(svRecord?.version, "policy schema registered at v1").toBe(1);
			if (svRecord) {
				await svConnector.set({ ...svRecord, version: 0 });
			}

			// The first policy exercises case folding and de-duplication on the assigner dimension
			// and the cartesian product across assignee and action. The second has no values in any
			// dimension, and the third has no creation date.
			const seedConnector = new MemoryEntityStorageConnector<OdrlPolicyV0>({
				entitySchema: "OdrlPolicyV0",
				config: { storageKey: "odrl-policy" }
			});
			await seedConnector.setBatch([
				{
					id: "policy-1",
					type: "Set",
					dateCreated: "2026-03-01T00:00:00.000Z",
					assignerIndex: "|DID:A|did:a|",
					assigneeIndex: "|did:b|did:c|",
					targetIndex: "|urn:t1|",
					actionIndex: "|use|read|"
				},
				{
					id: "policy-2",
					type: "Offer",
					dateCreated: "2026-04-01T00:00:00.000Z",
					assignerIndex: "||",
					assigneeIndex: "||",
					targetIndex: "||",
					actionIndex: "||"
				},
				{
					id: "policy-3",
					type: "Agreement",
					assignerIndex: "|did:d|",
					assigneeIndex: "||",
					targetIndex: "||",
					actionIndex: "||"
				}
			]);

			await run1?.shutdown();

			let run2;
			try {
				run2 = await run({
					localesDirectory: LOCALES_DIR,
					stateStorage: new MemoryStateStorage(false, {
						nodeId: TEST_NODE_ID,
						nodeOrganizationId: TEST_NODE_ORG_ID
					}),
					disableProcessExitOnFailure: true,
					envVars: { ...BASE_ENV, TWIN_PORT: String(PORT_2) },
					extendConfig
				});

				const versionConnector = EntityStorageConnectorFactory.get("schema-version");
				const { entities: versionRecords } = await versionConnector.query();
				const migrationRecord = (versionRecords ?? []).find(
					r => (r as { schemaName: string }).schemaName === "OdrlPolicy"
				) as { version: number } | undefined;
				expect(migrationRecord?.version).toBe(1);

				// The policies themselves must have dropped the four pipe delimited columns.
				const policyConnector = EntityStorageConnectorFactory.get("odrl-policy");
				const { entities: policies } = await policyConnector.query();
				expect(policies).toHaveLength(3);
				for (const policy of policies ?? []) {
					for (const column of ["assignerIndex", "assigneeIndex", "targetIndex", "actionIndex"]) {
						expect((policy as { [id: string]: unknown })[column]).toBeUndefined();
					}
				}

				const indexConnector = EntityStorageConnectorFactory.get("odrl-policy-index");
				const { entities: indexEntities } = await indexConnector.query();
				const rows = (indexEntities ?? []) as OdrlPolicyIndex[];

				expect(rows).toHaveLength(6);
				expect(new Set(rows.map(r => r.id)).size, "index entry ids are unique").toBe(6);

				// One entry per combination: 1 assigner x 2 assignees x 1 target x 2 actions.
				const firstPolicyRows = rows.filter(r => r.policyId === "policy-1");
				expect(firstPolicyRows).toHaveLength(4);
				expect(
					firstPolicyRows.map(r => [r.assigner, r.assignee, r.target, r.action].join(",")).sort()
				).toEqual([
					"did:a,did:b,urn:t1,read",
					"did:a,did:b,urn:t1,use",
					"did:a,did:c,urn:t1,read",
					"did:a,did:c,urn:t1,use"
				]);
				for (const row of firstPolicyRows) {
					expect(row.dateCreated).toBe("2026-03-01T00:00:00.000Z");
				}

				// An absent dimension contributes a single undefined value rather than collapsing the
				// combinations, so a policy with nothing to index is still reachable by policy id.
				const secondPolicyRows = rows.filter(r => r.policyId === "policy-2");
				expect(secondPolicyRows).toHaveLength(1);
				expect(secondPolicyRows[0].assigner).toBeUndefined();
				expect(secondPolicyRows[0].assignee).toBeUndefined();
				expect(secondPolicyRows[0].target).toBeUndefined();
				expect(secondPolicyRows[0].action).toBeUndefined();
				expect(secondPolicyRows[0].dateCreated).toBe("2026-04-01T00:00:00.000Z");

				// A policy stored before the creation date was recorded is given the epoch, as the
				// index orders and pages on that column and a repeated run must produce the same entry.
				const thirdPolicyRows = rows.filter(r => r.policyId === "policy-3");
				expect(thirdPolicyRows).toHaveLength(1);
				expect(thirdPolicyRows[0].assigner).toBe("did:d");
				expect(thirdPolicyRows[0].assignee).toBeUndefined();
				expect(thirdPolicyRows[0].dateCreated).toBe("1970-01-01T00:00:00.000Z");
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Leaves one vertex index row per value when a failed migration is run again", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const PORT_1 = await getFreePort();
			const PORT_2 = await getFreePort();
			const PORT_3 = await getFreePort();

			initSchemaAuditableItemGraph();

			const extendConfig = async (
				unusedEnvVars: unknown,
				config: { types: { [id: string]: unknown[] | undefined } }
			): Promise<void> => {
				config.types.entityStorageComponent ??= [];
				config.types.entityStorageComponent.push(
					{
						type: EntityStorageComponentType.Service,
						options: { entityStorageType: "AuditableItemGraphVertex", partitionContextIds: [] }
					},
					{
						type: EntityStorageComponentType.Service,
						options: {
							entityStorageType: "AuditableItemGraphVertexIndex",
							partitionContextIds: []
						}
					}
				);
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			};

			const nodeOptions = (port: number): INodeOptions => ({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(port) },
				extendConfig
			});

			const run1 = await run(nodeOptions(PORT_1));

			const svConnector = EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{
					schemaName: string;
					version: number;
				}>
			>("schema-version");
			const svRecords = await svConnector.getStore();
			const svRecord = svRecords.find(r => r.schemaName === "AuditableItemGraphVertex");
			expect(svRecord?.version, "vertex schema registered at v2").toBe(2);
			if (svRecord) {
				await svConnector.set({ ...svRecord, version: 1 });
			}

			// The vertices are migrated in descending creation order, so the first vertex's rows are
			// in the live index when the second one fails on an alias longer than the index bound.
			const seedConnector = new MemoryEntityStorageConnector<AuditableItemGraphVertexV1>({
				entitySchema: "AuditableItemGraphVertexV1",
				config: { storageKey: "auditable-item-graph-vertex" }
			});
			await seedConnector.setBatch([
				{
					id: "vertex-retry",
					organizationIdentity: TEST_NODE_ORG_ID,
					dateCreated: "2026-06-01T00:00:00.000Z",
					dateModified: "2026-06-02T00:00:00.000Z",
					aliasIndex: "||alias-one||Alias-Two||",
					resourceTypeIndex: "||Note||"
				},
				{
					id: "vertex-long",
					organizationIdentity: TEST_NODE_ORG_ID,
					dateCreated: "2026-02-01T00:00:00.000Z",
					aliasIndex: `||${"a".repeat(300)}||`
				}
			]);

			await run1?.shutdown();

			// Run 2 fails on the over-length alias and names the vertex it belongs to.
			const failure = await run(nodeOptions(PORT_2)).catch((error: unknown) => error);
			expect(BaseError.someErrorMessage(failure, "entitySchemaHelper.maxLengthExceeded")).toBe(
				true
			);
			const writeFailure = BaseError.flatten(failure).find(
				e => e.message === "node.migrationIndexWriteFailed"
			);
			expect(writeFailure?.properties?.id).toBe("vertex-long");

			const indexConnector = new MemoryEntityStorageConnector<AuditableItemGraphVertexIndex>({
				entitySchema: "AuditableItemGraphVertexIndex",
				config: { storageKey: "auditable-item-graph-vertex-index" }
			});
			const failedRows = (await indexConnector.getStore()).filter(
				r => r.vertexId === "vertex-retry"
			);
			expect(failedRows, "rows of the migrated vertex remain after the failure").toHaveLength(4);

			// Shorten the alias through the v1 schema and run the migration again.
			await seedConnector.set({
				id: "vertex-long",
				organizationIdentity: TEST_NODE_ORG_ID,
				dateCreated: "2026-02-01T00:00:00.000Z",
				aliasIndex: "||alias-three||"
			});

			let run3;
			try {
				run3 = await run(nodeOptions(PORT_3));

				// The store is shared with the earlier tests, so only this test's vertices are read.
				const rows = (await indexConnector.getStore()).filter(
					r => r.vertexId === "vertex-retry" || r.vertexId === "vertex-long"
				);

				// The rows the failed run wrote for the first vertex are written again under the
				// same ids, so every value is indexed exactly once.
				expect(rows.map(r => `${r.vertexId}|${r.type}:${r.value}`).sort()).toEqual([
					"vertex-long|alias:alias-three",
					"vertex-long|vertex:vertex-long",
					"vertex-retry|alias:alias-one",
					"vertex-retry|alias:alias-two",
					"vertex-retry|resourceType:note",
					"vertex-retry|vertex:vertex-retry"
				]);
				expect(new Set(rows.map(r => r.id)).size, "index entry ids are unique").toBe(6);
			} finally {
				await run3?.shutdown();
			}
		});
	});

	test("Leaves one policy index row per combination when a failed migration is run again", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const PORT_1 = await getFreePort();
			const PORT_2 = await getFreePort();
			const PORT_3 = await getFreePort();

			initSchemaPolicyAdministrationPoint();

			const extendConfig = async (
				unusedEnvVars: unknown,
				config: { types: { [id: string]: unknown[] | undefined } }
			): Promise<void> => {
				config.types.entityStorageComponent ??= [];
				config.types.entityStorageComponent.push(
					{
						type: EntityStorageComponentType.Service,
						options: { entityStorageType: "OdrlPolicy", partitionContextIds: [] }
					},
					{
						type: EntityStorageComponentType.Service,
						options: { entityStorageType: "OdrlPolicyIndex", partitionContextIds: [] }
					}
				);
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			};

			const nodeOptions = (port: number): INodeOptions => ({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...BASE_ENV, TWIN_PORT: String(port) },
				extendConfig
			});

			const run1 = await run(nodeOptions(PORT_1));

			const svConnector = EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{
					schemaName: string;
					version: number;
				}>
			>("schema-version");
			const svRecords = await svConnector.getStore();
			const svRecord = svRecords.find(r => r.schemaName === "OdrlPolicy");
			expect(svRecord?.version, "policy schema registered at v1").toBe(1);
			if (svRecord) {
				await svConnector.set({ ...svRecord, version: 0 });
			}

			// The policies are migrated in descending creation order with the undated one first, so
			// the rows of the first two are in the live index when the third fails on an assigner
			// longer than the index bound. The undated one is stamped with the epoch on every run.
			const seedConnector = new MemoryEntityStorageConnector<OdrlPolicyV0>({
				entitySchema: "OdrlPolicyV0",
				config: { storageKey: "odrl-policy" }
			});
			await seedConnector.setBatch([
				{
					id: "policy-retry",
					type: "Set",
					dateCreated: "2026-06-01T00:00:00.000Z",
					assignerIndex: "|DID:A|did:a|",
					assigneeIndex: "|did:b|did:c|",
					targetIndex: "|urn:t1|",
					actionIndex: "|use|read|"
				},
				{
					id: "policy-undated",
					type: "Agreement",
					assignerIndex: "|did:d|",
					assigneeIndex: "||",
					targetIndex: "||",
					actionIndex: "||"
				},
				{
					id: "policy-long",
					type: "Set",
					dateCreated: "2026-05-01T00:00:00.000Z",
					assignerIndex: `|${"b".repeat(200)}|`,
					assigneeIndex: "||",
					targetIndex: "||",
					actionIndex: "||"
				}
			]);

			await run1?.shutdown();

			// Run 2 fails on the over-length assigner and names the policy it belongs to.
			const failure = await run(nodeOptions(PORT_2)).catch((error: unknown) => error);
			expect(BaseError.someErrorMessage(failure, "entitySchemaHelper.maxLengthExceeded")).toBe(
				true
			);
			const writeFailure = BaseError.flatten(failure).find(
				e => e.message === "node.migrationIndexWriteFailed"
			);
			expect(writeFailure?.properties?.id).toBe("policy-long");

			const indexConnector = new MemoryEntityStorageConnector<OdrlPolicyIndex>({
				entitySchema: "OdrlPolicyIndex",
				config: { storageKey: "odrl-policy-index" }
			});
			const failedRows = (await indexConnector.getStore()).filter(
				r => r.policyId === "policy-retry" || r.policyId === "policy-undated"
			);
			expect(failedRows, "rows of the migrated policies remain after the failure").toHaveLength(5);

			// Shorten the assigner through the v0 schema and run the migration again.
			await seedConnector.set({
				id: "policy-long",
				type: "Set",
				dateCreated: "2026-05-01T00:00:00.000Z",
				assignerIndex: "|did:e|",
				assigneeIndex: "||",
				targetIndex: "||",
				actionIndex: "||"
			});

			let run3;
			try {
				run3 = await run(nodeOptions(PORT_3));

				// The store is shared with the earlier tests, so only this test's policies are read.
				const rows = (await indexConnector.getStore()).filter(r =>
					["policy-retry", "policy-undated", "policy-long"].includes(r.policyId)
				);

				// The rows the failed run wrote are written again under the same ids, including the
				// undated policy.
				expect(
					rows
						.map(r => `${r.policyId}|${[r.assigner, r.assignee, r.target, r.action].join(",")}`)
						.sort()
				).toEqual([
					"policy-long|did:e,,,",
					"policy-retry|did:a,did:b,urn:t1,read",
					"policy-retry|did:a,did:b,urn:t1,use",
					"policy-retry|did:a,did:c,urn:t1,read",
					"policy-retry|did:a,did:c,urn:t1,use",
					"policy-undated|did:d,,,"
				]);
				expect(new Set(rows.map(r => r.id)).size, "index entry ids are unique").toBe(6);
			} finally {
				await run3?.shutdown();
			}
		});
	});
});

describe("migration - scope to roles", () => {
	beforeAll(async () => {
		const storage = await ContextIdStore.getStorage();
		const realGetStore = storage.getStore.bind(storage);
		vi.spyOn(storage, "getStore").mockImplementation(() => {
			const ctx = realGetStore();
			return !ctx || Object.keys(ctx).length === 0 ? { node: TEST_NODE_ID } : ctx;
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("Migrates V0 user scope to authorization role assignments on node start", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const PORT_1 = await getFreePort();
			const PORT_2 = await getFreePort();

			const AUTH_ENV: { [id: string]: string } = {
				...BASE_ENV,
				...IDENTITY_ENV,
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage
			};

			// Run 1: initialise schema-version records. After startup, back-date
			// AuthenticationUser to v0 and seed V0 users that carry a scope field.
			const run1 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...AUTH_ENV, TWIN_PORT: String(PORT_1) },
				extendConfig: async (unusedEnvVars, config) => {
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			// Back-date the AuthenticationUser schema-version record to v0 so run 2
			// detects it as needing migration.
			const svConnector =
				EntityStorageConnectorFactory.get<
					MemoryEntityStorageConnector<{ schemaName: string; version: number }>
				>("schema-version");
			const svRecords = await svConnector.getStore();
			const svRecord = svRecords.find(r => r.schemaName === "AuthenticationUser");
			if (svRecord) {
				await svConnector.set({ ...svRecord, version: 0 });
			}

			// Seed two V0 users with comma-separated scope fields. The V0 schema is used
			// so schema validation does not strip the scope property.
			// partitionContextIds must match the engine-created connector (["node"] in single-tenant).
			const seedConnector = new MemoryEntityStorageConnector<{
				email: string;
				password: string;
				salt: string;
				identity: string;
				organization: string;
				scope: string;
			}>({
				entitySchema: "AuthenticationUserV0",
				partitionContextIds: ["node"],
				config: { storageKey: "authentication-user" }
			});
			// Clear rows left by earlier tests, the memory connector keeps them when the primary key changes.
			await seedConnector.teardown();
			await seedConnector.setBatch([
				{
					email: "user1@test.com",
					password: "hashed1",
					salt: "salt1",
					identity: "did:twin:user1",
					organization: TEST_NODE_ORG_ID,
					scope: "global-admin,user-admin"
				},
				{
					email: "user2@test.com",
					password: "hashed2",
					salt: "salt2",
					identity: "did:twin:user2",
					organization: TEST_NODE_ORG_ID,
					scope: "tenant-admin"
				},
				{
					email: "user3@test.com",
					password: "hashed3",
					salt: "salt3",
					identity: "did:twin:user3",
					organization: TEST_NODE_ORG_ID,
					scope: ""
				}
			]);

			await run1?.shutdown();

			// Run 2: restart. SchemaVersionService detects AuthenticationUser v0 → v1.
			// The removeEntityProperty handler splits scope into roles and writes them to
			let run2;
			try {
				run2 = await run({
					localesDirectory: LOCALES_DIR,
					stateStorage: new MemoryStateStorage(false, {
						nodeId: TEST_NODE_ID,
						nodeOrganizationId: TEST_NODE_ORG_ID
					}),
					disableProcessExitOnFailure: true,
					envVars: { ...AUTH_ENV, TWIN_PORT: String(PORT_2) },
					extendConfig: async (unusedEnvVars2, config) => {
						config.types.schemaVersionMigrationComponent = [
							{ type: SchemaVersionMigrationComponentType.Service }
						];
						config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
					}
				});

				// AuthenticationUser schema version must have advanced through 1 to 2.
				const versionConnector = EntityStorageConnectorFactory.get("schema-version");
				const { entities: versionRecords } = await versionConnector.query();
				const migrationRecord = (versionRecords ?? []).find(
					r => (r as { schemaName: string }).schemaName === "AuthenticationUser"
				) as { version: number } | undefined;
				expect(migrationRecord?.version).toBe(2);

				// Migrated users must not carry the scope field, and become password accounts
				// keyed by a new account id with the identity and organization moved out.
				const userConnector = EntityStorageConnectorFactory.get("authentication-user");
				const { entities: allUsers } = await userConnector.query();
				// The memory connector migrates in place, so when the primary key changes the v1 rows,
				// keyed by e-mail, are left beside the migrated rows keyed by account id.
				const users = (allUsers ?? []).filter(u =>
					Is.stringValue((u as { accountId?: string }).accountId)
				);
				expect(users).toHaveLength(3);
				for (const user of users as {
					email: string;
					accountId?: string;
					authProviderId?: string;
					providerAccountId?: string;
					identity?: unknown;
					organization?: unknown;
					scope?: unknown;
				}[]) {
					expect(user.scope).toBeUndefined();
					expect(user.accountId).toEqual(expect.any(String));
					expect(user.authProviderId).toBe("entity-storage");
					expect(user.providerAccountId).toBe(user.email);
					expect(user.identity).toBeUndefined();
					expect(user.organization).toBeUndefined();
				}
				expect(new Set(users.map(u => (u as { accountId: string }).accountId)).size).toBe(3);

				// The identity and organization of each account must have moved to account data, the
				// identity under the id derived from its DID so a repeated run replaces it.
				const accountDataConnector = EntityStorageConnectorFactory.get("account-data");
				for (const user of users as { email: string; accountId: string }[]) {
					const did = `did:twin:${user.email.split("@")[0]}`;
					await expect(
						accountDataConnector.get(AccountDataHelper.identityId(did))
					).resolves.toMatchObject({
						accountId: user.accountId,
						type: "identity",
						data: { "@context": "https://www.w3.org/ns/did/v1", id: did },
						isDefault: true
					});
					const { entities: organizations } = await accountDataConnector.query({
						conditions: [
							{
								property: "accountId",
								value: user.accountId,
								comparison: ComparisonOperator.Equals
							},
							{ property: "type", value: "organization", comparison: ComparisonOperator.Equals }
						],
						logicalOperator: LogicalOperator.And
					});
					expect(organizations).toMatchObject([
						{
							data: {
								"@context": "https://schema.org",
								"@type": "Organization",
								identifier: TEST_NODE_ORG_ID
							},
							organization: TEST_NODE_ORG_ID,
							isDefault: true
						}
					]);
				}

				// Authorization role assignments must have been created for every scope entry.
				// user1: "global-admin,user-admin" → 2 assignments
				// user2: "tenant-admin" → 1 assignment
				// user3: "" (empty scope) → falls back to "user" → 1 assignment
				const roleConnector = EntityStorageConnectorFactory.get("authorization-role-assignment");
				const { entities: assignments } = await roleConnector.query();
				const rows = (assignments ?? []) as {
					id: string;
					modelId: string;
					subject: string;
					role: string;
				}[];

				// Roles are held by the account id the identity now belongs to.
				const accountIds: { [identity: string]: string } = {};
				for (const did of ["did:twin:user1", "did:twin:user2", "did:twin:user3"]) {
					const identityItem = (await accountDataConnector.get(
						AccountDataHelper.identityId(did)
					)) as { accountId: string } | undefined;
					accountIds[did] = identityItem?.accountId ?? "";
				}
				const findAssignment = (
					identity: string,
					role: string
				): { id: string; modelId: string; subject: string; role: string } | undefined =>
					rows.find(r => r.subject === accountIds[identity] && r.role === role);

				expect(rows).toHaveLength(4);
				expect(rows.some(r => r.subject.startsWith("did:"))).toBe(false);
				expect(findAssignment("did:twin:user1", "global-admin")).toBeDefined();
				expect(findAssignment("did:twin:user1", "user-admin")).toBeDefined();
				expect(findAssignment("did:twin:user2", "tenant-admin")).toBeDefined();
				expect(findAssignment("did:twin:user3", "user")).toBeDefined();

				// All assignments must use the default migration model ID.
				expect(rows.every(r => r.modelId === "system")).toBe(true);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Adds devops, identity-admin and identity-profile-admin when user has both tenant-admin and user-admin", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const PORT_1 = await getFreePort();
			const PORT_2 = await getFreePort();

			const AUTH_ENV: { [id: string]: string } = {
				...BASE_ENV,
				...IDENTITY_ENV,
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage
			};

			const run1 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...AUTH_ENV, TWIN_PORT: String(PORT_1) },
				extendConfig: async (unusedEnvVars, config) => {
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			// Clear stores from the previous test so migration only processes the user
			// seeded in this test and the assertion on role-assignment count is exact.
			const prevAuthConnector = EntityStorageConnectorFactory.get("authentication-user");
			const { entities: prevUsers } = await prevAuthConnector.query();
			for (const user of prevUsers ?? []) {
				await prevAuthConnector.remove((user as { email: string }).email);
			}
			const prevRoleConnector = EntityStorageConnectorFactory.get("authorization-role-assignment");
			const { entities: prevRoles } = await prevRoleConnector.query();
			for (const role of prevRoles ?? []) {
				await prevRoleConnector.remove((role as { id: string }).id);
			}

			const svConnector =
				EntityStorageConnectorFactory.get<
					MemoryEntityStorageConnector<{ schemaName: string; version: number }>
				>("schema-version");
			const svRecords = await svConnector.getStore();
			const svRecord = svRecords.find(r => r.schemaName === "AuthenticationUser");
			if (svRecord) {
				await svConnector.set({ ...svRecord, version: 0 });
			}

			// Seed one user with both tenant-admin and user-admin to trigger the promotion branch.
			const seedConnector = new MemoryEntityStorageConnector<{
				email: string;
				password: string;
				salt: string;
				identity: string;
				organization: string;
				scope: string;
			}>({
				entitySchema: "AuthenticationUserV0",
				partitionContextIds: ["node"],
				config: { storageKey: "authentication-user" }
			});
			// Clear rows left by earlier tests, the memory connector keeps them when the primary key changes.
			await seedConnector.teardown();
			await seedConnector.setBatch([
				{
					email: "combo@test.com",
					password: "hashed",
					salt: "salt",
					identity: "did:twin:combo",
					organization: TEST_NODE_ORG_ID,
					scope: "tenant-admin,user-admin"
				}
			]);

			await run1?.shutdown();

			let run2;
			try {
				run2 = await run({
					localesDirectory: LOCALES_DIR,
					stateStorage: new MemoryStateStorage(false, {
						nodeId: TEST_NODE_ID,
						nodeOrganizationId: TEST_NODE_ORG_ID
					}),
					disableProcessExitOnFailure: true,
					envVars: { ...AUTH_ENV, TWIN_PORT: String(PORT_2) },
					extendConfig: async (unusedEnvVars2, config) => {
						config.types.schemaVersionMigrationComponent = [
							{ type: SchemaVersionMigrationComponentType.Service }
						];
						config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
					}
				});

				const roleConnector = EntityStorageConnectorFactory.get("authorization-role-assignment");
				const { entities: assignments } = await roleConnector.query();
				const rows = (assignments ?? []) as {
					id: string;
					modelId: string;
					subject: string;
					role: string;
				}[];

				// Roles are held by the account id the identity now belongs to.
				const identityItem = (await EntityStorageConnectorFactory.get("account-data").get(
					AccountDataHelper.identityId("did:twin:combo")
				)) as { accountId: string } | undefined;
				const comboAccountId = identityItem?.accountId;
				expect(comboAccountId).toEqual(expect.any(String));

				// tenant-admin + user-admin → 2 original + 3 promoted = 5 total
				expect(rows).toHaveLength(5);
				for (const role of [
					"tenant-admin",
					"user-admin",
					"devops",
					"identity-admin",
					"identity-profile-admin"
				]) {
					expect(
						rows.some(r => r.subject === comboAccountId && r.role === role),
						`expected role "${role}"`
					).toBe(true);
				}
				expect(rows.every(r => r.modelId === "system")).toBe(true);
			} finally {
				await run2?.shutdown();
			}
		});
	});
});

describe("migration - scope to roles multi-tenant", () => {
	beforeAll(async () => {
		const storage = await ContextIdStore.getStorage();
		const realGetStore = storage.getStore.bind(storage);
		vi.spyOn(storage, "getStore").mockImplementation(() => {
			const ctx = realGetStore();
			return !ctx || Object.keys(ctx).length === 0
				? { node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A }
				: ctx;
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("Migrates V0 user scope to role assignments isolated by tenant partition", async () => {
		const PORT_1 = await getFreePort();
		const PORT_2 = await getFreePort();

		const AUTH_MT_ENV: { [id: string]: string } = {
			...MULTI_TENANT_BASE_ENV,
			...IDENTITY_ENV,
			TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage
		};

		// Run 1: initialise schema-version records then back-date AuthenticationUser to v0.
		const run1 = await run({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			}),
			disableProcessExitOnFailure: true,
			envVars: { ...AUTH_MT_ENV, TWIN_PORT: String(PORT_1) },
			extendConfig: async (unusedEnvVars, config) => {
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			}
		});

		const svConnector =
			EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{ schemaName: string; version: number }>
			>("schema-version");
		const svRecords = await svConnector.getStore();
		const svRecord = svRecords.find(r => r.schemaName === "AuthenticationUser");
		if (svRecord) {
			await svConnector.set({ ...svRecord, version: 0 });
		}

		// Register both tenants, the pending migration work is completed per registered tenant.
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const tenantConnector = EntityStorageConnectorFactory.get("tenant");
			const now = new Date().toISOString();
			for (const id of [TEST_TENANT_ID_A, TEST_TENANT_ID_B]) {
				await tenantConnector.set({
					id,
					apiKey: id,
					label: `Tenant ${id.slice(0, 1)}`,
					organizationId: TEST_NODE_ORG_ID,
					dateCreated: now,
					dateModified: now
				});
			}
		});

		// Seed one user per tenant using its own partition context so the migration
		// handler captures the correct contextIds for each and replays them into the
		// right authorization partition.
		await ContextIdStore.run({ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A }, async () => {
			const seedA = new MemoryEntityStorageConnector<{
				email: string;
				password: string;
				salt: string;
				identity: string;
				organization: string;
				scope: string;
			}>({
				entitySchema: "AuthenticationUserV0",
				partitionContextIds: ["node", "tenant"],
				config: { storageKey: "authentication-user" }
			});
			await seedA.setBatch([
				{
					email: "userA@test.com",
					password: "hashedA",
					salt: "saltA",
					identity: "did:twin:userA",
					organization: TEST_NODE_ORG_ID,
					scope: "global-admin"
				}
			]);
		});

		await ContextIdStore.run({ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_B }, async () => {
			const seedB = new MemoryEntityStorageConnector<{
				email: string;
				password: string;
				salt: string;
				identity: string;
				organization: string;
				scope: string;
			}>({
				entitySchema: "AuthenticationUserV0",
				partitionContextIds: ["node", "tenant"],
				config: { storageKey: "authentication-user" }
			});
			await seedB.setBatch([
				{
					email: "userB@test.com",
					password: "hashedB",
					salt: "saltB",
					identity: "did:twin:userB",
					organization: TEST_NODE_ORG_ID,
					scope: "tenant-admin"
				}
			]);
		});

		await run1?.shutdown();

		// Run 2: restart. Migration runs once per tenant partition. The contextIds captured
		// during each partition's removeEntityProperty call include the tenant ID, so
		// AuthorizationService.start() writes each role assignment into the correct partition.
		let run2;
		try {
			run2 = await run({
				localesDirectory: LOCALES_DIR,
				stateStorage: new MemoryStateStorage(false, {
					nodeId: TEST_NODE_ID,
					nodeOrganizationId: TEST_NODE_ORG_ID
				}),
				disableProcessExitOnFailure: true,
				envVars: { ...AUTH_MT_ENV, TWIN_PORT: String(PORT_2) },
				extendConfig: async (unusedEnvVars2, config) => {
					config.types.schemaVersionMigrationComponent = [
						{ type: SchemaVersionMigrationComponentType.Service }
					];
					config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
				}
			});

			// Schema version must have advanced to 1.
			const versionConnector = EntityStorageConnectorFactory.get("schema-version");
			const { entities: versionRecords } = await versionConnector.query();
			const migrationRecord = (versionRecords ?? []).find(
				r => (r as { schemaName: string }).schemaName === "AuthenticationUser"
			) as { version: number } | undefined;
			expect(migrationRecord?.version).toBe(2);

			// Tenant A: user must have global-admin role, isolated to tenant A's partition.
			const roleConnector = EntityStorageConnectorFactory.get("authorization-role-assignment");
			const { entities: assignmentsA } = await ContextIdStore.run(
				{ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A },
				async () => roleConnector.query()
			);
			const rowsA = (assignmentsA ?? []) as {
				id: string;
				modelId: string;
				subject: string;
				role: string;
			}[];
			// Roles are held by the account id the identity now belongs to, in the same partition.
			const accountData = EntityStorageConnectorFactory.get("account-data");
			const accountIdFor = async (tenant: string, did: string): Promise<string | undefined> =>
				ContextIdStore.run({ node: TEST_NODE_ID, tenant }, async () => {
					const item = (await accountData.get(AccountDataHelper.identityId(did))) as
						{ accountId: string } | undefined;
					return item?.accountId;
				});
			expect(rowsA).toHaveLength(1);
			expect(rowsA[0].subject).toBe(await accountIdFor(TEST_TENANT_ID_A, "did:twin:userA"));
			expect(rowsA[0].role).toBe("global-admin");
			expect(rowsA[0].modelId).toBe("system");

			// Tenant B: user must have tenant-admin role, isolated to tenant B's partition.
			const { entities: assignmentsB } = await ContextIdStore.run(
				{ node: TEST_NODE_ID, tenant: TEST_TENANT_ID_B },
				async () => roleConnector.query()
			);
			const rowsB = (assignmentsB ?? []) as {
				id: string;
				modelId: string;
				subject: string;
				role: string;
			}[];
			expect(rowsB).toHaveLength(1);
			expect(rowsB[0].subject).toBe(await accountIdFor(TEST_TENANT_ID_B, "did:twin:userB"));
			expect(rowsB[0].role).toBe("tenant-admin");
			expect(rowsB[0].modelId).toBe("system");
		} finally {
			await run2?.shutdown();
		}
	});
});

describe("migration - accounts", () => {
	interface UserV1 {
		email: string;
		password: string;
		salt: string;
		identity: string;
		organization: string;
	}
	interface Row {
		id: string;
		accountId: string;
		type: string;
		data: unknown;
	}

	const AUTH_ENV: { [id: string]: string } = {
		...BASE_ENV,
		...IDENTITY_ENV,
		TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
		TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage
	};

	const nodeOptions = (port: number, extraEnv: { [id: string]: string } = {}): INodeOptions => ({
		localesDirectory: LOCALES_DIR,
		stateStorage: new MemoryStateStorage(false, {
			nodeId: TEST_NODE_ID,
			nodeOrganizationId: TEST_NODE_ORG_ID
		}),
		disableProcessExitOnFailure: true,
		envVars: { ...AUTH_ENV, ...extraEnv, TWIN_PORT: String(port) },
		extendConfig: async (unusedEnvVars, config) => {
			config.types.schemaVersionMigrationComponent = [
				{ type: SchemaVersionMigrationComponentType.Service }
			];
			config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
		}
	});

	const recordId = (kind: string, key: string): string =>
		`migration-${kind}-${Converter.bytesToHex(Sha256.sum256(Converter.utf8ToBytes(key)))}`;

	const membershipCredential = (
		organization: string
	): Awaited<
		ReturnType<IIdentityComponent["verifiableCredentialCreate"]>
	>["verifiableCredential"] => ({
		"@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
		type: ["VerifiableCredential", "OrganizationMembershipCredential"],
		issuer: organization,
		credentialSubject: { id: "did:twin:member", memberOf: { id: organization } },
		proof: {
			type: "DataIntegrityProof",
			cryptosuite: "eddsa-jcs-2022",
			created: "2026-01-12T09:05:23.123Z",
			verificationMethod: `${organization}#trust-assertion`,
			proofPurpose: "assertionMethod",
			proofValue: "z-signature"
		}
	});

	// Starts a node, back-dates AuthenticationUser to v1 and seeds the v1 users, the role
	// assignments and any account data, ready for the next start to migrate them.
	const prepare = async (
		users: UserV1[],
		roles: { subject: string; role: string; modelId?: string }[],
		accountData: Row[],
		extraEnv: { [id: string]: string } = {},
		identityProfiles: {
			identity: string;
			publicProfile?: unknown;
			privateProfile?: unknown;
		}[] = [],
		policies: { modelId: string; subject: string; object: string; action: string }[] = []
	): Promise<void> => {
		const run1 = await run(nodeOptions(await getFreePort(), extraEnv));

		for (const profile of identityProfiles) {
			await EntityStorageConnectorFactory.get("identity-profile").set(profile);
		}

		const svConnector =
			EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{ schemaName: string; version: number }>
			>("schema-version");
		const svRecord = (await svConnector.getStore()).find(
			r => r.schemaName === "AuthenticationUser"
		);
		if (svRecord) {
			await svConnector.set({ ...svRecord, version: 1 });
		}

		const roleConnector = EntityStorageConnectorFactory.get("authorization-role-assignment");
		for (const { subject, role, modelId } of roles) {
			await roleConnector.set({
				id: `${modelId ?? "system"}|${subject}|${role}`,
				modelId: modelId ?? "system",
				subject,
				role
			});
		}

		const policyConnector = EntityStorageConnectorFactory.get("authorization-policy");
		for (const policy of policies) {
			await policyConnector.set({
				id: `${policy.modelId}|${policy.subject}|${policy.object}|${policy.action}`,
				...policy
			});
		}

		const accountDataConnector =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<AccountData>>("account-data");
		// Clear the work left by earlier tests, the memory store is shared between nodes.
		await accountDataConnector.teardown();
		const now = new Date().toISOString();
		for (const row of accountData) {
			await accountDataConnector.set({
				...row,
				isDefault: true,
				dateCreated: now,
				dateModified: now
			});
		}

		const seedConnector = new MemoryEntityStorageConnector<UserV1>({
			entitySchema: "AuthenticationUserV1",
			partitionContextIds: ["node"],
			config: { storageKey: "authentication-user" }
		});
		// Clear rows left by earlier tests, the memory connector keeps them when the primary key changes.
		await seedConnector.teardown();
		await seedConnector.setBatch(users);

		await run1?.shutdown();
	};

	const migratedUsers = async (): Promise<{ email: string; accountId: string }[]> => {
		const { entities } = await EntityStorageConnectorFactory.get("authentication-user").query();
		return (entities ?? []).filter(u =>
			Is.stringValue((u as { accountId?: string }).accountId)
		) as { email: string; accountId: string }[];
	};

	const accountRows = async (accountId: string, type: string): Promise<Row[]> => {
		const { entities } = await EntityStorageConnectorFactory.get("account-data").query({
			conditions: [
				{ property: "accountId", value: accountId, comparison: ComparisonOperator.Equals },
				{ property: "type", value: type, comparison: ComparisonOperator.Equals }
			],
			logicalOperator: LogicalOperator.And
		});
		return (entities ?? []) as Row[];
	};

	const rolesOf = async (subject: string, modelId: string = "system"): Promise<string[]> => {
		// Filtered by subject, as the rules seeded for the routes fill the first page.
		const { entities } = await EntityStorageConnectorFactory.get(
			"authorization-role-assignment"
		).query({ property: "subject", value: subject, comparison: ComparisonOperator.Equals });
		return ((entities ?? []) as { subject: string; role: string; modelId: string }[])
			.filter(r => r.subject === subject && r.modelId === modelId)
			.map(r => r.role)
			.sort();
	};

	const policiesOf = async (subject: string): Promise<string[]> => {
		const { entities } = await EntityStorageConnectorFactory.get("authorization-policy").query({
			property: "subject",
			value: subject,
			comparison: ComparisonOperator.Equals
		});
		return (
			(entities ?? []) as { subject: string; modelId: string; object: string; action: string }[]
		)
			.filter(p => p.subject === subject)
			.map(p => `${p.modelId}|${p.object}|${p.action}`)
			.sort();
	};

	beforeAll(async () => {
		const storage = await ContextIdStore.getStorage();
		const realGetStore = storage.getStore.bind(storage);
		vi.spyOn(storage, "getStore").mockImplementation(() => {
			const ctx = realGetStore();
			return !ctx || Object.keys(ctx).length === 0 ? { node: TEST_NODE_ID } : ctx;
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("Gives users sharing an identity their own accounts, each with the roles of the identity", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			await prepare(
				[
					{
						email: "shared-a@test.com",
						password: "hashed",
						salt: "salt",
						identity: "did:twin:shared",
						organization: TEST_NODE_ORG_ID
					},
					{
						email: "shared-b@test.com",
						password: "hashed",
						salt: "salt",
						identity: "did:twin:shared",
						organization: TEST_NODE_ORG_ID
					}
				],
				[
					{ subject: "did:twin:shared", role: "tenant-admin" },
					{ subject: "did:twin:shared", role: "user" }
				],
				[]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort()));

				const users = (await migratedUsers()).filter(u => u.email.startsWith("shared-"));
				expect(users).toHaveLength(2);
				expect(users[0].accountId).not.toBe(users[1].accountId);

				// Only one account holds the DID, the other is migrated without an identity.
				const accountData = EntityStorageConnectorFactory.get("account-data");
				const holder = (await accountData.get(AccountDataHelper.identityId("did:twin:shared"))) as
					Row | undefined;
				expect(users.map(u => u.accountId)).toContain(holder?.accountId);
				const other = users.find(u => u.accountId !== holder?.accountId);
				expect(await accountRows(other?.accountId ?? "", "identity")).toHaveLength(0);

				// Both keep the organization, and both are given the roles the DID held.
				for (const user of users) {
					expect(await accountRows(user.accountId, "organization")).toMatchObject([
						{ data: AuthenticationAccountHelper.createOrganizationData(TEST_NODE_ORG_ID) }
					]);
					expect(await rolesOf(user.accountId)).toEqual(["tenant-admin", "user"]);
				}
				expect(await rolesOf("did:twin:shared")).toEqual([]);

				// The role move is complete, so its record is removed.
				await expect(accountData.get(recordId("identity", "did:twin:shared"))).resolves.toBe(
					undefined
				);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Moves the role assignments and policies of an identity in every model to its account", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			await prepare(
				[
					{
						email: "rules@test.com",
						password: "hashed",
						salt: "salt",
						identity: "did:twin:rules",
						organization: ""
					}
				],
				[
					{ subject: "did:twin:rules", role: "user" },
					{ subject: "did:twin:rules", role: "auditor", modelId: "custom" },
					{ subject: "did:twin:other", role: "user" }
				],
				[],
				{},
				[],
				[
					{ modelId: "system", subject: "did:twin:rules", object: "reports", action: "read" },
					{ modelId: "custom", subject: "did:twin:rules", object: "ledger", action: "write" },
					{ modelId: "system", subject: "did:twin:other", object: "reports", action: "read" }
				]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort()));

				const user = (await migratedUsers()).find(u => u.email === "rules@test.com");
				const accountId = user?.accountId ?? "";
				expect(Is.stringValue(accountId)).toBe(true);

				expect(await rolesOf(accountId)).toEqual(["user"]);
				expect(await rolesOf(accountId, "custom")).toEqual(["auditor"]);
				expect(await policiesOf(accountId)).toEqual(["custom|ledger|write", "system|reports|read"]);

				// The rules of the DID are removed once every account has them.
				expect(await rolesOf("did:twin:rules")).toEqual([]);
				expect(await rolesOf("did:twin:rules", "custom")).toEqual([]);
				expect(await policiesOf("did:twin:rules")).toEqual([]);

				// A DID that was not held by a migrated user keeps its rules.
				expect(await rolesOf("did:twin:other")).toEqual(["user"]);
				expect(await policiesOf("did:twin:other")).toEqual(["system|reports|read"]);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Keeps the account id of an e-mail address migrated by an interrupted run", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			// An interrupted run stored the record of the user and its identity, but the old rows
			// were not replaced.
			await prepare(
				[
					{
						email: "rerun@test.com",
						password: "hashed",
						salt: "salt",
						identity: "did:twin:rerun",
						organization: ""
					}
				],
				[],
				[
					{
						id: recordId("account", "rerun@test.com"),
						accountId: "migration",
						type: "migration",
						data: { kind: "account", email: "rerun@test.com", accountId: "rerun-account" }
					},
					{
						id: AccountDataHelper.identityId("did:twin:rerun"),
						accountId: "rerun-account",
						type: "identity",
						data: "did:twin:rerun"
					}
				]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort()));

				const user = (await migratedUsers()).find(u => u.email === "rerun@test.com");
				expect(user?.accountId).toBe("rerun-account");
				// The identity the interrupted run stored as a DID string is written again as an object.
				expect(await accountRows("rerun-account", "identity")).toMatchObject([
					{ data: AuthenticationAccountHelper.createIdentityData("did:twin:rerun") }
				]);

				// Nothing is left to do for the user, so its record is removed.
				const accountData = EntityStorageConnectorFactory.get("account-data");
				await expect(accountData.get(recordId("account", "rerun@test.com"))).resolves.toBe(
					undefined
				);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Stores e-mail addresses in lower case and disables a later user that differs only by case", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			await prepare(
				[
					{
						email: "Upper@Test.com",
						password: "hashed",
						salt: "salt",
						identity: "",
						organization: ""
					},
					{
						email: "upper@TEST.com",
						password: "hashed",
						salt: "salt",
						identity: "",
						organization: ""
					}
				],
				[],
				[]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort()));

				const users = (
					(await migratedUsers()) as {
						email: string;
						accountId: string;
						providerAccountId?: string;
						dateDisabled?: string;
					}[]
				).filter(u => u.email.toLowerCase() === "upper@test.com");
				expect(users).toHaveLength(2);
				expect(users[0].accountId).not.toBe(users[1].accountId);

				const kept = users.filter(u => !Is.stringValue(u.dateDisabled));
				expect(kept).toHaveLength(1);
				expect(kept[0].email).toBe("upper@test.com");
				expect(kept[0].providerAccountId).toBe("upper@test.com");

				const disabled = users.filter(u => Is.stringValue(u.dateDisabled));
				expect(disabled).toHaveLength(1);
				expect(["Upper@Test.com", "upper@TEST.com"]).toContain(disabled[0].email);
				expect(disabled[0].providerAccountId).toBe(disabled[0].email);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Keeps the account id of a mixed case e-mail address migrated by an interrupted run", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			// A previous run keyed the record by the e-mail address as stored.
			await prepare(
				[
					{
						email: "Rerun-Case@Test.com",
						password: "hashed",
						salt: "salt",
						identity: "",
						organization: ""
					}
				],
				[],
				[
					{
						id: recordId("account", "Rerun-Case@Test.com"),
						accountId: "migration",
						type: "migration",
						data: {
							kind: "account",
							email: "Rerun-Case@Test.com",
							accountId: "rerun-case-account"
						}
					}
				]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort()));

				const user = (await migratedUsers()).find(u => u.accountId === "rerun-case-account");
				expect(user?.email).toBe("rerun-case@test.com");

				// The record is moved to the normalised key and removed once complete.
				const accountData = EntityStorageConnectorFactory.get("account-data");
				await expect(accountData.get(recordId("account", "Rerun-Case@Test.com"))).resolves.toBe(
					undefined
				);
				await expect(accountData.get(recordId("account", "rerun-case@test.com"))).resolves.toBe(
					undefined
				);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Keeps the pending work of a migrated account until the membership credential is issued", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			await prepare(
				[
					{
						email: "member@test.com",
						password: "hashed",
						salt: "salt",
						identity: "did:twin:member",
						organization: TEST_NODE_ORG_ID
					}
				],
				[{ subject: "did:twin:member", role: "user" }],
				[]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort()));

				const user = (await migratedUsers()).find(u => u.email === "member@test.com");
				const accountId = user?.accountId ?? "";
				expect(await rolesOf(accountId)).toEqual(["user"]);

				// The organization has no trust verification method in this node, so no credential is
				// issued and the work is kept for the next start.
				const accountData = EntityStorageConnectorFactory.get("account-data");
				expect(await accountRows(accountId, "vc")).toHaveLength(0);
				await expect(
					accountData.get(recordId("account", "member@test.com"))
				).resolves.toMatchObject({
					data: { kind: "account", accountId, organization: TEST_NODE_ORG_ID }
				});

				// Once the organization can sign, the next start issues the credential and removes
				// the record.
				const identityComponent = ComponentFactory.get<IIdentityComponent>(
					run2?.engine.getRegisteredInstanceType("identityComponent") ?? ""
				);
				const create = vi.spyOn(identityComponent, "verifiableCredentialCreate").mockResolvedValue({
					verifiableCredential: membershipCredential(TEST_NODE_ORG_ID),
					jwt: "unused.credential.jwt"
				});
				if (run2) {
					await finalizeMigrations(run2.engine, {});
				}

				expect(create).toHaveBeenCalledTimes(1);
				expect(create.mock.calls[0][0]).toBe(`${TEST_NODE_ORG_ID}#trust-assertion`);
				expect(create.mock.calls[0][2]).toMatchObject({
					id: "did:twin:member",
					memberOf: { id: TEST_NODE_ORG_ID }
				});
				// The JSON credential with its proof is stored, not the JWT.
				expect(await accountRows(accountId, "vc")).toMatchObject([
					{ data: membershipCredential(TEST_NODE_ORG_ID) }
				]);
				await expect(accountData.get(recordId("account", "member@test.com"))).resolves.toBe(
					undefined
				);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Registers the organizations of migrated users and the node organization once, with their identity profiles", async () => {
		const profileEnv = {
			TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage
		};
		const publicProfile = {
			"@context": "https://schema.org",
			"@type": "Organization",
			name: "Migrated Ltd"
		};
		const privateProfile = {
			"@context": "https://schema.org",
			"@type": "Organization",
			email: "office@migrated.example"
		};

		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			await prepare(
				[
					{
						email: "org-member@test.com",
						password: "hashed",
						salt: "salt",
						identity: "did:twin:org-member",
						organization: "did:twin:migrated-org"
					}
				],
				[],
				[],
				profileEnv,
				[{ identity: "did:twin:migrated-org", publicProfile, privateProfile }]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort(), profileEnv));

				const organizations = EntityStorageConnectorFactory.get("organization");
				const registered = async (
					identity: string
				): Promise<{ id: string; identity: string; searchName: string }[]> => {
					const { entities } = await organizations.query({
						property: "identity",
						value: identity,
						comparison: ComparisonOperator.Equals
					});
					return (entities ?? []) as { id: string; identity: string; searchName: string }[];
				};

				const migrated = await registered("did:twin:migrated-org");
				expect(migrated).toHaveLength(1);
				expect(await registered(TEST_NODE_ORG_ID)).toHaveLength(1);

				// The identity profile of the organization is copied to the profiles owned by its DID.
				expect(await accountRows(migrated[0].identity, "public-profile")).toMatchObject([
					{ data: publicProfile }
				]);
				expect(await accountRows(migrated[0].identity, "private-profile")).toMatchObject([
					{ data: privateProfile }
				]);
				expect(migrated[0].searchName).toBe(publicProfile.name.toLowerCase());

				// The work is complete, so its record is removed.
				const accountData = EntityStorageConnectorFactory.get("account-data");
				await expect(
					accountData.get(recordId("organization", "did:twin:migrated-org"))
				).resolves.toBe(undefined);

				// Another run finds the organizations by their DID and adds nothing.
				if (run2) {
					await finalizeMigrations(run2.engine, {});
				}
				expect(await registered("did:twin:migrated-org")).toHaveLength(1);
				expect(await registered(TEST_NODE_ORG_ID)).toHaveLength(1);
				expect(await accountRows(migrated[0].identity, "public-profile")).toHaveLength(1);
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Moves the identity profile of a user to its account and upgrades its legacy password hash at sign in", async () => {
		const authEnv = {
			TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage
		};
		const password = "Legacy@Password123!";
		const salt = RandomHelper.generate(16);
		const publicProfile = { "@context": "https://schema.org", "@type": "Person", name: "Legacy" };
		const privateProfile = {
			"@context": "https://schema.org",
			"@type": "Person",
			email: "legacy@test.com"
		};

		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			// The hash stored by earlier versions, Blake2b with no algorithm recorded.
			await prepare(
				[
					{
						email: "Legacy@Test.com",
						password: await PasswordGenerator.hashPassword(Converter.utf8ToBytes(password), salt),
						salt: Converter.bytesToBase64(salt),
						identity: "did:twin:legacy",
						organization: ""
					}
				],
				[],
				[],
				authEnv,
				[{ identity: "did:twin:legacy", publicProfile, privateProfile }]
			);

			let run2;
			try {
				run2 = await run(nodeOptions(await getFreePort(), authEnv));

				const user = (
					(await migratedUsers()) as {
						email: string;
						accountId: string;
						passwordAlgorithm?: string;
					}[]
				).find(u => u.email === "legacy@test.com");
				expect(user?.passwordAlgorithm).toBeUndefined();
				const accountId = user?.accountId ?? "";

				expect(await accountRows(accountId, "public-profile")).toMatchObject([
					{ data: publicProfile }
				]);
				expect(await accountRows(accountId, "private-profile")).toMatchObject([
					{ data: privateProfile }
				]);

				// The legacy hash signs in, by the address in any case, and is replaced on the way.
				const provider = AuthenticationProviderFactory.get("entity-storage");
				await expect(
					provider.authenticate({ email: "LEGACY@test.com", password: "Wrong@Password123!" })
				).rejects.toThrow("loginFailed");
				await expect(
					provider.authenticate({ email: "LEGACY@test.com", password })
				).resolves.toMatchObject({ email: "legacy@test.com" });

				const upgraded = (await EntityStorageConnectorFactory.get("authentication-user").get(
					accountId
				)) as { passwordAlgorithm?: string; password: string } | undefined;
				expect(upgraded?.passwordAlgorithm).toBe("argon2id");
				await expect(
					provider.authenticate({ email: "legacy@test.com", password })
				).resolves.toMatchObject({ email: "legacy@test.com" });
			} finally {
				await run2?.shutdown();
			}
		});
	});

	test("Leaves the migrated accounts unchanged when the node starts again", async () => {
		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			await prepare(
				[
					{
						email: "Again@Test.com",
						password: "hashed",
						salt: "salt",
						identity: "did:twin:again",
						organization: TEST_NODE_ORG_ID
					}
				],
				[{ subject: "did:twin:again", role: "tenant-admin" }],
				[]
			);

			const snapshot = async (): Promise<unknown> => {
				const user = (await migratedUsers()).find(u => u.email === "again@test.com");
				const accountId = user?.accountId ?? "";
				const { entities } = await EntityStorageConnectorFactory.get("account-data").query({
					property: "accountId",
					value: accountId,
					comparison: ComparisonOperator.Equals
				});
				return {
					users: (await migratedUsers()).filter(u => u.email === "again@test.com").length,
					accountId,
					items: ((entities ?? []) as Row[])
						.map(
							item =>
								`${item.type}|${
									AuthenticationAccountHelper.getIdentity(item.data) ??
									AuthenticationAccountHelper.getOrganization(item.data)
								}`
						)
						.sort(),
					roles: await rolesOf(accountId),
					didRoles: await rolesOf("did:twin:again")
				};
			};

			let run2;
			let first;
			try {
				run2 = await run(nodeOptions(await getFreePort()));
				first = await snapshot();
				expect(first).toMatchObject({
					users: 1,
					roles: ["tenant-admin"],
					didRoles: [],
					items: ["identity|did:twin:again", `organization|${TEST_NODE_ORG_ID}`]
				});
			} finally {
				await run2?.shutdown();
			}

			let run3;
			try {
				run3 = await run(nodeOptions(await getFreePort()));
				expect(await snapshot()).toEqual(first);
			} finally {
				await run3?.shutdown();
			}
		});
	});
});

describe("migration - accounts multi-tenant", () => {
	beforeAll(async () => {
		const storage = await ContextIdStore.getStorage();
		const realGetStore = storage.getStore.bind(storage);
		vi.spyOn(storage, "getStore").mockImplementation(() => {
			const ctx = realGetStore();
			return !ctx || Object.keys(ctx).length === 0
				? { node: TEST_NODE_ID, tenant: TEST_TENANT_ID_A }
				: ctx;
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		Factory.clearFactories();
	});

	test("Migrates the users of each tenant to accounts in the partition of the tenant", async () => {
		const TENANT_ORGS: { [tenant: string]: string } = {
			[TEST_TENANT_ID_A]: "did:twin:org-a",
			[TEST_TENANT_ID_B]: "did:twin:org-b"
		};
		const env = {
			...MULTI_TENANT_BASE_ENV,
			...IDENTITY_ENV,
			TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage
		};
		const options = (port: number): INodeOptions => ({
			localesDirectory: LOCALES_DIR,
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			}),
			disableProcessExitOnFailure: true,
			envVars: { ...env, TWIN_PORT: String(port) },
			extendConfig: async (unusedEnvVars, config) => {
				config.types.schemaVersionMigrationComponent = [
					{ type: SchemaVersionMigrationComponentType.Service }
				];
				config.types.backgroundTaskComponent = [{ type: BackgroundTaskComponentType.Service }];
			}
		});

		const run1 = await run(options(await getFreePort()));
		const svConnector =
			EntityStorageConnectorFactory.get<
				MemoryEntityStorageConnector<{ schemaName: string; version: number }>
			>("schema-version");
		const svRecord = (await svConnector.getStore()).find(
			r => r.schemaName === "AuthenticationUser"
		);
		if (svRecord) {
			await svConnector.set({ ...svRecord, version: 1 });
		}

		await ContextIdStore.run({ node: TEST_NODE_ID }, async () => {
			const tenantConnector = EntityStorageConnectorFactory.get("tenant");
			const now = new Date().toISOString();
			for (const id of [TEST_TENANT_ID_A, TEST_TENANT_ID_B]) {
				await tenantConnector.set({
					id,
					apiKey: id,
					label: `Tenant ${id.slice(0, 1)}`,
					organizationId: TENANT_ORGS[id],
					dateCreated: now,
					dateModified: now
				});
			}
		});

		for (const tenant of [TEST_TENANT_ID_A, TEST_TENANT_ID_B]) {
			await ContextIdStore.run({ node: TEST_NODE_ID, tenant }, async () => {
				const seed = new MemoryEntityStorageConnector<{
					email: string;
					password: string;
					salt: string;
					identity: string;
					organization: string;
				}>({
					entitySchema: "AuthenticationUserV1",
					partitionContextIds: ["node", "tenant"],
					config: { storageKey: "authentication-user" }
				});
				// Both tenants have a user with the same e-mail address, which is no collision.
				await seed.setBatch([
					{
						email: "Member@Test.com",
						password: "hashed",
						salt: "salt",
						identity: `did:twin:member-${tenant.slice(0, 1)}`,
						organization: TENANT_ORGS[tenant]
					}
				]);
				await EntityStorageConnectorFactory.get("authorization-role-assignment").set({
					id: `system|did:twin:member-${tenant.slice(0, 1)}|user`,
					modelId: "system",
					subject: `did:twin:member-${tenant.slice(0, 1)}`,
					role: "user"
				});
			});
		}

		await run1?.shutdown();

		let run2;
		try {
			run2 = await run(options(await getFreePort()));

			for (const tenant of [TEST_TENANT_ID_A, TEST_TENANT_ID_B]) {
				await ContextIdStore.run({ node: TEST_NODE_ID, tenant }, async () => {
					const { entities: users } =
						await EntityStorageConnectorFactory.get("authentication-user").query();
					const migrated = (
						users as { email: string; accountId?: string; dateDisabled?: string }[]
					).filter(u => Is.stringValue(u.accountId));
					expect(migrated).toHaveLength(1);
					expect(migrated[0]).toMatchObject({ email: "member@test.com" });
					expect(migrated[0].dateDisabled).toBeUndefined();
					const accountId = migrated[0].accountId ?? "";

					const accountData = EntityStorageConnectorFactory.get("account-data");
					await expect(
						accountData.get(AccountDataHelper.identityId(`did:twin:member-${tenant.slice(0, 1)}`))
					).resolves.toMatchObject({ accountId });
					const { entities: organizations } = await accountData.query({
						conditions: [
							{ property: "accountId", value: accountId, comparison: ComparisonOperator.Equals },
							{ property: "type", value: "organization", comparison: ComparisonOperator.Equals }
						],
						logicalOperator: LogicalOperator.And
					});
					expect(organizations).toMatchObject([
						{ data: AuthenticationAccountHelper.createOrganizationData(TENANT_ORGS[tenant]) }
					]);

					const { entities: roles } = await EntityStorageConnectorFactory.get(
						"authorization-role-assignment"
					).query({ property: "subject", value: accountId, comparison: ComparisonOperator.Equals });
					expect((roles as { role: string }[]).map(r => r.role)).toEqual(["user"]);

					// The organization of the tenant is registered in its partition.
					const { entities: registered } = await EntityStorageConnectorFactory.get(
						"organization"
					).query({
						property: "identity",
						value: TENANT_ORGS[tenant],
						comparison: ComparisonOperator.Equals
					});
					expect(registered).toHaveLength(1);
				});
			}
		} finally {
			await run2?.shutdown();
		}
	});
});
