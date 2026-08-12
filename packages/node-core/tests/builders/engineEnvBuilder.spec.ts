// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaConfig } from "@twin.org/dlt-iota";
import {
	DataspaceControlPlaneComponentType,
	DltConfigType,
	EntityStorageConnectorType,
	SchemaVersionMigrationComponentType,
	TaskSchedulerComponentType
} from "@twin.org/engine-types";
import { buildEngineConfiguration } from "../../src/builders/engineEnvBuilder.js";

describe("buildEngineConfiguration - schemaMigrationEnabled", () => {
	test("schema migration service is registered when schemaMigrationEnabled is unset (default true)", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.schemaVersionMigrationComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: SchemaVersionMigrationComponentType.Service })
			])
		);
	});

	test("schema migration service is registered when schemaMigrationEnabled is 'true'", async () => {
		const config = await buildEngineConfiguration({ schemaMigrationEnabled: "true" });

		expect(config.types.schemaVersionMigrationComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: SchemaVersionMigrationComponentType.Service })
			])
		);
	});

	test("schema migration service is not registered when schemaMigrationEnabled is 'false'", async () => {
		const config = await buildEngineConfiguration({ schemaMigrationEnabled: "false" });

		expect(config.types.schemaVersionMigrationComponent).toBeUndefined();
	});
});

describe("buildEngineConfiguration - task scheduler requirement", () => {
	test("task scheduler is registered when only auditableItemGraphEnabled is set", async () => {
		const config = await buildEngineConfiguration({ auditableItemGraphEnabled: "true" });

		expect(config.types.taskSchedulerComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: TaskSchedulerComponentType.Service })
			])
		);
	});

	test("task scheduler is not registered when no dependent component is enabled", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.taskSchedulerComponent).toBeUndefined();
	});
});

describe("buildEngineConfiguration - IOTA DLT gas config", () => {
	test("iotaGasBudget and iotaGasReservationDuration env vars are wired through to the resolved config", async () => {
		const config = await buildEngineConfiguration({
			iotaNodeEndpoint: "https://api.testnet.iota.cafe",
			iotaNetwork: "testnet",
			iotaGasBudget: "123456789",
			iotaGasReservationDuration: "45"
		});

		const dltEntry = config.types.dltConfig?.find(entry => entry.type === DltConfigType.Iota);
		expect(dltEntry).toBeDefined();

		const iotaConfig = dltEntry?.options?.config as IIotaConfig;

		expect(iotaConfig.gasBudget).toBe(123456789);
		expect(iotaConfig.gasReservationDuration).toBe(45);
	});

	test("leaving both env vars unset preserves today's behavior (fields stay undefined)", async () => {
		const config = await buildEngineConfiguration({
			iotaNodeEndpoint: "https://api.testnet.iota.cafe",
			iotaNetwork: "testnet"
		});

		const dltEntry = config.types.dltConfig?.find(entry => entry.type === DltConfigType.Iota);
		expect(dltEntry).toBeDefined();

		const iotaConfig = dltEntry?.options?.config as IIotaConfig;

		expect(iotaConfig.gasBudget).toBeUndefined();
		expect(iotaConfig.gasReservationDuration).toBeUndefined();
	});

	test("existing coinType and gasStation fields still resolve correctly alongside the new ones", async () => {
		const config = await buildEngineConfiguration({
			iotaNodeEndpoint: "https://api.testnet.iota.cafe",
			iotaNetwork: "testnet",
			iotaCoinType: "4218",
			iotaGasStationEndpoint: "http://localhost:9527",
			iotaGasStationAuthToken: "test-token",
			iotaGasBudget: "123456789",
			iotaGasReservationDuration: "45"
		});

		const dltEntry = config.types.dltConfig?.find(entry => entry.type === DltConfigType.Iota);
		expect(dltEntry).toBeDefined();

		const iotaConfig = dltEntry?.options?.config as IIotaConfig;

		expect(iotaConfig.coinType).toBe(4218);
		expect(iotaConfig.gasStation).toStrictEqual({
			gasStationUrl: "http://localhost:9527",
			gasStationAuthToken: "test-token"
		});
		expect(iotaConfig.gasBudget).toBe(123456789);
		expect(iotaConfig.gasReservationDuration).toBe(45);
	});
});

