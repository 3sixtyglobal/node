// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { cpus } from "node:os";
import type { IIotaConfig } from "@twin.org/dlt-iota";
import { EngineCloneMode } from "@twin.org/engine-models";
import {
	DataConverterConnectorType,
	DataExtractorConnectorType,
	DataProcessingComponentType,
	DataspaceControlPlaneComponentType,
	DltConfigType,
	EmailProtocolConnectorType,
	EntityStorageConnectorType,
	HealthComponentType,
	IdentityConnectorType,
	IdentityResolverConnectorType,
	ImmutableProofComponentType,
	LoggingConnectorType,
	MailboxComponentType,
	MetricsProducerComponentType,
	MailStorageComponentType,
	MessagingAdminComponentType,
	MessagingComponentType,
	MessagingEmailConnectorType,
	SchemaVersionMigrationComponentType,
	TaskSchedulerComponentType,
	TelemetryComponentType,
	TelemetryConnectorType,
	TenantAdminComponentType,
	TracingComponentType,
	TracingConnectorType,
	TrustVerifierComponentType
} from "@twin.org/engine-types";
import { buildEngineConfiguration } from "../../src/builders/engineEnvBuilder.js";
import { DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS } from "../../src/defaults.js";
import type { IEngineEnvironmentVariables } from "../../src/models/IEngineEnvironmentVariables.js";

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

	test("schema migration service is registered with enabled:false when schemaMigrationEnabled is 'false'", async () => {
		const config = await buildEngineConfiguration({ schemaMigrationEnabled: "false" });

		expect(config.types.schemaVersionMigrationComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: SchemaVersionMigrationComponentType.Service,
					options: { config: { enabled: false } }
				})
			])
		);
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

	test("task scheduler is registered when only emailProtocolConnector is set", async () => {
		const config = await buildEngineConfiguration({
			emailProtocolConnector: EmailProtocolConnectorType.Imap
		});

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

describe("buildEngineConfiguration - immutable proof task options", () => {
	/**
	 * Builds the configuration with the immutable proof component enabled and returns its config.
	 * @param envVars The immutable proof env vars to apply.
	 * @returns The resolved immutable proof service config.
	 */
	async function buildImmutableProofConfig(envVars: IEngineEnvironmentVariables): Promise<{
		taskRetryInterval?: number;
		taskFailureRetainFor?: number;
		taskWorkerIdleTimeout?: number;
		taskWorkerCount?: number;
	}> {
		const config = await buildEngineConfiguration({
			auditableItemGraphEnabled: "true",
			...envVars
		});
		const entry = config.types.immutableProofComponent?.find(
			item => item.type === ImmutableProofComponentType.Service
		);
		if (entry?.type !== ImmutableProofComponentType.Service) {
			throw new Error("The immutable proof service component was not configured");
		}
		return entry.options?.config ?? {};
	}

	test("leaves the task options undefined so the service defaults apply", async () => {
		const proofConfig = await buildImmutableProofConfig({});

		expect(proofConfig.taskRetryInterval).toBeUndefined();
		expect(proofConfig.taskFailureRetainFor).toBeUndefined();
		expect(proofConfig.taskWorkerIdleTimeout).toBeUndefined();
		expect(proofConfig.taskWorkerCount).toBeUndefined();
	});

	test("passes the task worker count through as a number", async () => {
		const proofConfig = await buildImmutableProofConfig({
			immutableProofTaskWorkerCount: "3"
		});

		expect(proofConfig.taskWorkerCount).toBe(3);
	});

	test("rejects a task worker count that is not a number", async () => {
		await expect(
			buildImmutableProofConfig({ immutableProofTaskWorkerCount: "three" })
		).rejects.toThrow("invalidEnvVarValue");
	});

	test("converts the task intervals from the env units to milliseconds", async () => {
		const proofConfig = await buildImmutableProofConfig({
			immutableProofTaskRetryInterval: "7",
			immutableProofTaskFailureRetainFor: "3",
			immutableProofTaskWorkerIdleTimeout: "120"
		});

		expect(proofConfig.taskRetryInterval).toBe(7000);
		expect(proofConfig.taskFailureRetainFor).toBe(180_000);
		expect(proofConfig.taskWorkerIdleTimeout).toBe(120_000);
	});

	test("passes the retain forever and never shut down sentinels through unchanged", async () => {
		const proofConfig = await buildImmutableProofConfig({
			immutableProofTaskFailureRetainFor: "-1",
			immutableProofTaskWorkerIdleTimeout: "-1"
		});

		expect(proofConfig.taskFailureRetainFor).toBe(-1);
		expect(proofConfig.taskWorkerIdleTimeout).toBe(-1);
	});

	test("passes a zero idle timeout through so the worker shuts down after every task", async () => {
		const proofConfig = await buildImmutableProofConfig({
			immutableProofTaskWorkerIdleTimeout: "0"
		});

		expect(proofConfig.taskWorkerIdleTimeout).toBe(0);
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

	test("mutex timeout default seeds the connector timeouts when no component value is set", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "memory,file",
			mutexTimeoutDefault: "60000",
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

		expect(memoryMutexTimeoutMs).toBe(60000);
		expect(fileMutexTimeoutMs).toBe(60000);
	});

	test("component mutex timeout overrides the mutex timeout default", async () => {
		const config = await buildEngineConfiguration({
			entityStorageConnectorType: "file",
			entityStorageMutexTimeout: "4321",
			mutexTimeoutDefault: "60000",
			storageFileRoot: "."
		});

		const fileConnector = config.types.entityStorageConnector?.find(
			entry => entry.type === EntityStorageConnectorType.File
		);
		const fileMutexTimeoutMs = (fileConnector?.options as { config?: { mutexTimeoutMs?: number } })
			?.config?.mutexTimeoutMs;

		expect(fileMutexTimeoutMs).toBe(4321);
	});

	test("mutex timeout default seeds the component cache and lock timeouts", async () => {
		const config = await buildEngineConfiguration({
			loggingConnector: LoggingConnectorType.File,
			tenantEnabled: "true",
			identityConnector: IdentityConnectorType.EntityStorage,
			identityResolverConnector: IdentityResolverConnectorType.EntityStorage,
			mutexTimeoutDefault: "60000",
			storageFileRoot: "."
		});

		const getConfig = (
			entries: { type: string; options?: unknown }[] | undefined,
			type: string
		): { [key: string]: unknown } | undefined =>
			(
				entries?.find(entry => entry.type === type)?.options as {
					config?: { [key: string]: unknown };
				}
			)?.config;

		expect(
			getConfig(config.types.loggingConnector, LoggingConnectorType.File)?.mutexTimeoutMs
		).toBe(60000);
		expect(
			getConfig(config.types.tenantAdminComponent, TenantAdminComponentType.Service)
				?.tenantCacheMutexTimeoutMs
		).toBe(60000);
		expect(
			getConfig(config.types.identityConnector, IdentityConnectorType.EntityStorage)
				?.didResolutionCacheMutexTimeoutMs
		).toBe(60000);
		expect(
			getConfig(config.types.identityResolverConnector, IdentityResolverConnectorType.EntityStorage)
				?.didResolutionCacheMutexTimeoutMs
		).toBe(60000);
	});

	test("mutex timeout default seeds the jwt verifiable credential verifier cache timeout", async () => {
		const config = await buildEngineConfiguration({
			dataspaceEnabled: "true",
			trustVerifiers: TrustVerifierComponentType.JwtVerifiableCredential,
			mutexTimeoutDefault: "60000"
		});

		const verifier = config.types.trustVerifierComponent?.find(
			entry => entry.type === TrustVerifierComponentType.JwtVerifiableCredential
		);

		expect(
			(verifier?.options as { config?: { verificationCacheMutexTimeoutMs?: number } })?.config
				?.verificationCacheMutexTimeoutMs
		).toBe(60000);
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

describe("buildEngineConfiguration - messaging connectors", () => {
	test("configures SMTP connection settings", async () => {
		const config = await buildEngineConfiguration({
			messagingEmailConnector: MessagingEmailConnectorType.Smtp,
			smtpHost: "smtp.example.com",
			smtpPort: "465",
			smtpSecure: "true",
			smtpUsername: "smtp-user",
			smtpPassword: "smtp-password"
		});

		expect(config.types.messagingEmailConnector).toEqual([
			expect.objectContaining({
				type: MessagingEmailConnectorType.Smtp,
				options: {
					config: {
						host: "smtp.example.com",
						port: 465,
						secure: true,
						username: "smtp-user",
						password: "smtp-password"
					}
				}
			})
		]);
	});

	test("messaging components are registered when an email connector is configured", async () => {
		const config = await buildEngineConfiguration({
			messagingEmailConnector: MessagingEmailConnectorType.EntityStorage
		});

		expect(config.types.messagingEmailConnector).toEqual([
			expect.objectContaining({ type: MessagingEmailConnectorType.EntityStorage })
		]);
		expect(config.types.messagingAdminComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: MessagingAdminComponentType.Service })
			])
		);
		expect(config.types.messagingComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: MessagingComponentType.Service })])
		);
	});

	test("messaging components are not registered when no messaging connector is configured", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.messagingEmailConnector).toEqual([]);
		expect(config.types.messagingSmsConnector).toEqual([]);
		expect(config.types.messagingPushNotificationConnector).toEqual([]);
		expect(config.types.messagingAdminComponent).toBeUndefined();
		expect(config.types.messagingComponent).toBeUndefined();
	});
});

