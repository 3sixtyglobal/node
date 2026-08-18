// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Is, Mutex } from "@twin.org/core";
import type { IIotaConfig } from "@twin.org/dlt-iota";
import {
	AttestationComponentType,
	AttestationConnectorType,
	AuditableItemGraphComponentType,
	AuditableItemStreamComponentType,
	type AutomationActionConfig,
	type AutomationActionType,
	AutomationComponentType,
	BackgroundTaskComponentType,
	BlobStorageComponentType,
	BlobStorageConnectorType,
	ContextIdHandlerComponentType,
	type DataConverterConnectorType,
	type DataExtractorConnectorType,
	DataProcessingComponentType,
	DataspaceControlPlaneComponentType,
	DataspaceDataPlaneComponentType,
	type DltConfig,
	DltConfigType,
	DocumentManagementComponentType,
	EngineTypeHelper,
	EntityStorageConnectorType,
	EventBusComponentType,
	EventBusConnectorType,
	FaucetConnectorType,
	FederatedCatalogueComponentType,
	type FederatedCatalogueFilterComponentType,
	HealthComponentType,
	IdentityComponentType,
	IdentityConnectorType,
	IdentityProfileComponentType,
	IdentityProfileConnectorType,
	IdentityResolverComponentType,
	IdentityResolverConnectorType,
	type IEngineConfig,
	ImmutableProofComponentType,
	LoggingComponentType,
	LoggingConnectorType,
	MessagingAdminComponentType,
	MessagingComponentType,
	MessagingEmailConnectorType,
	MessagingPushNotificationConnectorType,
	MessagingSmsConnectorType,
	MetricsCollectorComponentType,
	MetricsProducerComponentType,
	NftComponentType,
	NftConnectorType,
	NotarizationComponentType,
	NotarizationConnectorType,
	PlatformComponentType,
	RightsManagementPapComponentType,
	RightsManagementPdpComponentType,
	RightsManagementPepComponentType,
	RightsManagementPipComponentType,
	RightsManagementPmpComponentType,
	RightsManagementPnapComponentType,
	RightsManagementPnpComponentType,
	type RightsManagementPolicyArbiterComponentType,
	type RightsManagementPolicyEnforcementProcessorComponentType,
	type RightsManagementPolicyExecutionActionComponentType,
	type RightsManagementPolicyInformationSourceComponentType,
	type RightsManagementPolicyNegotiatorComponentType,
	type RightsManagementPolicyObligationEnforcerComponentType,
	type RightsManagementPolicyRequesterComponentType,
	RightsManagementPxpComponentType,
	SchemaVersionMigrationComponentType,
	TaskSchedulerComponentType,
	TelemetryComponentType,
	TelemetryConnectorType,
	TenantAdminComponentType,
	TracingComponentType,
	TracingConnectorType,
	TrustComponentType,
	type TrustGeneratorComponentType,
	TrustVerifierComponentType,
	VaultConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import {
	type IOpenTelemetryLoggingConnectorConfig,
	type IOpenTelemetryOtlpExporterConfig,
	OpenTelemetryExporterTypes
} from "@twin.org/logging-connector-opentelemetry";
import {
	type IOpenTelemetryTelemetryConnectorConfig,
	OpenTelemetryReaderTypes
} from "@twin.org/telemetry-connector-opentelemetry";
import {
	type IOpenTelemetryTracingConnectorConfig,
	OpenTelemetryProcessorTypes
} from "@twin.org/tracing-connector-opentelemetry";
import { CONTEXT_ID_HANDLER_FEATURE_DID, CONTEXT_ID_HANDLER_FEATURE_TENANT } from "../defaults.js";
import { isAuthEntityStorageRequired } from "./engineServerEnvBuilder.js";
import {
	commaSeparatedListToArray,
	envBoolean,
	envCount,
	envDateTime,
	envInteger,
	envMinToMs,
	envMinutes,
	envMs,
	envSecToMs,
	envSeconds
} from "./helper/envHelpers.js";
import type { IEngineEnvironmentVariables } from "../models/IEngineEnvironmentVariables.js";

/**
 * Build the engine core configuration from environment variables.
 * @param envVars The environment variables.
 * @returns The config for the core.
 */
export async function buildEngineConfiguration(
	envVars: IEngineEnvironmentVariables
): Promise<IEngineConfig> {
	if (Is.stringValue(envVars.storageFileRoot)) {
		envVars.stateFilename ??= "engine-state.json";
		envVars.storageFileRoot = path.resolve(envVars.storageFileRoot);
		envVars.stateFilename = path.join(envVars.storageFileRoot, envVars.stateFilename);
	}

	const coreConfig: IEngineConfig = {
		debug: envBoolean(envVars, "debug", false),
		silent: envBoolean(envVars, "silent", false),
		silentLoggers: commaSeparatedListToArray(envVars.loggingSilentComponents),
		types: {}
	};

	const mutexTimeoutMs = envMs(envVars, "mutexTimeoutDefault");
	if (!Is.empty(mutexTimeoutMs)) {
		Mutex.setDefaultTimeoutMs(mutexTimeoutMs);
	}

	await configureSchemaMigration(coreConfig, envVars);
	await configurePlatform(coreConfig, envVars);
	await configureTenant(coreConfig, envVars);
	await configureContextIdHandlers(coreConfig, envVars);

	await configureEntityStorage(coreConfig, envVars);
	await configureBlobStorage(coreConfig, envVars);
	await configureVault(coreConfig, envVars);
	await configureDlt(coreConfig, envVars);

	await configureLogging(coreConfig, envVars);
	await configureBackgroundTask(coreConfig, envVars);
	await configureTaskScheduler(coreConfig, envVars);
	await configureEventBus(coreConfig, envVars);
	await configureTelemetry(coreConfig, envVars);
	await configureMetricsCollector(coreConfig, envVars);
	await configureTracing(coreConfig, envVars);
	await configureMessaging(coreConfig, envVars);
	await configureAutomation(coreConfig, envVars);
	await configureHealth(coreConfig, envVars);

	await configureFaucet(coreConfig, envVars);
	await configureWallet(coreConfig, envVars);
	await configureNft(coreConfig, envVars);
	await configureNotarization(coreConfig, envVars);
	await configureImmutableProof(coreConfig, envVars);
	await configureIdentity(coreConfig, envVars);
	await configureIdentityResolver(coreConfig, envVars);
	await configureIdentityProfile(coreConfig, envVars);
	await configureAttestation(coreConfig, envVars);
	await configureDataProcessing(coreConfig, envVars);

	await configureAuditableItemGraph(coreConfig, envVars);
	await configureAuditableItemStream(coreConfig, envVars);
	await configureDocumentManagement(coreConfig, envVars);
	await configureTrust(coreConfig, envVars);
	await configureRightsManagement(coreConfig, envVars);

	await configureFederatedCatalogue(coreConfig, envVars);
	await configureDataspace(coreConfig, envVars);

	return coreConfig;
}

/**
 * Configures the entity storage.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the entity storage configuration has been applied.
 */
async function configureEntityStorage(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types ??= {};
	coreConfig.types.entityStorageConnector ??= [];

	const entityStorageConnectorTypes = commaSeparatedListToArray<EntityStorageConnectorType>(
		envVars.entityStorageConnectorType
	);

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.Memory)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.Memory,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout")
				}
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.File)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.File,
			options: {
				config: {
					directory: envVars.storageFileRoot ?? "",
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout")
				},
				folderPrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.AwsDynamoDb)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.AwsDynamoDb,
			options: {
				config: {
					region: envVars.awsDynamodbRegion ?? "",
					authMode: envVars.awsDynamodbAuthMode as "credentials" | "pod",
					accessKeyId: envVars.awsDynamodbAccessKeyId,
					secretAccessKey: envVars.awsDynamodbSecretAccessKey,
					endpoint: envVars.awsDynamodbEndpoint,
					connectionTimeoutMs: envMs(envVars, "awsDynamodbConnectionTimeout"),
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout")
				},
				tablePrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.AzureCosmosDb)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.AzureCosmosDb,
			options: {
				config: {
					endpoint: envVars.azureCosmosdbEndpoint ?? "",
					key: envVars.azureCosmosdbKey ?? "",
					databaseId: envVars.azureCosmosdbDatabaseId ?? "",
					containerId: envVars.azureCosmosdbContainerId ?? "",
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout")
				},
				tablePrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.GcpFirestoreDb)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.GcpFirestoreDb,
			options: {
				config: {
					projectId: envVars.gcpFirestoreProjectId ?? "",
					credentials: envVars.gcpFirestoreCredentials ?? "",
					databaseId: envVars.gcpFirestoreDatabaseId ?? "",
					collectionName: envVars.gcpFirestoreCollectionName ?? "",
					endpoint: envVars.gcpFirestoreEndpoint ?? "",
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout")
				},
				tablePrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.ScyllaDb)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.ScyllaDb,
			options: {
				config: {
					hosts: commaSeparatedListToArray(envVars.scylladbHosts),
					localDataCenter: envVars.scylladbLocalDataCenter ?? "",
					keyspace: envVars.scylladbKeyspace ?? "",
					port: envInteger(envVars, "scylladbPort"),
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout"),
					pool: {
						coreConnectionsPerHost: envCount(envVars, "scylladbPoolCoreConnectionsPerHost"),
						maxRequestsPerConnection: envCount(envVars, "scylladbPoolMaxRequestsPerConnection")
					}
				},
				tablePrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.MySqlDb)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.MySqlDb,
			options: {
				config: {
					host: envVars.mySqlHost ?? "",
					port: envInteger(envVars, "mySqlPort"),
					user: envVars.mySqlUser ?? "",
					password: envVars.mySqlPassword ?? "",
					database: envVars.mySqlDatabase ?? "",
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout"),
					pool: {
						connectionLimit: envCount(envVars, "mySqlPoolConnectionLimit"),
						maxIdle: envCount(envVars, "mySqlPoolMaxIdle"),
						idleTimeout: envMs(envVars, "mySqlPoolIdleTimeout"),
						enableKeepAlive: envBoolean(envVars, "mySqlPoolEnableKeepAlive"),
						waitForConnections: envBoolean(envVars, "mySqlPoolWaitForConnections"),
						queueLimit: envCount(envVars, "mySqlPoolQueueLimit")
					}
				},
				tablePrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.MongoDb)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.MongoDb,
			options: {
				config: {
					host: envVars.mongoDbHost ?? "",
					port: envInteger(envVars, "mongoDbPort"),
					user: envVars.mongoDbUser ?? "",
					password: envVars.mongoDbPassword ?? "",
					database: envVars.mongoDbDatabase ?? "",
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout"),
					pool: {
						maxPoolSize: envCount(envVars, "mongoDbPoolMaxPoolSize"),
						minPoolSize: envCount(envVars, "mongoDbPoolMinPoolSize"),
						maxIdleTimeMs: envMs(envVars, "mongoDbPoolMaxIdleTime"),
						waitQueueTimeoutMs: envMs(envVars, "mongoDbPoolWaitQueueTimeout")
					}
				},
				tablePrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.PostgreSql)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.PostgreSql,
			options: {
				config: {
					host: envVars.postgreSqlHost ?? "",
					port: envInteger(envVars, "postgreSqlPort"),
					user: envVars.postgreSqlUser ?? "",
					password: envVars.postgreSqlPassword ?? "",
					database: envVars.postgreSqlDatabase ?? "",
					mutexTimeoutMs: envMs(envVars, "entityStorageMutexTimeout"),
					pool: {
						max: envCount(envVars, "postgreSqlPoolMax"),
						idleTimeout: envSeconds(envVars, "postgreSqlPoolIdleTimeout"),
						connectTimeout: envSeconds(envVars, "postgreSqlPoolConnectTimeout"),
						maxLifetime: envSeconds(envVars, "postgreSqlPoolMaxLifetime")
					}
				},
				tablePrefix: envVars.entityStorageTablePrefix
			}
		});
	}

	const defaultEntityStorageConnectorType =
		envVars.entityStorageConnectorDefault ?? entityStorageConnectorTypes[0];

	if (Is.arrayValue(entityStorageConnectorTypes)) {
		for (const config of coreConfig.types.entityStorageConnector) {
			if (config.type === defaultEntityStorageConnectorType) {
				config.isDefault = true;
				break;
			}
		}
	}
}