describe("buildEngineConfiguration - dataspace provider idle transfer policy", () => {
	test("provider idle policy values are wired in seconds and converted to milliseconds", async () => {
		const config = await buildEngineConfiguration({
			dataspaceEnabled: "true",
			dataspaceProviderTransferIdleTimeout: "120",
			dataspaceProviderTransferPolicySweepInterval: "15"
		});

		const dataspaceService = config.types.dataspaceControlPlaneComponent?.find(
			entry => entry.type === DataspaceControlPlaneComponentType.Service
		);

		const dataspaceConfig = dataspaceService?.options?.config as {
			providerTransferIdleTimeoutMs?: number;
			providerTransferPolicySweepIntervalMs?: number;
		};

		expect(dataspaceConfig.providerTransferIdleTimeoutMs).toBe(120000);
		expect(dataspaceConfig.providerTransferPolicySweepIntervalMs).toBe(15000);
	});

	test("unset provider idle policy values keep existing behaviour unchanged", async () => {
		const config = await buildEngineConfiguration({
			dataspaceEnabled: "true"
		});

		const dataspaceService = config.types.dataspaceControlPlaneComponent?.find(
			entry => entry.type === DataspaceControlPlaneComponentType.Service
		);

		const dataspaceConfig = dataspaceService?.options?.config as {
			providerTransferIdleTimeoutMs?: number;
			providerTransferPolicySweepIntervalMs?: number;
		};

		expect(dataspaceConfig.providerTransferIdleTimeoutMs).toBeUndefined();
		expect(dataspaceConfig.providerTransferPolicySweepIntervalMs).toBeUndefined();
	});
});

describe("buildEngineConfiguration - entity storage shared mutex timeout", () => {
	test("entity storage mutex timeout applies to both memory and file connectors", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "memory,file",
			entityStorageMutexTimeout: "4321",
			storageFileRoot: "."
		});

		const memoryConnector = config.types.entityStorageConnector?.find(
			entry => entry.type === EntityStorageConnectorType.Memory
		);
		const fileConnector = config.types.entityStorageConnector?.find(
			entry => entry.type === EntityStorageConnectorType.File
		);

		const memoryMutexTimeoutMs = (
			memoryConnector?.options as { config?: { mutexTimeoutMs?: number } }
		)?.config?.mutexTimeoutMs;
		const fileMutexTimeoutMs = (fileConnector?.options as { config?: { mutexTimeoutMs?: number } })
			?.config?.mutexTimeoutMs;

		expect(memoryMutexTimeoutMs).toBe(4321);
		expect(fileMutexTimeoutMs).toBe(4321);
	});

	test("entity storage mutex timeout is unset when the env var is empty", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "memory,file",
			storageFileRoot: "."
		});

		const memoryConnector = config.types.entityStorageConnector?.find(
			entry => entry.type === EntityStorageConnectorType.Memory
		);
		const fileConnector = config.types.entityStorageConnector?.find(
			entry => entry.type === EntityStorageConnectorType.File
		);

		const memoryMutexTimeoutMs = (
			memoryConnector?.options as { config?: { mutexTimeoutMs?: number } }
		)?.config?.mutexTimeoutMs;
		const fileMutexTimeoutMs = (fileConnector?.options as { config?: { mutexTimeoutMs?: number } })
			?.config?.mutexTimeoutMs;

		expect(memoryMutexTimeoutMs).toBeUndefined();
		expect(fileMutexTimeoutMs).toBeUndefined();
	});
});