describe("buildEngineConfiguration - mailbox", () => {
	test("no mailbox stack is registered when emailProtocolConnector is unset", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.emailProtocolConnector).toEqual([]);
		expect(config.types.mailStorageComponent).toBeUndefined();
		expect(config.types.mailboxComponent).toBeUndefined();
	});

	test("pop3 connector registers the mail storage and mailbox components", async () => {
		const config = await buildEngineConfiguration({
			emailProtocolConnector: EmailProtocolConnectorType.Pop3
		});

		expect(config.types.emailProtocolConnector).toEqual([
			expect.objectContaining({
				type: EmailProtocolConnectorType.Pop3,
				isMultiInstance: true
			})
		]);
		expect(config.types.mailStorageComponent).toEqual([
			expect.objectContaining({
				type: MailStorageComponentType.Service,
				cloneMode: EngineCloneMode.Never
			})
		]);
		expect(config.types.mailboxComponent).toEqual([
			expect.objectContaining({
				type: MailboxComponentType.Service,
				cloneMode: EngineCloneMode.Never
			})
		]);
	});

	test("both protocol connectors register a single mail storage and mailbox component", async () => {
		const config = await buildEngineConfiguration({
			emailProtocolConnector: `${EmailProtocolConnectorType.Pop3},${EmailProtocolConnectorType.Imap}`
		});

		expect(config.types.emailProtocolConnector?.map(c => c.type)).toEqual([
			EmailProtocolConnectorType.Pop3,
			EmailProtocolConnectorType.Imap
		]);
		expect(config.types.mailStorageComponent).toHaveLength(1);
		expect(config.types.mailboxComponent).toHaveLength(1);
	});

	test("gmail connector registers the mail storage and mailbox components", async () => {
		const config = await buildEngineConfiguration({
			emailProtocolConnector: EmailProtocolConnectorType.Gmail
		});

		expect(config.types.emailProtocolConnector).toEqual([
			expect.objectContaining({
				type: EmailProtocolConnectorType.Gmail,
				isMultiInstance: true
			})
		]);
		expect(config.types.mailStorageComponent).toHaveLength(1);
		expect(config.types.mailboxComponent).toHaveLength(1);
	});

	test("gmail connector requires the task scheduler for its polling intervals", async () => {
		const config = await buildEngineConfiguration({
			emailProtocolConnector: EmailProtocolConnectorType.Gmail
		});

		expect(config.types.taskSchedulerComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: TaskSchedulerComponentType.Service })
			])
		);
	});

	test("outlook connector registers the mail storage and mailbox components", async () => {
		const config = await buildEngineConfiguration({
			emailProtocolConnector: EmailProtocolConnectorType.Outlook
		});

		expect(config.types.emailProtocolConnector).toEqual([
			expect.objectContaining({
				type: EmailProtocolConnectorType.Outlook,
				isMultiInstance: true
			})
		]);
		expect(config.types.mailStorageComponent).toHaveLength(1);
		expect(config.types.mailboxComponent).toHaveLength(1);
	});

	test("outlook connector requires the task scheduler for its polling intervals", async () => {
		const config = await buildEngineConfiguration({
			emailProtocolConnector: EmailProtocolConnectorType.Outlook
		});

		expect(config.types.taskSchedulerComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: TaskSchedulerComponentType.Service })
			])
		);
	});

	test("throws GeneralError naming the env var for an unknown protocol connector", async () => {
		await expect(buildEngineConfiguration({ emailProtocolConnector: "imap4" })).rejects.toThrow(
			expect.objectContaining({
				name: "GeneralError",
				source: "node",
				properties: expect.objectContaining({ key: "emailProtocolConnector" })
			})
		);
	});
});