/**
 * Configures the blob storage.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the blob storage configuration has been applied.
 */
async function configureBlobStorage(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.blobStorageConnector ??= [];

	const blobStorageConnectorTypes = commaSeparatedListToArray(envVars.blobStorageConnectorType);

	if (blobStorageConnectorTypes.includes(BlobStorageConnectorType.Memory)) {
		coreConfig.types.blobStorageConnector.push({
			type: BlobStorageConnectorType.Memory
		});
	}

	if (blobStorageConnectorTypes.includes(BlobStorageConnectorType.File)) {
		coreConfig.types.blobStorageConnector.push({
			type: BlobStorageConnectorType.File,
			options: {
				config: {
					directory: Is.stringValue(envVars.storageFileRoot)
						? path.join(envVars.storageFileRoot, "blob-storage")
						: ""
				},
				storagePrefix: envVars.blobStoragePrefix
			}
		});
	}

	if (blobStorageConnectorTypes.includes(BlobStorageConnectorType.Ipfs)) {
		coreConfig.types.blobStorageConnector.push({
			type: BlobStorageConnectorType.Ipfs,
			options: {
				config: {
					apiUrl: envVars.ipfsApiUrl ?? "",
					bearerToken: envVars.ipfsBearerToken
				}
			}
		});
	}

	if (blobStorageConnectorTypes.includes(BlobStorageConnectorType.AwsS3)) {
		coreConfig.types.blobStorageConnector.push({
			type: BlobStorageConnectorType.AwsS3,
			options: {
				config: {
					region: envVars.awsS3Region ?? "",
					bucketName: envVars.awsS3BucketName ?? "",
					authMode: envVars.awsS3AuthMode as "credentials" | "pod",
					accessKeyId: envVars.awsS3AccessKeyId,
					secretAccessKey: envVars.awsS3SecretAccessKey,
					endpoint: envVars.awsS3Endpoint
				},
				storagePrefix: envVars.blobStoragePrefix
			}
		});
	}

	if (blobStorageConnectorTypes.includes(BlobStorageConnectorType.AzureStorage)) {
		coreConfig.types.blobStorageConnector.push({
			type: BlobStorageConnectorType.AzureStorage,
			options: {
				config: {
					accountName: envVars.azureStorageAccountName ?? "",
					accountKey: envVars.azureStorageAccountKey ?? "",
					containerName: envVars.azureStorageContainerName ?? "",
					endpoint: envVars.azureStorageEndpoint ?? ""
				},
				storagePrefix: envVars.blobStoragePrefix
			}
		});
	}

	if (blobStorageConnectorTypes.includes(BlobStorageConnectorType.GcpStorage)) {
		coreConfig.types.blobStorageConnector.push({
			type: BlobStorageConnectorType.GcpStorage,
			options: {
				config: {
					projectId: envVars.gcpStorageProjectId ?? "",
					credentials: envVars.gcpStorageCredentials ?? "",
					bucketName: envVars.gcpStorageBucketName ?? "",
					apiEndpoint: envVars.gcpFirestoreEndpoint
				},
				storagePrefix: envVars.blobStoragePrefix
			}
		});
	}

	if (Is.arrayValue(blobStorageConnectorTypes)) {
		const defaultStorageConnectorType =
			envVars.blobStorageConnectorDefault ?? blobStorageConnectorTypes[0];
		for (const config of coreConfig.types.blobStorageConnector) {
			if (config.type === defaultStorageConnectorType) {
				config.isDefault = true;
			}
		}
	}

	if (coreConfig.types.blobStorageConnector.length > 0) {
		coreConfig.types.blobStorageComponent ??= [];
		coreConfig.types.blobStorageComponent.push({
			type: BlobStorageComponentType.Service,
			options: {
				config: {
					vaultKeyId:
						(envVars.blobStorageEnableEncryption ?? false)
							? envVars.blobStorageEncryptionKeyId
							: undefined
				}
			}
		});
	}
}

