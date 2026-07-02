// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdStore } from "@twin.org/context";
import { Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import {
	BackgroundTaskComponentType,
	EntityStorageComponentType,
	EntityStorageConnectorType,
	LoggingComponentType,
	LoggingConnectorType,
	SchemaVersionMigrationComponentType
} from "@twin.org/engine-types";
import { entity, EntitySchemaFactory, EntitySchemaHelper, property } from "@twin.org/entity";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import {
	EntityStorageConnectorFactory,
	SchemaMigrationFactory
} from "@twin.org/entity-storage-models";
import type { ILogEntry } from "@twin.org/logging-models";
import { CI_ENV_VARS } from "./setupTestEnv.js";
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

const LOCALES_DIR = "./dist/locales/";
const TEST_NODE_ID = "did:iota:0x123";
const TEST_NODE_ORG_ID = "did:iota:0x456";

const BASE_ENV: { [id: string]: string } = {
	TWIN_SILENT: "true",
	TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
	TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
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
		const port = 28000 + Math.floor(Math.random() * 500);

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
			const PORT_1 = 28600 + Math.floor(Math.random() * 200);
			const PORT_2 = PORT_1 + 300;

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
				transformEntityProperty: (fromProp, toProp, value) => [`item:${value as number}`]
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