describe("buildEngineConfiguration - data processing", () => {
	test("data processing component is not registered when no connectors are configured", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.dataConverterConnector).toEqual([]);
		expect(config.types.dataExtractorConnector).toEqual([]);
		expect(config.types.dataProcessingComponent).toBeUndefined();
	});

	test("data processing component is registered when a converter connector is configured", async () => {
		const config = await buildEngineConfiguration({
			dataConverterConnectors: DataConverterConnectorType.Json
		});

		expect(config.types.dataConverterConnector).toEqual([
			expect.objectContaining({ type: DataConverterConnectorType.Json })
		]);
		expect(config.types.dataProcessingComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: DataProcessingComponentType.Service })
			])
		);
	});

	test("data processing component is registered when only an extractor connector is configured", async () => {
		const config = await buildEngineConfiguration({
			dataExtractorConnectors: DataExtractorConnectorType.JsonPath
		});

		expect(config.types.dataExtractorConnector).toEqual([
			expect.objectContaining({ type: DataExtractorConnectorType.JsonPath })
		]);
		expect(config.types.dataProcessingComponent).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: DataProcessingComponentType.Service })
			])
		);
	});

	test("throws GeneralError naming the env var for an unknown converter connector", async () => {
		await expect(buildEngineConfiguration({ dataConverterConnectors: "json,xnl" })).rejects.toThrow(
			expect.objectContaining({
				name: "GeneralError",
				source: "node",
				properties: expect.objectContaining({ key: "dataConverterConnectors" })
			})
		);
	});
});