/**
 * Configures the logging.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the logging configuration has been applied.
 */
async function configureLogging(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.loggingConnector ??= [];

	const loggingConnectorTypes = commaSeparatedListToArray<LoggingConnectorType>(
		envVars.loggingConnector
	);
	let additionalConnectorCount = 0;

	for (const loggingConnector of loggingConnectorTypes) {
		if (loggingConnector === LoggingConnectorType.Console) {
			coreConfig.types.loggingConnector.push({
				type: LoggingConnectorType.Console,
				options: {
					config: {
						translateMessages: true,
						hideGroups: true
					}
				}
			});
			additionalConnectorCount++;
		} else if (loggingConnector === LoggingConnectorType.EntityStorage) {
			coreConfig.types.loggingConnector.push({
				type: LoggingConnectorType.EntityStorage,
				options: {
					config: {
						batchSize: envCount(envVars, "loggingBatchSize"),
						batchIntervalMs: envSecToMs(envVars, "loggingBatchFlushInterval"),
						retainForMs: envMinToMs(envVars, "loggingRetainFor"),
						maxEntries: envCount(envVars, "loggingMaxEntries"),
						retentionIntervalMs: envMinToMs(envVars, "loggingRetentionInterval"),
						retentionBatchSize: envCount(envVars, "loggingRetentionBatchSize"),
						mutexTimeoutMs: envMs(envVars, "loggingMutexTimeout")
					}
				}
			});
			additionalConnectorCount++;
		} else if (loggingConnector === LoggingConnectorType.OpenTelemetry) {
			const otelLoggingConfig: IOpenTelemetryLoggingConnectorConfig = {
				loggerName: envVars.openTelemetryLoggingLoggerName,
				loggerVersion: envVars.openTelemetryLoggingLoggerVersion
			};
			if (Is.stringValue(envVars.openTelemetryLoggingPrometheusEndpoint)) {
				otelLoggingConfig.exporters = {
					otlp: {
						type: OpenTelemetryExporterTypes.Otlp,
						endpoint: envVars.openTelemetryLoggingPrometheusEndpoint,
						processor:
							(envVars.openTelemetryLoggingProcessor as IOpenTelemetryOtlpExporterConfig["processor"]) ??
							"batch"
					}
				};
			}
			coreConfig.types.loggingConnector.push({
				type: LoggingConnectorType.OpenTelemetry,
				options: {
					config: otelLoggingConfig
				}
			});
			additionalConnectorCount++;
		} else if (loggingConnector === LoggingConnectorType.File) {
			coreConfig.types.loggingConnector.push({
				type: LoggingConnectorType.File,
				options: {
					config: {
						directory: envVars.loggingFileDirectory ?? envVars.storageFileRoot ?? "",
						filename: envVars.loggingFileFilename,
						maxFileSizeBytes: envCount(envVars, "loggingFileMaxFileSizeBytes"),
						maxRetainedFiles: envCount(envVars, "loggingFileMaxRetainedFiles"),
						mutexTimeoutMs: envMs(envVars, "loggingMutexTimeout")
					}
				}
			});
			additionalConnectorCount++;
		}
	}

	// If more than one logging connector, then we need to add a multi connector
	// and set it as the default one
	if (additionalConnectorCount > 1) {
		coreConfig.types.loggingConnector.push({
			type: LoggingConnectorType.Multi,
			options: {
				loggingConnectorTypes
			},
			isDefault: true
		});
	} else if (additionalConnectorCount > 0) {
		// If only one connector, then we set it as the default one
		coreConfig.types.loggingConnector[coreConfig.types.loggingConnector.length - 1].isDefault =
			true;
	}

	if (additionalConnectorCount > 0) {
		coreConfig.types.loggingComponent ??= [];
		// We set the isDefault flag so that other components will get this service by default
		// and not the generic one from the engine core
		coreConfig.types.loggingComponent.push({ type: LoggingComponentType.Service, isDefault: true });
	}
}

/**
 * Configures the vault.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the vault configuration has been applied.
 */
async function configureVault(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.vaultConnector ??= [];

	if (envVars.vaultConnector === VaultConnectorType.EntityStorage) {
		coreConfig.types.vaultConnector.push({
			type: VaultConnectorType.EntityStorage,
			options: {
				config: {
					prefix: envVars.vaultPrefix
				}
			}
		});
	} else if (envVars.vaultConnector === VaultConnectorType.Hashicorp) {
		coreConfig.types.vaultConnector.push({
			type: VaultConnectorType.Hashicorp,
			options: {
				config: {
					endpoint: envVars.hashicorpVaultEndpoint ?? "",
					token: envVars.hashicorpVaultToken ?? "",
					prefix: envVars.vaultPrefix
				}
			}
		});
	}
}

/**
 * Configures the background task.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the background task configuration has been applied.
 */
async function configureBackgroundTask(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.backgroundTaskComponent ??= [];

	if (isBackgroundTasksRequired(envVars)) {
		coreConfig.types.backgroundTaskComponent.push({
			type: BackgroundTaskComponentType.Service
		});
	}
}

/**
 * Configures the event bus.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the event bus configuration has been applied.
 */
async function configureEventBus(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.eventBusConnector ??= [];

	if (envVars.eventBusConnector === EventBusConnectorType.Local) {
		coreConfig.types.eventBusConnector.push({
			type: EventBusConnectorType.Local
		});
	}

	if (coreConfig.types.eventBusConnector.length > 0) {
		coreConfig.types.eventBusComponent ??= [];
		coreConfig.types.eventBusComponent.push({ type: EventBusComponentType.Service });
	}
}

/**
 * Configures the telemetry.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the telemetry configuration has been applied.
 */
async function configureTelemetry(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.telemetryConnector ??= [];

	if (envVars.telemetryConnector === TelemetryConnectorType.EntityStorage) {
		coreConfig.types.telemetryConnector.push({
			type: TelemetryConnectorType.EntityStorage,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "telemetryMutexTimeout")
				}
			}
		});
	} else if (envVars.telemetryConnector === TelemetryConnectorType.OpenTelemetry) {
		let readers: IOpenTelemetryTelemetryConnectorConfig["readers"];
		if (envVars.openTelemetryReader === OpenTelemetryReaderTypes.Prometheus) {
			readers = {
				prometheus: {
					type: OpenTelemetryReaderTypes.Prometheus,
					port: envCount(envVars, "openTelemetryPrometheusPort")
				}
			};
		}
		coreConfig.types.telemetryConnector.push({
			type: TelemetryConnectorType.OpenTelemetry,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "telemetryMutexTimeout"),
					meterName: envVars.openTelemetryMeterName,
					meterVersion: envVars.openTelemetryMeterVersion,
					readers
				}
			}
		});
	}

	if (coreConfig.types.telemetryConnector.length > 0) {
		coreConfig.types.telemetryComponent ??= [];
		coreConfig.types.telemetryComponent.push({ type: TelemetryComponentType.Service });
	}
}

