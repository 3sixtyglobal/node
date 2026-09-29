// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	AuditableItemGraphVertexIndex,
	AuditableItemGraphVertexV1
} from "@twin.org/auditable-item-graph-service";
import { initSchema as initSchemaAuditableItemGraph } from "@twin.org/auditable-item-graph-service";
import { ContextIdStore } from "@twin.org/context";
import { BaseError, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import {
	BackgroundTaskComponentType,
	EntityStorageComponentType,
	EntityStorageConnectorType,
	LoggingComponentType,
	LoggingConnectorType,
	SchemaVersionMigrationComponentType
} from "@twin.org/engine-types";
import type { IEntitySchemaProperty } from "@twin.org/entity";
import {
	entity,
	EntitySchemaFactory,
	EntitySchemaHelper,
	EntitySchemaPropertyType,
	property
} from "@twin.org/entity";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import {
	EntityStorageConnectorFactory,
	SchemaMigrationFactory
} from "@twin.org/entity-storage-models";
import type { ILogEntry } from "@twin.org/logging-models";
import type { OdrlPolicyIndex, OdrlPolicyV0 } from "@twin.org/rights-management-pap-service";
import { initSchema as initSchemaPolicyAdministrationPoint } from "@twin.org/rights-management-pap-service";
import { CI_ENV_VARS, getFreePort } from "./setupTestEnv.js";
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
	TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
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