describe("buildEngineConfiguration - logging multi-connector", () => {
	test("single logging connector is marked as default", async () => {
		const config = await buildEngineConfiguration({ loggingConnector: "console" });

		const connectors = config.types.loggingConnector ?? [];
		const consoleConnector = connectors.find(c => c.type === LoggingConnectorType.Console);
		const multi = connectors.find(c => c.type === LoggingConnectorType.Multi);

		expect(consoleConnector).toBeDefined();
		expect(consoleConnector?.isDefault).toBe(true);
		expect(multi).toBeUndefined();
	});

	test("two logging connectors produce a multi connector set as the default", async () => {
		const config = await buildEngineConfiguration({
			loggingConnector: "console,entity-storage"
		});

		const connectors = config.types.loggingConnector ?? [];
		const consoleConnector = connectors.find(c => c.type === LoggingConnectorType.Console);
		const entityStorage = connectors.find(c => c.type === LoggingConnectorType.EntityStorage);
		const multi = connectors.find(c => c.type === LoggingConnectorType.Multi);

		expect(consoleConnector).toBeDefined();
		expect(consoleConnector?.isDefault).toBeUndefined();
		expect(entityStorage).toBeDefined();
		expect(entityStorage?.isDefault).toBeUndefined();
		expect(multi).toBeDefined();
		expect(multi?.isDefault).toBe(true);
	});
});