/**
 * Configures the metrics producers and orchestrator service.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the metrics collector configuration has been applied.
 */
async function configureMetricsCollector(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isTelemetryRequired(envVars)) {
		coreConfig.types.metricsCollectorComponent ??= [];
		coreConfig.types.metricsCollectorComponent.push({
			type: MetricsCollectorComponentType.Service,
			options: {
				config: {
					intervalMs: envSecToMs(envVars, "telemetryMetricsCollectorInterval")
				}
			},
			isCloneable: false
		});

		coreConfig.types.metricsProducerComponent ??= [];

		const metricsProducers = commaSeparatedListToArray(
			envVars.telemetryMetricsProducers ??
				[MetricsProducerComponentType.System, MetricsProducerComponentType.Process].join(",")
		);

		for (const producerType of metricsProducers) {
			coreConfig.types.metricsProducerComponent.push({
				type: producerType as MetricsProducerComponentType,
				options: { maxHistory: envCount(envVars, "telemetryMetricsProducerMaxHistory") },
				isCloneable: false
			});
		}
	}
}

/**
 * Configures the tracing.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the tracing configuration has been applied.
 */
async function configureTracing(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.tracingConnector ??= [];

	if (envVars.tracingConnector === TracingConnectorType.EntityStorage) {
		coreConfig.types.tracingConnector.push({
			type: TracingConnectorType.EntityStorage,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "tracingMutexTimeout")
				}
			}
		});
	} else if (envVars.tracingConnector === TracingConnectorType.OpenTelemetry) {
		const otelTracingConfig: IOpenTelemetryTracingConnectorConfig = {
			tracerName: envVars.openTelemetryTracingTracerName,
			tracerVersion: envVars.openTelemetryTracingTracerVersion
		};
		if (Is.stringValue(envVars.openTelemetryTracingEndpoint)) {
			otelTracingConfig.exporters = {
				otlp: {
					endpoint: envVars.openTelemetryTracingEndpoint,
					processor:
						(envVars.openTelemetryTracingProcessor as OpenTelemetryProcessorTypes) ??
						OpenTelemetryProcessorTypes.Batch
				}
			};
		}
		coreConfig.types.tracingConnector.push({
			type: TracingConnectorType.OpenTelemetry,
			options: {
				config: otelTracingConfig
			}
		});
	}

	if (coreConfig.types.tracingConnector.length > 0) {
		coreConfig.types.tracingComponent ??= [];
		coreConfig.types.tracingComponent.push({ type: TracingComponentType.Service });
	}
}

/**
 * Configures the automation.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the automation configuration has been applied.
 */
async function configureAutomation(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.automationComponent ??= [];

	if (isAutomationRequired(envVars)) {
		coreConfig.types.automationComponent.push({
			type: AutomationComponentType.Service
		});

		const automationActionTypes = commaSeparatedListToArray(envVars.automationActionTypes);

		if (Is.arrayValue(automationActionTypes)) {
			coreConfig.types.automationAction ??= [];

			for (const actionType of automationActionTypes) {
				coreConfig.types.automationAction.push({
					type: actionType as AutomationActionType,
					isMultiInstance: true
				} as unknown as AutomationActionConfig);
			}
		}
	}
}

/**
 * Configures the health.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the health configuration has been applied.
 */
async function configureHealth(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.healthComponent ??= [];

	if (envBoolean(envVars, "healthEnabled", false)) {
		coreConfig.types.healthComponent.push({
			type: HealthComponentType.Service,
			options: {
				config: {
					healthCheckInterval: envSecToMs(envVars, "healthInterval"),
					healthCheckApplicationInterval: envSecToMs(envVars, "healthApplicationInterval"),
					initialInterval: envSecToMs(envVars, "healthStartupInterval")
				}
			},
			isCloneable: false
		});
	}
}

/**
 * Configures the schema migration.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the schema migration configuration has been applied.
 */
async function configureSchemaMigration(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	const isSchemaMigrationEnabled = envBoolean(envVars, "schemaMigrationEnabled", true);

	coreConfig.types.schemaVersionMigrationComponent ??= [];
	coreConfig.types.schemaVersionMigrationComponent.push({
		type: SchemaVersionMigrationComponentType.Service,
		options: { config: { enabled: isSchemaMigrationEnabled } },
		isCloneable: false
	});
}

/**
 * Configures the platform.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the platform configuration has been applied.
 */
async function configurePlatform(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	const isTenantEnabled = envBoolean(envVars, "tenantEnabled", false);

	coreConfig.types.platformComponent ??= [];
	coreConfig.types.platformComponent.push({
		type: PlatformComponentType.Service,
		options: {
			config: {
				isMultiTenant: isTenantEnabled
			}
		}
	});
}

/**
 * Configures the tenant.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the tenant configuration has been applied.
 */
async function configureTenant(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	const isTenantEnabled = envBoolean(envVars, "tenantEnabled", false);

	if (isTenantEnabled) {
		coreConfig.types.tenantAdminComponent ??= [];
		coreConfig.types.tenantAdminComponent.push({
			type: TenantAdminComponentType.Service
		});
	}
}

/**
 * Configures the context ID handlers.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the context ID handler configuration has been applied.
 */
async function configureContextIdHandlers(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.contextIdHandlerComponent ??= [];
	coreConfig.types.contextIdHandlerComponent.push({
		type: ContextIdHandlerComponentType.Did,
		features: [CONTEXT_ID_HANDLER_FEATURE_DID]
	});
	if (envBoolean(envVars, "tenantEnabled", false)) {
		coreConfig.types.contextIdHandlerComponent.push({
			type: ContextIdHandlerComponentType.Tenant,
			features: [CONTEXT_ID_HANDLER_FEATURE_TENANT]
		});
	}
}

/**
 * Configures the messaging.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the messaging configuration has been applied.
 */