describe("buildEngineConfiguration - entity storage pool options", () => {
	function connectorPool(
		config: { types: { entityStorageConnector?: { type: string; options?: unknown }[] } },
		type: EntityStorageConnectorType
	): { [key: string]: unknown } | undefined {
		const entry = config.types.entityStorageConnector?.find(e => e.type === type);
		return (entry?.options as { config?: { pool?: { [key: string]: unknown } } } | undefined)
			?.config?.pool;
	}

	test("postgresql pool env vars are wired to the connector config", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "postgresql",
			postgreSqlHost: "localhost",
			postgreSqlUser: "u",
			postgreSqlPassword: "p",
			postgreSqlDatabase: "db",
			postgreSqlPoolMax: "20",
			postgreSqlPoolIdleTimeout: "60",
			postgreSqlPoolConnectTimeout: "15",
			postgreSqlPoolMaxLifetime: "3600"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.PostgreSql);
		expect(pool).toMatchObject({ max: 20, idleTimeout: 60, connectTimeout: 15, maxLifetime: 3600 });
	});

	test("postgresql pool fields are undefined when pool env vars are not set", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "postgresql",
			postgreSqlHost: "localhost",
			postgreSqlUser: "u",
			postgreSqlPassword: "p",
			postgreSqlDatabase: "db"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.PostgreSql);
		expect(pool?.max).toBeUndefined();
		expect(pool?.idleTimeout).toBeUndefined();
		expect(pool?.connectTimeout).toBeUndefined();
		expect(pool?.maxLifetime).toBeUndefined();
	});

	test("mysql pool env vars are wired to the connector config", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "mysql",
			mySqlHost: "localhost",
			mySqlUser: "u",
			mySqlPassword: "p",
			mySqlDatabase: "db",
			mySqlPoolConnectionLimit: "25",
			mySqlPoolMaxIdle: "5",
			mySqlPoolIdleTimeout: "30000",
			mySqlPoolEnableKeepAlive: "false",
			mySqlPoolWaitForConnections: "true",
			mySqlPoolQueueLimit: "100"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.MySqlDb);
		expect(pool).toMatchObject({
			connectionLimit: 25,
			maxIdle: 5,
			idleTimeout: 30000,
			enableKeepAlive: false,
			waitForConnections: true,
			queueLimit: 100
		});
	});

	test("mysql pool fields are undefined when pool env vars are not set", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "mysql",
			mySqlHost: "localhost",
			mySqlUser: "u",
			mySqlPassword: "p",
			mySqlDatabase: "db"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.MySqlDb);
		expect(pool?.connectionLimit).toBeUndefined();
		expect(pool?.enableKeepAlive).toBeUndefined();
	});

	test("mongodb pool env vars are wired to the connector config", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "mongodb",
			mongoDbHost: "localhost",
			mongoDbDatabase: "db",
			mongoDbPoolMaxPoolSize: "50",
			mongoDbPoolMinPoolSize: "2",
			mongoDbPoolMaxIdleTime: "10000",
			mongoDbPoolWaitQueueTimeout: "5000"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.MongoDb);
		expect(pool).toMatchObject({
			maxPoolSize: 50,
			minPoolSize: 2,
			maxIdleTimeMs: 10000,
			waitQueueTimeoutMs: 5000
		});
	});

	test("mongodb pool fields are undefined when pool env vars are not set", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "mongodb",
			mongoDbHost: "localhost",
			mongoDbDatabase: "db"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.MongoDb);
		expect(pool?.maxPoolSize).toBeUndefined();
		expect(pool?.minPoolSize).toBeUndefined();
	});

	test("scylladb pool env vars are wired to the connector config", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "scylladb",
			scylladbHosts: "localhost",
			scylladbLocalDataCenter: "dc1",
			scylladbKeyspace: "ks",
			scylladbPoolCoreConnectionsPerHost: "2",
			scylladbPoolMaxRequestsPerConnection: "512"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.ScyllaDb);
		expect(pool).toMatchObject({ coreConnectionsPerHost: 2, maxRequestsPerConnection: 512 });
	});

	test("scylladb pool fields are undefined when pool env vars are not set", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "scylladb",
			scylladbHosts: "localhost",
			scylladbLocalDataCenter: "dc1",
			scylladbKeyspace: "ks"
		});

		const pool = connectorPool(config, EntityStorageConnectorType.ScyllaDb);
		expect(pool?.coreConnectionsPerHost).toBeUndefined();
		expect(pool?.maxRequestsPerConnection).toBeUndefined();
	});
});