describe("buildEngineConfiguration - telemetry multi-connector", () => {
	test("single telemetry connector is marked as default and service component is registered", async () => {
		const config = await buildEngineConfiguration({
			telemetryConnector: TelemetryConnectorType.EntityStorage
		});

		const connectors = config.types.telemetryConnector ?? [];
		const entityStorage = connectors.find(c => c.type === TelemetryConnectorType.EntityStorage);
		const multi = connectors.find(c => c.type === TelemetryConnectorType.Multi);

		expect(entityStorage).toBeDefined();
		expect(entityStorage?.isDefault).toBe(true);
		expect(multi).toBeUndefined();
		expect(config.types.telemetryComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: TelemetryComponentType.Service })])
		);
	});

	test("two telemetry connectors produce a multi connector set as the default", async () => {
		const config = await buildEngineConfiguration({
			telemetryConnector: `${TelemetryConnectorType.EntityStorage},${TelemetryConnectorType.OpenTelemetry}`
		});

		const connectors = config.types.telemetryConnector ?? [];
		const entityStorage = connectors.find(c => c.type === TelemetryConnectorType.EntityStorage);
		const openTelemetry = connectors.find(c => c.type === TelemetryConnectorType.OpenTelemetry);
		const multi = connectors.find(c => c.type === TelemetryConnectorType.Multi);

		expect(entityStorage).toBeDefined();
		expect(entityStorage?.isDefault).toBeUndefined();
		expect(openTelemetry).toBeDefined();
		expect(openTelemetry?.isDefault).toBeUndefined();
		expect(multi).toBeDefined();
		expect(multi?.isDefault).toBe(true);
		expect(config.types.telemetryComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: TelemetryComponentType.Service })])
		);
	});

	test("silent telemetry connector is marked as default and service component is registered", async () => {
		const config = await buildEngineConfiguration({
			telemetryConnector: TelemetryConnectorType.Silent
		});

		const connectors = config.types.telemetryConnector ?? [];
		const silent = connectors.find(c => c.type === TelemetryConnectorType.Silent);
		const multi = connectors.find(c => c.type === TelemetryConnectorType.Multi);

		expect(silent).toBeDefined();
		expect(silent?.isDefault).toBe(true);
		expect(multi).toBeUndefined();
		expect(config.types.telemetryComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: TelemetryComponentType.Service })])
		);
	});
});

describe("buildEngineConfiguration - telemetry metrics producers", () => {
	test("defaults to the system and process producers when the env var is unset", async () => {
		const config = await buildEngineConfiguration({
			telemetryConnector: TelemetryConnectorType.EntityStorage
		});

		expect(config.types.metricsProducerComponent?.map(p => p.type)).toEqual([
			MetricsProducerComponentType.System,
			MetricsProducerComponentType.Process
		]);
	});

	test("the supplied env vars object is not mutated", async () => {
		const envVars = { telemetryConnector: TelemetryConnectorType.EntityStorage };

		await buildEngineConfiguration(envVars);

		expect(envVars).toEqual({ telemetryConnector: TelemetryConnectorType.EntityStorage });
	});

	test("an explicit producer list replaces the defaults", async () => {
		const config = await buildEngineConfiguration({
			telemetryConnector: TelemetryConnectorType.EntityStorage,
			telemetryMetricsProducers: MetricsProducerComponentType.Process
		});

		expect(config.types.metricsProducerComponent?.map(p => p.type)).toEqual([
			MetricsProducerComponentType.Process
		]);
	});

	test("throws GeneralError naming the env var for an unknown producer", async () => {
		await expect(
			buildEngineConfiguration({
				telemetryConnector: TelemetryConnectorType.EntityStorage,
				telemetryMetricsProducers: "system,disk"
			})
		).rejects.toThrow(
			expect.objectContaining({
				name: "GeneralError",
				source: "node",
				properties: expect.objectContaining({ key: "telemetryMetricsProducers" })
			})
		);
	});
});