async function configureMessaging(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (envBoolean(envVars, "messagingEnabled", false)) {
		coreConfig.types.messagingEmailConnector ??= [];
		coreConfig.types.messagingSmsConnector ??= [];
		coreConfig.types.messagingPushNotificationConnector ??= [];

		if (envVars.messagingEmailConnector === MessagingEmailConnectorType.EntityStorage) {
			coreConfig.types.messagingEmailConnector.push({
				type: MessagingEmailConnectorType.EntityStorage
			});
		} else if (envVars.messagingEmailConnector === MessagingEmailConnectorType.Aws) {
			coreConfig.types.messagingEmailConnector.push({
				type: MessagingEmailConnectorType.Aws,
				options: {
					config: {
						region: envVars.awsSesRegion ?? "",
						authMode: envVars.awsSesAuthMode as "credentials" | "pod",
						accessKeyId: envVars.awsSesAccessKeyId,
						secretAccessKey: envVars.awsSesSecretAccessKey,
						endpoint: envVars.awsSesEndpoint
					}
				}
			});
		}

		if (envVars.messagingSmsConnector === MessagingSmsConnectorType.EntityStorage) {
			coreConfig.types.messagingSmsConnector.push({
				type: MessagingSmsConnectorType.EntityStorage
			});
		} else if (envVars.messagingSmsConnector === MessagingSmsConnectorType.Aws) {
			coreConfig.types.messagingSmsConnector.push({
				type: MessagingSmsConnectorType.Aws,
				options: {
					config: {
						region: envVars.awsSesRegion ?? "",
						authMode: envVars.awsSesAuthMode as "credentials" | "pod",
						accessKeyId: envVars.awsSesAccessKeyId,
						secretAccessKey: envVars.awsSesSecretAccessKey,
						endpoint: envVars.awsSesEndpoint
					}
				}
			});
		}

		if (
			envVars.messagingPushNotificationConnector ===
			MessagingPushNotificationConnectorType.EntityStorage
		) {
			coreConfig.types.messagingPushNotificationConnector.push({
				type: MessagingPushNotificationConnectorType.EntityStorage
			});
		} else if (
			envVars.messagingPushNotificationConnector === MessagingPushNotificationConnectorType.Aws
		) {
			let messagingApps;
			if (Is.stringValue(envVars.awsMessagingPushNotificationApplications)) {
				try {
					messagingApps = JSON.parse(envVars.awsMessagingPushNotificationApplications);
				} catch {}
			} else if (Is.array(envVars.awsMessagingPushNotificationApplications)) {
				messagingApps = envVars.awsMessagingPushNotificationApplications;
			}
			coreConfig.types.messagingPushNotificationConnector.push({
				type: MessagingPushNotificationConnectorType.Aws,
				options: {
					config: {
						region: envVars.awsSesRegion ?? "",
						authMode: envVars.awsSesAuthMode as "credentials" | "pod",
						accessKeyId: envVars.awsSesAccessKeyId,
						secretAccessKey: envVars.awsSesSecretAccessKey,
						endpoint: envVars.awsSesEndpoint,
						applicationsSettings: messagingApps ?? []
					}
				}
			});
		}

		coreConfig.types.messagingAdminComponent ??= [];
		coreConfig.types.messagingAdminComponent.push({
			type: MessagingAdminComponentType.Service
		});

		coreConfig.types.messagingComponent ??= [];
		coreConfig.types.messagingComponent.push({ type: MessagingComponentType.Service });
	}
}

/**
 * Configures the faucet.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the faucet configuration has been applied.
 */
async function configureFaucet(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.faucetConnector ??= [];

	if (envVars.faucetConnector === FaucetConnectorType.EntityStorage) {
		coreConfig.types.faucetConnector.push({
			type: FaucetConnectorType.EntityStorage
		});
	} else if (
		envVars.faucetConnector === FaucetConnectorType.Iota &&
		Is.stringValue(envVars.iotaFaucetEndpoint)
	) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);
		coreConfig.types.faucetConnector.push({
			type: FaucetConnectorType.Iota,
			options: {
				config: {
					endpoint: envVars.iotaFaucetEndpoint,
					clientOptions: dltConfig?.options?.config?.clientOptions ?? { url: "" },
					network: dltConfig?.options?.config?.network ?? ""
				}
			}
		});
	}
}

/**
 * Configures the wallet.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the wallet configuration has been applied.
 */
async function configureWallet(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.walletConnector ??= [];

	if (envVars.walletConnector === WalletConnectorType.EntityStorage) {
		coreConfig.types.walletConnector.push({
			type: WalletConnectorType.EntityStorage
		});
	} else if (envVars.walletConnector === WalletConnectorType.Iota) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);
		coreConfig.types.walletConnector.push({
			type: WalletConnectorType.Iota,
			options: {
				config: dltConfig?.options?.config ?? ({} as IIotaConfig)
			}
		});
	}
}

/**
 * Configures the NFT.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the NFT configuration has been applied.
 */
async function configureNft(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.nftConnector ??= [];

	if (envVars.nftConnector === NftConnectorType.EntityStorage) {
		coreConfig.types.nftConnector.push({
			type: NftConnectorType.EntityStorage
		});
	} else if (envVars.nftConnector === NftConnectorType.Iota) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);
		const config = {
			...(dltConfig?.options?.config as IIotaConfig),
			deploymentPkgId: Is.stringValue(envVars.nftPackageId) ? envVars.nftPackageId : undefined
		};
		coreConfig.types.nftConnector.push({
			type: NftConnectorType.Iota,
			options: {
				config
			}
		});
	}

	if (coreConfig.types.nftConnector.length > 0) {
		coreConfig.types.nftComponent ??= [];
		coreConfig.types.nftComponent.push({ type: NftComponentType.Service });
	}
}

/**
 * Configures the notarization.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the notarization configuration has been applied.
 */
async function configureNotarization(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.notarizationConnector ??= [];

	if (envVars.notarizationConnector === NotarizationConnectorType.EntityStorage) {
		coreConfig.types.notarizationConnector.push({
			type: NotarizationConnectorType.EntityStorage
		});
	} else if (envVars.notarizationConnector === NotarizationConnectorType.Iota) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);
		coreConfig.types.notarizationConnector.push({
			type: NotarizationConnectorType.Iota,
			options: {
				config: dltConfig?.options?.config ?? ({} as IIotaConfig)
			}
		});
	}

	if (coreConfig.types.notarizationConnector.length > 0) {
		coreConfig.types.notarizationComponent ??= [];
		coreConfig.types.notarizationComponent.push({ type: NotarizationComponentType.Service });
	}
}

/**
 * Configures the immutable proof.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the immutable proof configuration has been applied.
 */
async function configureImmutableProof(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isImmutableProofRequired(envVars)) {
		coreConfig.types.immutableProofComponent ??= [];
		coreConfig.types.immutableProofComponent.push({
			type: ImmutableProofComponentType.Service,
			options: {
				config: {
					verificationMethodId: envVars.immutableProofVerificationMethodId,
					taskRetryCount: envCount(envVars, "immutableProofTaskRetryCount"),
					taskRetryInterval: envSecToMs(envVars, "immutableProofTaskRetryInterval"),
					taskFailureRetainFor: envMinToMs(envVars, "immutableProofTaskFailureRetainFor"),
					sweepIntervalMinutes: envMinutes(envVars, "immutableProofSweepInterval"),
					sweepStaleThresholdMs: envMinToMs(envVars, "immutableProofSweepStaleThreshold"),
					sweepMaxAttempts: envCount(envVars, "immutableProofSweepMaxAttempts"),
					sweepBatchLimit: envCount(envVars, "immutableProofSweepBatchLimit"),
					sweepBackoffMs: envMinToMs(envVars, "immutableProofSweepBackoff"),
					sweepAssumeRetryableBefore: envDateTime(
						envVars,
						"immutableProofSweepAssumeRetryableBefore"
					)
				}
			}
		});
	}
}

/**
 * Configures the identity.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the identity configuration has been applied.
 */
async function configureIdentity(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.identityConnector ??= [];

	if (envVars.identityConnector === IdentityConnectorType.EntityStorage) {
		coreConfig.types.identityConnector.push({
			type: IdentityConnectorType.EntityStorage
		});
	} else if (envVars.identityConnector === IdentityConnectorType.Iota) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);
		coreConfig.types.identityConnector.push({
			type: IdentityConnectorType.Iota,
			options: {
				config: {
					...(dltConfig?.options?.config ?? ({} as IIotaConfig)),
					identityPkgId: Is.stringValue(envVars.iotaIdentityPackageId)
						? envVars.iotaIdentityPackageId
						: undefined,
					walletAddressIndex: envCount(envVars, "identityWalletAddressIndex") ?? 0,
					didResolutionCacheTtlMs: envMs(envVars, "identityDidResolutionCacheTtl"),
					didResolutionCacheCapacity: envCount(envVars, "identityDidResolutionCacheCapacity"),
					didResolutionCacheMutexTimeoutMs: envMs(
						envVars,
						"identityDidResolutionCacheMutexTimeout"
					),
					didResolutionRetries: envCount(envVars, "identityDidResolutionRetries"),
					didResolutionRetryDelayMs: envMs(envVars, "identityDidResolutionRetryDelay")
				}
			}
		});
	}

	if (coreConfig.types.identityConnector.length > 0) {
		coreConfig.types.identityComponent ??= [];
		coreConfig.types.identityComponent.push({ type: IdentityComponentType.Service });
	}
}

/**
 * Configures the identity resolver.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the identity resolver configuration has been applied.
 */
async function configureIdentityResolver(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.identityResolverConnector ??= [];

	if (envVars.identityResolverConnector === IdentityResolverConnectorType.EntityStorage) {
		coreConfig.types.identityResolverConnector.push({
			type: IdentityResolverConnectorType.EntityStorage
		});
	} else if (envVars.identityResolverConnector === IdentityResolverConnectorType.Iota) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);
		coreConfig.types.identityResolverConnector.push({
			type: IdentityResolverConnectorType.Iota,
			options: {
				config: {
					...(dltConfig?.options?.config as IIotaConfig),
					identityPkgId: Is.stringValue(envVars.iotaIdentityPackageId)
						? envVars.iotaIdentityPackageId
						: undefined
				}
			}
		});
	} else if (envVars.identityResolverConnector === IdentityResolverConnectorType.Universal) {
		coreConfig.types.identityResolverConnector.push({
			type: IdentityResolverConnectorType.Universal,
			options: {
				config: {
					endpoint: envVars.universalResolverEndpoint ?? ""
				}
			}
		});
	}

	if (coreConfig.types.identityResolverConnector.length > 0) {
		coreConfig.types.identityResolverComponent ??= [];
		coreConfig.types.identityResolverComponent.push({
			type: IdentityResolverComponentType.Service
		});
	}
}

/**
 * Configures the identity profile.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the identity profile configuration has been applied.
 */
async function configureIdentityProfile(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.identityProfileConnector ??= [];

	if (envVars.identityProfileConnector === IdentityConnectorType.EntityStorage) {
		coreConfig.types.identityProfileConnector.push({
			type: IdentityProfileConnectorType.EntityStorage
		});
	}

	if (coreConfig.types.identityProfileConnector.length > 0) {
		coreConfig.types.identityProfileComponent ??= [];
		coreConfig.types.identityProfileComponent.push({ type: IdentityProfileComponentType.Service });
	}
}

/**
 * Configures the attestation.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the attestation configuration has been applied.
 */
async function configureAttestation(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.attestationConnector ??= [];

	if (envVars.attestationConnector === AttestationConnectorType.Nft) {
		coreConfig.types.attestationConnector.push({
			type: AttestationConnectorType.Nft
		});
	}

	if (coreConfig.types.attestationConnector.length > 0) {
		coreConfig.types.attestationComponent ??= [];
		coreConfig.types.attestationComponent.push({
			type: AttestationComponentType.Service,
			options: {
				config: {
					verificationMethodId: envVars.attestationVerificationMethodId
				}
			}
		});
	}
}

/**
 * Configures the auditable item graph.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the auditable item graph configuration has been applied.
 */
async function configureAuditableItemGraph(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (envBoolean(envVars, "auditableItemGraphEnabled", false)) {
		coreConfig.types.auditableItemGraphComponent ??= [];
		coreConfig.types.auditableItemGraphComponent.push({
			type: AuditableItemGraphComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "auditableItemGraphMutexTimeout")
				}
			}
		});
	}
}

/**
 * Configures the auditable item stream.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the auditable item stream configuration has been applied.
 */
async function configureAuditableItemStream(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (envBoolean(envVars, "auditableItemStreamEnabled", false)) {
		coreConfig.types.auditableItemStreamComponent ??= [];
		coreConfig.types.auditableItemStreamComponent.push({
			type: AuditableItemStreamComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "auditableItemStreamMutexTimeout")
				}
			}
		});
	}
}

/**
 * Configures the data processing.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the data processing configuration has been applied.
 */
async function configureDataProcessing(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (envBoolean(envVars, "dataProcessingEnabled", false)) {
		coreConfig.types.dataProcessingComponent ??= [];
		coreConfig.types.dataProcessingComponent.push({ type: DataProcessingComponentType.Service });

		coreConfig.types.dataConverterConnector ??= [];

		const converterConnectors = commaSeparatedListToArray(envVars.dataConverterConnectors);
		for (const converterConnector of converterConnectors) {
			coreConfig.types.dataConverterConnector.push({
				type: converterConnector as DataConverterConnectorType
			});
		}

		coreConfig.types.dataExtractorConnector ??= [];
		const extractorConnectors = commaSeparatedListToArray(envVars.dataExtractorConnectors);
		for (const extractorConnector of extractorConnectors) {
			coreConfig.types.dataExtractorConnector.push({
				type: extractorConnector as DataExtractorConnectorType
			});
		}
	}
}

/**
 * Configures the document management.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the document management configuration has been applied.
 */
async function configureDocumentManagement(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (envBoolean(envVars, "documentManagementEnabled", false)) {
		coreConfig.types.documentManagementComponent ??= [];
		coreConfig.types.documentManagementComponent.push({
			type: DocumentManagementComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "documentManagementMutexTimeout")
				}
			}
		});
	}
}

/**
 * Configures the trust components.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the trust configuration has been applied.
 */
async function configureTrust(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isTrustRequired(envVars)) {
		coreConfig.types.trustComponent ??= [];
		coreConfig.types.trustComponent.push({
			type: TrustComponentType.Service
		});

		coreConfig.types.trustGeneratorComponent ??= [];
		const trustGeneratorTypes = commaSeparatedListToArray(envVars.trustGenerators);
		for (const trustGeneratorType of trustGeneratorTypes) {
			coreConfig.types.trustGeneratorComponent.push({
				type: trustGeneratorType as TrustGeneratorComponentType,
				options: {
					config: {
						verificationMethodId: envVars.trustVerificationMethodId ?? "",
						tokenTtlInSeconds: envCount(envVars, "trustJwtTtl")
					}
				}
			});
		}

		coreConfig.types.trustVerifierComponent ??= [];
		const trustVerifierTypes = commaSeparatedListToArray(envVars.trustVerifiers);
		for (const trustVerifierType of trustVerifierTypes) {
			const type = trustVerifierType as TrustVerifierComponentType;

			if (type === TrustVerifierComponentType.IdentityAllowDeny) {
				coreConfig.types.trustVerifierComponent.push({
					type,
					options: {
						config: {
							allowIdentities: commaSeparatedListToArray<string>(envVars.trustIdentitiesAllow),
							denyIdentities: commaSeparatedListToArray<string>(envVars.trustIdentitiesDeny)
						}
					}
				});
			} else {
				coreConfig.types.trustVerifierComponent.push({
					type
				});
			}
		}
	}
}

/**
 * Configures the rights management.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the rights management configuration has been applied.
 */