describe("buildEngineConfiguration - tracing multi-connector", () => {
	test("single tracing connector is marked as default and service component is registered", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.EntityStorage
		});

		const connectors = config.types.tracingConnector ?? [];
		const entityStorage = connectors.find(c => c.type === TracingConnectorType.EntityStorage);
		const multi = connectors.find(c => c.type === TracingConnectorType.Multi);

		expect(entityStorage).toBeDefined();
		expect(entityStorage?.isDefault).toBe(true);
		expect(multi).toBeUndefined();
		expect(config.types.tracingComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: TracingComponentType.Service })])
		);
	});

	test("two tracing connectors produce a multi connector set as the default", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: `${TracingConnectorType.EntityStorage},${TracingConnectorType.OpenTelemetry}`
		});

		const connectors = config.types.tracingConnector ?? [];
		const entityStorage = connectors.find(c => c.type === TracingConnectorType.EntityStorage);
		const openTelemetry = connectors.find(c => c.type === TracingConnectorType.OpenTelemetry);
		const multi = connectors.find(c => c.type === TracingConnectorType.Multi);

		expect(entityStorage).toBeDefined();
		expect(entityStorage?.isDefault).toBeUndefined();
		expect(openTelemetry).toBeDefined();
		expect(openTelemetry?.isDefault).toBeUndefined();
		expect(multi).toBeDefined();
		expect(multi?.isDefault).toBe(true);
		expect(config.types.tracingComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: TracingComponentType.Service })])
		);
	});

	test("silent tracing connector is marked as default and service component is registered", async () => {
		const config = await buildEngineConfiguration({
			tracingConnector: TracingConnectorType.Silent
		});

		const connectors = config.types.tracingConnector ?? [];
		const silent = connectors.find(c => c.type === TracingConnectorType.Silent);
		const multi = connectors.find(c => c.type === TracingConnectorType.Multi);

		expect(silent).toBeDefined();
		expect(silent?.isDefault).toBe(true);
		expect(multi).toBeUndefined();
		expect(config.types.tracingComponent).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: TracingComponentType.Service })])
		);
	});
});

describe("buildEngineConfiguration - background task service config", () => {
	test("defaults the max system worker count to twice the CPU count when the env var is not set", async () => {
		const config = await buildEngineConfiguration({ healthEnabled: "true" });

		expect(config.types.backgroundTaskComponent?.[0]?.options?.config).toEqual({
			maxSystemWorkerCount: cpus().length * 2,
			taskInterval: undefined,
			retryInterval: undefined,
			cleanupInterval: undefined,
			workerShutdownTimeout: undefined,
			maxDispatchCount: undefined
		});
	});

	test("uses the max system worker count from the env var when set", async () => {
		const config = await buildEngineConfiguration({
			healthEnabled: "true",
			backgroundTaskMaxSystemWorkerCount: "3"
		});

		expect(config.types.backgroundTaskComponent?.[0]?.options?.config).toMatchObject({
			maxSystemWorkerCount: 3
		});
	});

	test("throws when the max system worker count is not an integer", async () => {
		await expect(
			buildEngineConfiguration({
				healthEnabled: "true",
				backgroundTaskMaxSystemWorkerCount: "lots"
			})
		).rejects.toThrow("invalidEnvVarValue");
	});

	test("wires the interval and timeout env vars through to the service config", async () => {
		const config = await buildEngineConfiguration({
			healthEnabled: "true",
			backgroundTaskInterval: "250",
			backgroundTaskRetryInterval: "7500",
			backgroundTaskCleanupInterval: "240000",
			backgroundTaskWorkerShutdownTimeout: "9000"
		});

		expect(config.types.backgroundTaskComponent?.[0]?.options?.config).toMatchObject({
			taskInterval: 250,
			retryInterval: 7500,
			cleanupInterval: 240000,
			workerShutdownTimeout: 9000
		});
	});

	test("uses the max dispatch count from the env var when set", async () => {
		const config = await buildEngineConfiguration({
			healthEnabled: "true",
			backgroundTaskMaxDispatchCount: "5"
		});

		expect(config.types.backgroundTaskComponent?.[0]?.options?.config).toMatchObject({
			maxDispatchCount: 5
		});
	});

	test("allows the max dispatch count to be set to -1 for no limit", async () => {
		const config = await buildEngineConfiguration({
			healthEnabled: "true",
			backgroundTaskMaxDispatchCount: "-1"
		});

		expect(config.types.backgroundTaskComponent?.[0]?.options?.config).toMatchObject({
			maxDispatchCount: -1
		});
	});

	test("throws when the max dispatch count is not an integer", async () => {
		await expect(
			buildEngineConfiguration({
				healthEnabled: "true",
				backgroundTaskMaxDispatchCount: "many"
			})
		).rejects.toThrow("invalidEnvVarValue");
	});

	test("throws when an interval env var is not an integer", async () => {
		await expect(
			buildEngineConfiguration({ healthEnabled: "true", backgroundTaskInterval: "soon" })
		).rejects.toThrow("invalidEnvVarValue");
	});

	test("does not register the background task component when no dependent feature is enabled", async () => {
		const config = await buildEngineConfiguration({});

		expect(config.types.backgroundTaskComponent).toEqual([]);
	});
});