async function configureRightsManagement(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isRightsManagementRequired(envVars)) {
		coreConfig.types.rightsManagementPapComponent ??= [];
		coreConfig.types.rightsManagementPapComponent.push({
			type: RightsManagementPapComponentType.Service
		});

		coreConfig.types.rightsManagementPmpComponent ??= [];
		coreConfig.types.rightsManagementPmpComponent.push({
			type: RightsManagementPmpComponentType.Service
		});

		coreConfig.types.rightsManagementPipComponent ??= [];
		coreConfig.types.rightsManagementPipComponent.push({
			type: RightsManagementPipComponentType.Service
		});

		coreConfig.types.rightsManagementPxpComponent ??= [];
		coreConfig.types.rightsManagementPxpComponent.push({
			type: RightsManagementPxpComponentType.Service
		});

		coreConfig.types.rightsManagementPdpComponent ??= [];
		coreConfig.types.rightsManagementPdpComponent.push({
			type: RightsManagementPdpComponentType.Service
		});

		coreConfig.types.rightsManagementPepComponent ??= [];
		coreConfig.types.rightsManagementPepComponent.push({
			type: RightsManagementPepComponentType.Service
		});

		coreConfig.types.rightsManagementPnpComponent ??= [];

		// Single source of truth for the rights-management mount path.
		const rightsManagementPath = envVars.rightsManagementCallbackPath ?? "rights-management";

		// We add a multi instance REST client for the remote negotiations
		// use a dummy endpoint for now as the actual endpoint will be provided in the config
		// of the policy negotiator when it is used for remote negotiations
		// We must add it before the service as the service needs to be able to request
		// the REST client type from the engine core to be able to support remote negotiations
		coreConfig.types.rightsManagementPnpComponent.push({
			type: RightsManagementPnpComponentType.RestClient,
			options: {
				// The endpoint is required in config, but as this is multi-instance
				// the actual endpoint will be provided in the config when it is constructed
				endpoint: "http://localhost",
				pathPrefix: rightsManagementPath
			},
			isMultiInstance: true,
			features: ["remote"]
		});
		coreConfig.types.rightsManagementPnpComponent.push({
			type: RightsManagementPnpComponentType.Service,
			options: {
				config: {
					callbackPath: rightsManagementPath,
					includeErrorDetails: coreConfig.debug ?? false,
					mutexTimeoutMs: envMs(envVars, "rightsManagementMutexTimeout")
				}
			},
			isDefault: true
		});

		coreConfig.types.rightsManagementPnapComponent ??= [];
		coreConfig.types.rightsManagementPnapComponent.push({
			type: RightsManagementPnapComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMs(envVars, "rightsManagementMutexTimeout")
				}
			}
		});

		coreConfig.types.rightsManagementPolicyArbiterComponent ??= [];
		const policyArbiterTypes = commaSeparatedListToArray(envVars.rightsManagementPolicyArbiters);
		for (const policyArbiterType of policyArbiterTypes) {
			coreConfig.types.rightsManagementPolicyArbiterComponent.push({
				type: policyArbiterType as RightsManagementPolicyArbiterComponentType
			});
		}

		coreConfig.types.rightsManagementPolicyObligationEnforcerComponent ??= [];
		const policyObligationEnforcerTypes = commaSeparatedListToArray(
			envVars.rightsManagementPolicyObligationEnforcers
		);
		for (const policyObligationEnforcerType of policyObligationEnforcerTypes) {
			coreConfig.types.rightsManagementPolicyObligationEnforcerComponent.push({
				type: policyObligationEnforcerType as RightsManagementPolicyObligationEnforcerComponentType
			});
		}

		coreConfig.types.rightsManagementPolicyEnforcementProcessorComponent ??= [];
		const policyEnforcementProcessTypes = commaSeparatedListToArray(
			envVars.rightsManagementPolicyEnforcementProcessors
		);
		for (const policyEnforcementProcessorType of policyEnforcementProcessTypes) {
			coreConfig.types.rightsManagementPolicyEnforcementProcessorComponent.push({
				type: policyEnforcementProcessorType as RightsManagementPolicyEnforcementProcessorComponentType
			});
		}

		coreConfig.types.rightsManagementPolicyExecutionActionComponent ??= [];
		const policyExecutionActionTypes = commaSeparatedListToArray(
			envVars.rightsManagementPolicyExecutionActions
		);
		for (const policyExecutionActionType of policyExecutionActionTypes) {
			coreConfig.types.rightsManagementPolicyExecutionActionComponent.push({
				type: policyExecutionActionType as RightsManagementPolicyExecutionActionComponentType
			});
		}

		coreConfig.types.rightsManagementPolicyInformationSourceComponent ??= [];
		const policyInformationSourceTypes = commaSeparatedListToArray(
			envVars.rightsManagementPolicyInformationSources
		);
		for (const policyInformationSourceType of policyInformationSourceTypes) {
			coreConfig.types.rightsManagementPolicyInformationSourceComponent.push({
				type: policyInformationSourceType as RightsManagementPolicyInformationSourceComponentType
			});
		}

		coreConfig.types.rightsManagementPolicyRequesterComponent ??= [];
		const policyRequesterTypes = commaSeparatedListToArray(
			envVars.rightsManagementPolicyRequesters
		);
		for (const policyRequesterType of policyRequesterTypes) {
			coreConfig.types.rightsManagementPolicyRequesterComponent.push({
				type: policyRequesterType as RightsManagementPolicyRequesterComponentType
			});
		}

		coreConfig.types.rightsManagementPolicyNegotiatorComponent ??= [];
		const policyNegotiatorTypes = commaSeparatedListToArray(
			envVars.rightsManagementPolicyNegotiators
		);
		for (const policyNegotiatorType of policyNegotiatorTypes) {
			coreConfig.types.rightsManagementPolicyNegotiatorComponent.push({
				type: policyNegotiatorType as RightsManagementPolicyNegotiatorComponentType
			});
		}
	}
}

/**
 * Configures the task scheduler.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the task scheduler configuration has been applied.
 */
async function configureTaskScheduler(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isTaskSchedulerRequired(envVars)) {
		coreConfig.types.taskSchedulerComponent ??= [];
		coreConfig.types.taskSchedulerComponent.push({
			type: TaskSchedulerComponentType.Service
		});
	}
}

/**
 * Configures the federated catalogue.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the federated catalogue configuration has been applied.
 */
async function configureFederatedCatalogue(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isFederatedCatalogueRequired(envVars)) {
		coreConfig.types.federatedCatalogueComponent ??= [];

		if (Is.stringValue(envVars.federatedCatalogueRemoteEndpoint)) {
			coreConfig.types.federatedCatalogueComponent.push({
				type: FederatedCatalogueComponentType.RestClient,
				options: {
					endpoint: envVars.federatedCatalogueRemoteEndpoint,
					pathPrefix: envVars.federatedCatalogueRestClientPathPrefix ?? "catalog"
				}
			});
		} else {
			coreConfig.types.federatedCatalogueComponent.push({
				type: FederatedCatalogueComponentType.Service,
				options: {
					config: {
						mutexTimeoutMs: envMs(envVars, "federatedCatalogueMutexTimeout")
					}
				}
			});

			coreConfig.types.federatedCatalogueFilterComponent ??= [];
			const filters = commaSeparatedListToArray(envVars.federatedCatalogueFilters);

			for (const filter of filters) {
				coreConfig.types.federatedCatalogueFilterComponent.push({
					type: filter as FederatedCatalogueFilterComponentType,
					options: {}
				});
			}
		}
	}
}

/**
 * Configures the dataspace control plane and data plane.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the dataspace configuration has been applied.
 */
async function configureDataspace(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (envBoolean(envVars, "dataspaceEnabled", false)) {
		coreConfig.types.dataspaceControlPlaneComponent ??= [];
		// We add a multi instance REST client for remote/consumer-initiated transfers.
		coreConfig.types.dataspaceControlPlaneComponent.push({
			type: DataspaceControlPlaneComponentType.RestClient,
			options: {
				endpoint: "http://localhost"
			},
			isMultiInstance: true,
			features: ["remote"]
		});
		coreConfig.types.dataspaceControlPlaneComponent.push({
			type: DataspaceControlPlaneComponentType.Service,
			options: {
				config: {
					// Must match the control-plane REST mount, as it is combined with the public origin
					// to build the consumer's advertised callback address;
					callbackPath: envVars.dataspaceCallbackPath ?? "dataspace-control-plane",
					// Base mount path of the data plane only; the transfer handlers append the
					// sub-paths themselves (`/entities` for PULL, `/inbox` for PUSH).
					dataPlanePath: envVars.dataspaceDataPlanePath,
					autoStartTransfers: envBoolean(envVars, "dataspaceAutoStartTransfers", false),
					stalledNegotiationTimeoutMs: envSecToMs(envVars, "dataspaceStalledNegotiationTimeout"),
					stalledTransferTimeoutMs: envSecToMs(envVars, "dataspaceStalledTransferTimeout"),
					providerTransferIdleTimeoutMs: envSecToMs(
						envVars,
						"dataspaceProviderTransferIdleTimeout"
					),
					providerTransferPolicySweepIntervalMs: envSecToMs(
						envVars,
						"dataspaceProviderTransferPolicySweepInterval"
					),
					agreementUnusedThresholdMs: envMs(envVars, "dataspaceAgreementUnusedThreshold"),
					agreementSweepIntervalMs: envMs(envVars, "dataspaceAgreementSweepInterval")
				}
			},
			isDefault: true
		});

		coreConfig.types.dataspaceDataPlaneComponent ??= [];
		coreConfig.types.dataspaceDataPlaneComponent.push({
			type: DataspaceDataPlaneComponentType.Service,
			options: {
				config: {
					retainActivityLogsForMs: envSecToMs(envVars, "dataspaceRetainActivityLogsFor"),
					activityLogsCleanUpIntervalMs: envSecToMs(
						envVars,
						"dataspaceActivityLogsCleanupInterval"
					),
					retryCount: envCount(envVars, "dataspaceRetryCount"),
					pushRetryCount: envCount(envVars, "dataspacePushRetryCount"),
					pushRetryBaseDelayMs: envMs(envVars, "dataspacePushRetryBaseDelay"),
					pushTimeoutMs: envMs(envVars, "dataspacePushTimeout"),
					pushSubscriptionCleanupIntervalMs: envMs(
						envVars,
						"dataspacePushSubscriptionCleanupInterval"
					),
					agreementCacheTtlMs: envMs(envVars, "dataspaceAgreementCacheTtl"),
					agreementCacheMutexTimeoutMs: envMs(envVars, "dataspaceAgreementCacheMutexTimeout")
				}
			}
		});
	}
}

/**
 * Configures the DLT.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the DLT configuration has been applied.
 */
async function configureDlt(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	// Create centralized DLT configuration for IOTA if essential IOTA variables are set
	if (Is.stringValue(envVars.iotaNodeEndpoint) && Is.stringValue(envVars.iotaNetwork)) {
		coreConfig.types.dltConfig ??= [];

		const gasStationConfig =
			Is.stringValue(envVars.iotaGasStationEndpoint) &&
			Is.stringValue(envVars.iotaGasStationAuthToken)
				? {
						gasStationUrl: envVars.iotaGasStationEndpoint,
						gasStationAuthToken: envVars.iotaGasStationAuthToken
					}
				: undefined;

		coreConfig.types.dltConfig.push({
			type: DltConfigType.Iota,
			isDefault: true,
			options: {
				config: {
					clientOptions: {
						url: envVars.iotaNodeEndpoint ?? ""
					},
					network: envVars.iotaNetwork ?? "",
					coinType: envCount(envVars, "iotaCoinType"),
					gasStation: gasStationConfig,
					gasBudget: envCount(envVars, "iotaGasBudget"),
					gasReservationDuration: envSeconds(envVars, "iotaGasReservationDuration")
				}
			}
		});
	}
}

/**
 * Checks if the trust subsystem is required.
 * Returns true when any component that depends on the trust subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if rights-management, or dataspace is enabled.
 */
export function isTrustRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		isRightsManagementRequired(envVars) ||
		envBoolean(envVars, "dataspaceEnabled", false) ||
		isFederatedCatalogueRequired(envVars)
	);
}

/**
 * Checks if the background tasks subsystem is required.
 * Returns true when any component that depends on the background tasks subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if dataspace or verifiable storage is enabled.
 */
export function isBackgroundTasksRequired(envVars: IEngineEnvironmentVariables): boolean {
	return envBoolean(envVars, "dataspaceEnabled", false) || isImmutableProofRequired(envVars);
}

/**
 * Checks if the immutable proof subsystem is required.
 * Returns true when any component that depends on the immutable proof subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if verifiable storage is enabled.
 */
export function isImmutableProofRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		envBoolean(envVars, "auditableItemGraphEnabled", false) ||
		envBoolean(envVars, "auditableItemStreamEnabled", false) ||
		envBoolean(envVars, "documentManagementEnabled", false)
	);
}

/**
 * Checks if the federated catalogue subsystem is required.
 * Returns true when the catalogue is explicitly enabled, a remote endpoint is configured, filters are set, or dataspace is enabled.
 * @param envVars The environment variables.
 * @returns True if the federated catalogue is required.
 */
export function isFederatedCatalogueRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		envBoolean(envVars, "federatedCatalogueEnabled", false) ||
		Is.stringValue(envVars.federatedCatalogueRemoteEndpoint) ||
		Is.stringValue(envVars.federatedCatalogueFilters) ||
		envBoolean(envVars, "dataspaceEnabled", false)
	);
}

/**
 * Checks if the rights management subsystem is required.
 * Returns true when any component that depends on the rights management subsystem is enabled.
 * Note: rights management has no standalone enable flag - it is gated entirely on
 * `dataspaceEnabled`. Setting `TWIN_RIGHTS_MANAGEMENT_*` env var in isolation does not
 * enable the subsystem; `TWIN_DATASPACE_ENABLED` must also be true.
 * @param envVars The environment variables.
 * @returns True if rights management is enabled.
 */
export function isRightsManagementRequired(envVars: IEngineEnvironmentVariables): boolean {
	return envBoolean(envVars, "dataspaceEnabled", false);
}

/**
 * Checks if the task scheduler subsystem is required.
 * Returns true when any component that depends on the task scheduler subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if task scheduler is enabled.
 */
export function isTaskSchedulerRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		envBoolean(envVars, "taskSchedulerEnabled", false) ||
		envBoolean(envVars, "dataspaceEnabled", false) ||
		isRightsManagementRequired(envVars) ||
		isAuthEntityStorageRequired(envVars) ||
		isImmutableProofRequired(envVars)
	);
}

/**
 * Checks if the automation subsystem is required.
 * Returns true when any component that depends on the automation subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if automation is enabled.
 */
export function isAutomationRequired(envVars: IEngineEnvironmentVariables): boolean {
	return isRightsManagementRequired(envVars);
}

/**
 * Checks if the telemetry subsystem is required.
 * Returns true when any component that depends on the telemetry subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if telemetry is enabled.
 */
export function isTelemetryRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		envVars.telemetryConnector === TelemetryConnectorType.EntityStorage ||
		envVars.telemetryConnector === TelemetryConnectorType.OpenTelemetry
	);
}

/**
 * Checks if the tracing subsystem is required.
 * Returns true when any component that depends on the tracing subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if tracing is enabled.
 */
export function isTracingRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		envVars.tracingConnector === TracingConnectorType.EntityStorage ||
		envVars.tracingConnector === TracingConnectorType.OpenTelemetry
	);
}