describe("buildEngineConfiguration - health exclude clone components", () => {
	/**
	 * Read the exclude clone component patterns from a built config, narrowing the health component
	 * config union to the service variant which carries them.
	 * @param config The built engine configuration.
	 * @returns The patterns, or undefined when the service health component is not configured.
	 */
	function excludeCloneComponents(
		config: Awaited<ReturnType<typeof buildEngineConfiguration>>
	): string[] | undefined {
		const entry = config.types.healthComponent?.[0];
		return entry?.type === HealthComponentType.Service
			? entry.options?.config?.excludeCloneComponents
			: undefined;
	}

	test("defaults the exclude clone component patterns when the env var is not set", async () => {
		const config = await buildEngineConfiguration({ healthEnabled: "true" });

		expect(excludeCloneComponents(config)).toEqual(DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS);
	});

	test("uses the exclude clone component patterns from the env var when set", async () => {
		const config = await buildEngineConfiguration({
			healthEnabled: "true",
			healthExcludeCloneComponents: "^nft, ^attestation"
		});

		expect(excludeCloneComponents(config)).toEqual(["^nft", "^attestation"]);
	});

	test("falls back to the default exclude clone component patterns for an empty env var", async () => {
		const config = await buildEngineConfiguration({
			healthEnabled: "true",
			healthExcludeCloneComponents: ""
		});

		expect(excludeCloneComponents(config)).toEqual(DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS);
	});

	test("does not exclude any component type the application health providers depend on", async () => {
		const patterns = DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS.map(pattern => new RegExp(pattern));

		// These are resolved with getRegisteredInstanceType or ComponentFactory.get by components
		// which implement healthApplication, so removing them from the clone breaks worker startup.
		const required = [
			"platformComponent",
			"contextIdHandlerComponent",
			"loggingConnector",
			"loggingComponent",
			"backgroundTaskComponent",
			"taskSchedulerComponent",
			"entityStorageComponent",
			"vaultConnector",
			"blobStorageConnector",
			"blobStorageComponent",
			"faucetConnector",
			"walletConnector",
			"identityConnector",
			"identityComponent",
			"identityResolverConnector",
			"identityResolverComponent",
			"nftConnector",
			"nftComponent",
			"notarizationConnector",
			"notarizationComponent",
			"immutableProofComponent",
			"attestationConnector",
			"attestationComponent",
			"auditableItemGraphComponent",
			"auditableItemStreamComponent",
			"dataExtractorConnector",
			"dataProcessingComponent",
			"documentManagementComponent",
			"tenantAdminComponent"
		];

		for (const typeKey of required) {
			expect(
				patterns.some(pattern => pattern.test(typeKey)),
				`${typeKey} must not be excluded from the health engine clone`
			).toEqual(false);
		}
	});

	test("excludes the component types which provide no application health checks", async () => {
		const patterns = DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS.map(pattern => new RegExp(pattern));

		const excluded = [
			"rightsManagementPapComponent",
			"rightsManagementPolicyArbiterComponent",
			"dataspaceControlPlaneComponent",
			"dataspaceDataPlaneComponent",
			"federatedCatalogueComponent",
			"federatedCatalogueFilterComponent",
			"trustComponent",
			"trustGeneratorComponent",
			"trustVerifierComponent",
			"automationComponent",
			"automationAction",
			"telemetryConnector",
			"telemetryComponent",
			"tracingConnector",
			"tracingComponent",
			"restClientProcessor"
		];

		for (const typeKey of excluded) {
			expect(
				patterns.some(pattern => pattern.test(typeKey)),
				`${typeKey} should be excluded from the health engine clone`
			).toEqual(true);
		}
	});
});
