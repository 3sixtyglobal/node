// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { cpus } from "node:os";
import path from "node:path";
import { EnvHelper, Is, Mutex } from "@3sixty/core";
import type { IIotaConfig } from "@3sixty/dlt-iota";
import {
	EngineCloneMode,
	EngineLogLevel,
	type IEngineCoreTypeConfig,
	type IEngineFacadeConfig
} from "@3sixty/engine-models";
import {
	AttestationComponentType,
	AttestationConnectorType,
	AuditableItemGraphComponentType,
	AuditableItemStreamComponentType,
	type AutomationActionConfig,
	AutomationActionType,
	AutomationComponentType,
	BackgroundTaskComponentType,
	BlobStorageComponentType,
	BlobStorageConnectorType,
	ContextIdHandlerComponentType,
	DataConverterConnectorType,
	DataExtractorConnectorType,
	DataProcessingComponentType,
	DataspaceControlPlaneComponentType,
	DataspaceDataPlaneComponentType,
	type DltConfig,
	DltConfigType,
	DocumentManagementComponentType,
	EmailProtocolConnectorType,
	EngineTypeHelper,
	EntityStorageConnectorType,
	EventBusComponentType,
	EventBusConnectorType,
	type FacadeConfig,
	FacadeType,
	FaucetConnectorType,
	FederatedCatalogueComponentType,
	FederatedCatalogueFilterComponentType,
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
	MailboxComponentType,
	MailStorageComponentType,
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
	RightsManagementPolicyArbiterComponentType,
	RightsManagementPolicyEnforcementProcessorComponentType,
	RightsManagementPolicyExecutionActionComponentType,
	RightsManagementPolicyInformationSourceComponentType,
	RightsManagementPolicyNegotiatorComponentType,
	RightsManagementPolicyObligationEnforcerComponentType,
	RightsManagementPolicyRequesterComponentType,
	RightsManagementPxpComponentType,
	SchemaVersionMigrationComponentType,
	TaskSchedulerComponentType,
	TelemetryComponentType,
	TelemetryConnectorType,
	TenantAdminComponentType,
	TracingComponentType,
	TracingConnectorType,
	TrustComponentType,
	TrustGeneratorComponentType,
	TrustVerifierComponentType,
	VaultConnectorType,
	WalletConnectorType
} from "@3sixty/engine-types";
import {
	type IOpenTelemetryLoggingConnectorConfig,
	type IOpenTelemetryOtlpExporterConfig,
	OpenTelemetryExporterTypes
} from "@3sixty/logging-connector-opentelemetry";
import { LogLevel } from "@3sixty/logging-models";
import {
	type IOpenTelemetryTelemetryConnectorConfig,
	OpenTelemetryReaderTypes
} from "@3sixty/telemetry-connector-opentelemetry";
import {
	type IOpenTelemetryTracingConnectorConfig,
	OpenTelemetryProcessorTypes
} from "@3sixty/tracing-connector-opentelemetry";
import { type ITracingFacadeConfig, TracingFacade } from "@3sixty/tracing-facades";
import {
	CONTEXT_ID_HANDLER_FEATURE_DID,
	CONTEXT_ID_HANDLER_FEATURE_TENANT,
	COMPONENT_FACTORY_TYPE_NAME,
	DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS,
	DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES,
	DEFAULT_TRACING_FACADE_FACTORIES,
	TRACING_FACADE_NAME
} from "../defaults.js";
import { isAuthEntityStorageRequired } from "./engineServerEnvBuilder.js";
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

	const silent = EnvHelper.envBoolean(envVars, "silent", false);
	const loggingLevels = getLoggingLevels(envVars);

	let logLevel: EngineLogLevel | undefined;
	if (silent) {
		// Silent still reports errors, so a failure during bootstrap or start is not hidden.
		logLevel = EngineLogLevel.Error;
	} else if (Is.arrayValue(loggingLevels)) {
		// The engine logger only supports thresholds, so use the nearest one which hides nothing listed.
		if (loggingLevels.some(level => level !== LogLevel.Error && level !== LogLevel.Warn)) {
			logLevel = EngineLogLevel.All;
		} else if (loggingLevels.includes(LogLevel.Warn)) {
			logLevel = EngineLogLevel.Warn;
		} else {
			logLevel = EngineLogLevel.Error;
		}
	}

	const coreConfig: IEngineConfig = {
		debug: EnvHelper.envBoolean(envVars, "debug", false),
		silent,
		logLevel,
		disableColor: EnvHelper.envBoolean(envVars, "disableColor", false),
		silentComponents: {
			logging: EnvHelper.commaSeparatedListToArray(envVars.loggingSilentComponents),
			telemetry: EnvHelper.commaSeparatedListToArray(envVars.telemetrySilentComponents),
			tracing: EnvHelper.commaSeparatedListToArray(envVars.tracingSilentComponents)
		},
		types: {}
	};

	const mutexTimeoutMs = EnvHelper.envMs(envVars, "mutexTimeoutDefault");
	if (Is.notEmpty(mutexTimeoutMs)) {
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
	await configureFacades(coreConfig, envVars);
	await configureMessaging(coreConfig, envVars);
	await configureMailbox(coreConfig, envVars);
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
 * Resolves a component mutex timeout, falling back to the default so engine clones inherit it.
 * @param envVars The environment variables.
 * @param key The component mutex timeout env var.
 * @returns The mutex timeout in milliseconds, or undefined when neither is set.
 */
function envMutexMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	return EnvHelper.envMs(envVars, key) ?? EnvHelper.envMs(envVars, "mutexTimeoutDefault");
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

	const entityStorageConnectorTypes = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		EntityStorageConnectorType
	>(envVars, "entityStorageConnectorType", Object.values(EntityStorageConnectorType));

	for (const entityStorageConnectorType of entityStorageConnectorTypes) {
		if (entityStorageConnectorType === EntityStorageConnectorType.Memory) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.Memory,
				options: {
					config: {
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout")
					}
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.File) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.File,
				options: {
					config: {
						directory: envVars.storageFileRoot ?? "",
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout")
					},
					folderPrefix: envVars.entityStorageTablePrefix
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.AwsDynamoDb) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.AwsDynamoDb,
				options: {
					config: {
						region: envVars.awsDynamodbRegion ?? "",
						authMode: envVars.awsDynamodbAuthMode as "credentials" | "pod",
						accessKeyId: envVars.awsDynamodbAccessKeyId,
						secretAccessKey: envVars.awsDynamodbSecretAccessKey,
						endpoint: envVars.awsDynamodbEndpoint,
						connectionTimeoutMs: EnvHelper.envMs(envVars, "awsDynamodbConnectionTimeout"),
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout")
					},
					tablePrefix: envVars.entityStorageTablePrefix
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.AzureCosmosDb) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.AzureCosmosDb,
				options: {
					config: {
						endpoint: envVars.azureCosmosdbEndpoint ?? "",
						key: envVars.azureCosmosdbKey ?? "",
						databaseId: envVars.azureCosmosdbDatabaseId ?? "",
						containerId: envVars.azureCosmosdbContainerId ?? "",
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout")
					},
					tablePrefix: envVars.entityStorageTablePrefix
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.GcpFirestoreDb) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.GcpFirestoreDb,
				options: {
					config: {
						projectId: envVars.gcpFirestoreProjectId ?? "",
						credentials: envVars.gcpFirestoreCredentials ?? "",
						databaseId: envVars.gcpFirestoreDatabaseId ?? "",
						collectionName: envVars.gcpFirestoreCollectionName ?? "",
						endpoint: envVars.gcpFirestoreEndpoint ?? "",
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout")
					},
					tablePrefix: envVars.entityStorageTablePrefix
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.ScyllaDb) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.ScyllaDb,
				options: {
					config: {
						hosts: EnvHelper.commaSeparatedListToArray(envVars.scylladbHosts),
						localDataCenter: envVars.scylladbLocalDataCenter ?? "",
						keyspace: envVars.scylladbKeyspace ?? "",
						port: EnvHelper.envInteger(envVars, "scylladbPort"),
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout"),
						pool: {
							coreConnectionsPerHost: EnvHelper.envCount(
								envVars,
								"scylladbPoolCoreConnectionsPerHost"
							),
							maxRequestsPerConnection: EnvHelper.envCount(
								envVars,
								"scylladbPoolMaxRequestsPerConnection"
							)
						}
					},
					tablePrefix: envVars.entityStorageTablePrefix
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.MySqlDb) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.MySqlDb,
				options: {
					config: {
						host: envVars.mySqlHost ?? "",
						port: EnvHelper.envInteger(envVars, "mySqlPort"),
						user: envVars.mySqlUser ?? "",
						password: envVars.mySqlPassword ?? "",
						database: envVars.mySqlDatabase ?? "",
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout"),
						pool: {
							connectionLimit: EnvHelper.envCount(envVars, "mySqlPoolConnectionLimit"),
							maxIdle: EnvHelper.envCount(envVars, "mySqlPoolMaxIdle"),
							idleTimeout: EnvHelper.envMs(envVars, "mySqlPoolIdleTimeout"),
							enableKeepAlive: EnvHelper.envBoolean(envVars, "mySqlPoolEnableKeepAlive"),
							waitForConnections: EnvHelper.envBoolean(envVars, "mySqlPoolWaitForConnections"),
							queueLimit: EnvHelper.envCount(envVars, "mySqlPoolQueueLimit")
						}
					},
					tablePrefix: envVars.entityStorageTablePrefix
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.MongoDb) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.MongoDb,
				options: {
					config: {
						host: envVars.mongoDbHost ?? "",
						port: EnvHelper.envInteger(envVars, "mongoDbPort"),
						user: envVars.mongoDbUser ?? "",
						password: envVars.mongoDbPassword ?? "",
						database: envVars.mongoDbDatabase ?? "",
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout"),
						pool: {
							maxPoolSize: EnvHelper.envCount(envVars, "mongoDbPoolMaxPoolSize"),
							minPoolSize: EnvHelper.envCount(envVars, "mongoDbPoolMinPoolSize"),
							maxIdleTimeMs: EnvHelper.envMs(envVars, "mongoDbPoolMaxIdleTime"),
							waitQueueTimeoutMs: EnvHelper.envMs(envVars, "mongoDbPoolWaitQueueTimeout")
						}
					},
					tablePrefix: envVars.entityStorageTablePrefix
				}
			});
		} else if (entityStorageConnectorType === EntityStorageConnectorType.PostgreSql) {
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.PostgreSql,
				options: {
					config: {
						host: envVars.postgreSqlHost ?? "",
						port: EnvHelper.envInteger(envVars, "postgreSqlPort"),
						user: envVars.postgreSqlUser ?? "",
						password: envVars.postgreSqlPassword ?? "",
						database: envVars.postgreSqlDatabase ?? "",
						mutexTimeoutMs: envMutexMs(envVars, "entityStorageMutexTimeout"),
						pool: {
							max: EnvHelper.envCount(envVars, "postgreSqlPoolMax"),
							idleTimeout: EnvHelper.envSeconds(envVars, "postgreSqlPoolIdleTimeout"),
							connectTimeout: EnvHelper.envSeconds(envVars, "postgreSqlPoolConnectTimeout"),
							maxLifetime: EnvHelper.envSeconds(envVars, "postgreSqlPoolMaxLifetime")
						}
					},
					tablePrefix: envVars.entityStorageTablePrefix
				}
			});
		}
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

	const blobStorageConnectorTypes = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		BlobStorageConnectorType
	>(envVars, "blobStorageConnectorType", Object.values(BlobStorageConnectorType));

	for (const blobStorageConnectorType of blobStorageConnectorTypes) {
		if (blobStorageConnectorType === BlobStorageConnectorType.Memory) {
			coreConfig.types.blobStorageConnector.push({
				type: BlobStorageConnectorType.Memory
			});
		} else if (blobStorageConnectorType === BlobStorageConnectorType.File) {
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
		} else if (blobStorageConnectorType === BlobStorageConnectorType.Ipfs) {
			coreConfig.types.blobStorageConnector.push({
				type: BlobStorageConnectorType.Ipfs,
				options: {
					config: {
						apiUrl: envVars.ipfsApiUrl ?? "",
						bearerToken: envVars.ipfsBearerToken
					}
				}
			});
		} else if (blobStorageConnectorType === BlobStorageConnectorType.AwsS3) {
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
		} else if (blobStorageConnectorType === BlobStorageConnectorType.AzureStorage) {
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
		} else if (blobStorageConnectorType === BlobStorageConnectorType.GcpStorage) {
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
	}

	if (Is.arrayValue(blobStorageConnectorTypes)) {
		const defaultStorageConnectorType =
			envVars.blobStorageConnectorDefault ?? blobStorageConnectorTypes[0];
		for (const config of coreConfig.types.blobStorageConnector) {
			if (config.type === defaultStorageConnectorType) {
				config.isDefault = true;
				break;
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

	const loggingConnectorTypes = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		LoggingConnectorType
	>(envVars, "loggingConnector", Object.values(LoggingConnectorType));
	const levels = getLoggingLevels(envVars);
	let additionalConnectorCount = 0;

	for (const loggingConnector of loggingConnectorTypes) {
		if (loggingConnector === LoggingConnectorType.Console) {
			coreConfig.types.loggingConnector.push({
				type: LoggingConnectorType.Console,
				options: {
					config: {
						translateMessages: true,
						hideGroups: true,
						disableColor: coreConfig.disableColor,
						// Silent still reports errors, matching the engine logger.
						levels: coreConfig.silent ? [LogLevel.Error] : levels
					}
				}
			});
			additionalConnectorCount++;
		} else if (loggingConnector === LoggingConnectorType.EntityStorage) {
			coreConfig.types.loggingConnector.push({
				type: LoggingConnectorType.EntityStorage,
				options: {
					config: {
						levels,
						batchSize: EnvHelper.envCount(envVars, "loggingBatchSize"),
						batchIntervalMs: EnvHelper.envSecToMs(envVars, "loggingBatchFlushInterval"),
						retainForMs: EnvHelper.envMinToMs(envVars, "loggingRetainFor"),
						maxEntries: EnvHelper.envCount(envVars, "loggingMaxEntries"),
						retentionIntervalMs: EnvHelper.envMinToMs(envVars, "loggingRetentionInterval"),
						retentionBatchSize: EnvHelper.envCount(envVars, "loggingRetentionBatchSize")
					}
				}
			});
			additionalConnectorCount++;
		} else if (loggingConnector === LoggingConnectorType.OpenTelemetry) {
			const otelLoggingConfig: IOpenTelemetryLoggingConnectorConfig = {
				levels,
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
						levels,
						directory: envVars.loggingFileDirectory ?? envVars.storageFileRoot ?? "",
						filename: envVars.loggingFileFilename,
						maxFileSizeBytes: EnvHelper.envCount(envVars, "loggingFileMaxFileSizeBytes"),
						maxRetainedFiles: EnvHelper.envCount(envVars, "loggingFileMaxRetainedFiles"),
						mutexTimeoutMs: EnvHelper.envMs(envVars, "mutexTimeoutDefault")
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

	const vaultConnectorType = EnvHelper.envChoice<IEngineEnvironmentVariables, VaultConnectorType>(
		envVars,
		"vaultConnector",
		Object.values(VaultConnectorType)
	);

	if (vaultConnectorType === VaultConnectorType.EntityStorage) {
		coreConfig.types.vaultConnector.push({
			type: VaultConnectorType.EntityStorage,
			options: {
				config: {
					prefix: envVars.vaultPrefix
				}
			}
		});
	} else if (vaultConnectorType === VaultConnectorType.Hashicorp) {
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
			type: BackgroundTaskComponentType.Service,
			options: {
				config: {
					maxSystemWorkerCount: EnvHelper.envCount(
						envVars,
						"backgroundTaskMaxSystemWorkerCount",
						cpus().length * 2
					),
					taskInterval: EnvHelper.envMs(envVars, "backgroundTaskInterval"),
					retryInterval: EnvHelper.envMs(envVars, "backgroundTaskRetryInterval"),
					cleanupInterval: EnvHelper.envMs(envVars, "backgroundTaskCleanupInterval"),
					workerShutdownTimeout: EnvHelper.envMs(envVars, "backgroundTaskWorkerShutdownTimeout"),
					maxDispatchCount: EnvHelper.envCount(envVars, "backgroundTaskMaxDispatchCount")
				}
			}
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

	const eventBusConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		EventBusConnectorType
	>(envVars, "eventBusConnector", Object.values(EventBusConnectorType));

	if (eventBusConnectorType === EventBusConnectorType.Local) {
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

	const telemetryConnectorTypes = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		TelemetryConnectorType
	>(envVars, "telemetryConnector", Object.values(TelemetryConnectorType));
	let additionalConnectorCount = 0;

	for (const telemetryConnectorType of telemetryConnectorTypes) {
		if (telemetryConnectorType === TelemetryConnectorType.Silent) {
			coreConfig.types.telemetryConnector.push({
				type: TelemetryConnectorType.Silent
			});
			additionalConnectorCount++;
		} else if (telemetryConnectorType === TelemetryConnectorType.EntityStorage) {
			coreConfig.types.telemetryConnector.push({
				type: TelemetryConnectorType.EntityStorage,
				options: {
					config: {
						batchSize: EnvHelper.envCount(envVars, "telemetryBatchSize"),
						batchIntervalMs: EnvHelper.envSecToMs(envVars, "telemetryBatchFlushInterval"),
						maxCacheSize: EnvHelper.envCount(envVars, "telemetryMaxCacheSize"),
						flushTimeoutMs: EnvHelper.envMs(envVars, "telemetryFlushTimeout"),
						taskCoalesceMs: EnvHelper.envMs(envVars, "telemetryTaskCoalesce"),
						taskStallTimeoutMs: EnvHelper.envMs(envVars, "telemetryTaskStallTimeout"),
						metricDefinitionCacheCapacity: EnvHelper.envCount(
							envVars,
							"telemetryMetricDefinitionCacheCapacity"
						),
						metricDefinitionCacheTtiMs: EnvHelper.envMs(
							envVars,
							"telemetryMetricDefinitionCacheTtiMs"
						)
					}
				}
			});
			additionalConnectorCount++;
		} else if (telemetryConnectorType === TelemetryConnectorType.OpenTelemetry) {
			let readers: IOpenTelemetryTelemetryConnectorConfig["readers"];
			if (envVars.openTelemetryReader === OpenTelemetryReaderTypes.Prometheus) {
				readers = {
					prometheus: {
						type: OpenTelemetryReaderTypes.Prometheus,
						port: EnvHelper.envCount(envVars, "openTelemetryPrometheusPort")
					}
				};
			}
			coreConfig.types.telemetryConnector.push({
				type: TelemetryConnectorType.OpenTelemetry,
				options: {
					config: {
						meterName: envVars.openTelemetryMeterName,
						meterVersion: envVars.openTelemetryMeterVersion,
						readers
					}
				}
			});
			additionalConnectorCount++;
		}
	}

	// If more than one telemetry connector, then we need to add a multi connector
	// and set it as the default one
	if (additionalConnectorCount > 1) {
		coreConfig.types.telemetryConnector.push({
			type: TelemetryConnectorType.Multi,
			options: {
				telemetryConnectorTypes
			},
			isDefault: true
		});
	} else if (additionalConnectorCount > 0) {
		// If only one connector, then we set it as the default one
		coreConfig.types.telemetryConnector[coreConfig.types.telemetryConnector.length - 1].isDefault =
			true;
	}

	if (additionalConnectorCount > 0) {
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
	if (isTelemetryEnabled(envVars)) {
		coreConfig.types.metricsCollectorComponent ??= [];
		coreConfig.types.metricsCollectorComponent.push({
			type: MetricsCollectorComponentType.Service,
			options: {
				config: {
					intervalMs: EnvHelper.envSecToMs(envVars, "telemetryMetricsCollectorInterval")
				}
			},
			cloneMode: EngineCloneMode.Never
		});

		coreConfig.types.metricsProducerComponent ??= [];

		const metricsProducers = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			MetricsProducerComponentType
		>(envVars, "telemetryMetricsProducers", Object.values(MetricsProducerComponentType), [
			MetricsProducerComponentType.System,
			MetricsProducerComponentType.Process
		]);

		for (const producerType of metricsProducers) {
			coreConfig.types.metricsProducerComponent.push({
				type: producerType,
				options: { maxHistory: EnvHelper.envCount(envVars, "telemetryMetricsProducerMaxHistory") },
				cloneMode: EngineCloneMode.Never
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

	const tracingConnectorTypes = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		TracingConnectorType
	>(envVars, "tracingConnector", Object.values(TracingConnectorType));
	let additionalConnectorCount = 0;

	for (const tracingConnectorType of tracingConnectorTypes) {
		if (tracingConnectorType === TracingConnectorType.Silent) {
			coreConfig.types.tracingConnector.push({
				type: TracingConnectorType.Silent
			});
			additionalConnectorCount++;
		} else if (tracingConnectorType === TracingConnectorType.EntityStorage) {
			coreConfig.types.tracingConnector.push({
				type: TracingConnectorType.EntityStorage
			});
			additionalConnectorCount++;
		} else if (tracingConnectorType === TracingConnectorType.Console) {
			coreConfig.types.tracingConnector.push({
				type: TracingConnectorType.Console,
				options: {
					config: {
						disableColor: coreConfig.disableColor
					}
				}
			});
			additionalConnectorCount++;
		} else if (tracingConnectorType === TracingConnectorType.OpenTelemetry) {
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
			additionalConnectorCount++;
		}
	}

	// If more than one tracing connector, then we need to add a multi connector
	// and set it as the default one
	if (additionalConnectorCount > 1) {
		coreConfig.types.tracingConnector.push({
			type: TracingConnectorType.Multi,
			options: {
				tracingConnectorTypes
			},
			isDefault: true
		});
	} else if (additionalConnectorCount > 0) {
		// If only one connector, then we set it as the default one
		coreConfig.types.tracingConnector[coreConfig.types.tracingConnector.length - 1].isDefault =
			true;
	}

	if (additionalConnectorCount > 0) {
		coreConfig.types.tracingComponent ??= [];
		coreConfig.types.tracingComponent.push({ type: TracingComponentType.Service });
	}
}

/**
 * Configures the facades.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the facade configuration has been applied.
 */
async function configureFacades(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	const facadeTypes = EnvHelper.envListToArray<IEngineEnvironmentVariables, FacadeType>(
		envVars,
		"facade",
		Object.values(FacadeType)
	);

	if (!Is.arrayValue(facadeTypes)) {
		return;
	}

	coreConfig.types.facade ??= [];
	coreConfig.facades ??= {};

	for (const facadeType of facadeTypes) {
		if (facadeType === FacadeType.Tracing) {
			configureTracingFacade(coreConfig.types.facade, coreConfig.facades, envVars);
		}
	}
}

/**
 * Configures the tracing facade.
 * @param facadeTypeConfigs The facade type configs to add to.
 * @param facades The facades to activate, keyed by the type name of the factory they apply to.
 * @param envVars The environment variables.
 */
function configureTracingFacade(
	facadeTypeConfigs: IEngineCoreTypeConfig<FacadeConfig>[],
	facades: { [factoryTypeName: string]: IEngineFacadeConfig[] },
	envVars: IEngineEnvironmentVariables
): void {
	// The facade records its spans through the tracing subsystem, without it there is nothing to record to.
	if (!isTracingEnabled(envVars)) {
		return;
	}

	// The facade is meaningless without factories to activate it on, so fall back to the defaults.
	const configuredFactoryTypeNames = EnvHelper.commaSeparatedListToArray<string>(
		envVars.tracingFacadeFactories
	);
	const factoryTypeNames = [
		...new Set(
			Is.arrayValue(configuredFactoryTypeNames)
				? configuredFactoryTypeNames
				: DEFAULT_TRACING_FACADE_FACTORIES
		)
	];

	const config: ITracingFacadeConfig = {};

	// Adding to the default excludes. We want to keep default list as a base and only add to it.
	const excludeParams = EnvHelper.commaSeparatedListToArray<string>(
		envVars.tracingFacadeExcludeParams
	);
	if (Is.arrayValue(excludeParams)) {
		config.excludeParams = [
			...new Set([...TracingFacade.DEFAULT_EXCLUDE_PARAMS, ...excludeParams])
		];
	}

	const excludeMethods = EnvHelper.commaSeparatedListToArray<string>(
		envVars.tracingFacadeExcludeMethods
	);
	if (Is.arrayValue(excludeMethods)) {
		config.excludeMethods = [
			...new Set([...TracingFacade.DEFAULT_EXCLUDE_METHODS, ...excludeMethods])
		];
	}

	const includeObjects = EnvHelper.commaSeparatedListToArray<string>(
		envVars.tracingFacadeIncludeObjects
	);
	if (Is.arrayValue(includeObjects)) {
		config.includeObjects = includeObjects;
	}

	facadeTypeConfigs.push({
		type: FacadeType.Tracing,
		options: Is.objectValue(config) ? { config } : undefined,
		cloneMode: EngineCloneMode.Always
	});

	const componentExcludeTypes = [
		...new Set([
			...DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES,
			...EnvHelper.commaSeparatedListToArray<string>(envVars.tracingFacadeComponentExcludeTypes)
		])
	];

	for (const factoryTypeName of factoryTypeNames) {
		facades[factoryTypeName] ??= [];
		facades[factoryTypeName].push({
			name: TRACING_FACADE_NAME,
			excludeTypes:
				factoryTypeName === COMPONENT_FACTORY_TYPE_NAME ? componentExcludeTypes : undefined
		});
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

		const automationActionTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			AutomationActionType
		>(envVars, "automationActionTypes", Object.values(AutomationActionType));

		coreConfig.types.automationAction ??= [];

		for (const actionType of automationActionTypes) {
			coreConfig.types.automationAction.push({
				type: actionType,
				isMultiInstance: true
			} as unknown as AutomationActionConfig);
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

	if (EnvHelper.envBoolean(envVars, "healthEnabled", false)) {
		coreConfig.types.healthComponent.push({
			type: HealthComponentType.Service,
			options: {
				config: {
					healthCheckInterval: EnvHelper.envSecToMs(envVars, "healthInterval"),
					healthCheckApplicationInterval: EnvHelper.envSecToMs(
						envVars,
						"healthApplicationInterval"
					),
					initialInterval: EnvHelper.envSecToMs(envVars, "healthStartupInterval", 30000),
					excludeCloneComponents: EnvHelper.envListToArray<IEngineEnvironmentVariables, string>(
						envVars,
						"healthExcludeCloneComponents",
						undefined,
						DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS
					)
				}
			},
			cloneMode: EngineCloneMode.Never
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
	const isSchemaMigrationEnabled = EnvHelper.envBoolean(envVars, "schemaMigrationEnabled", true);

	coreConfig.types.schemaVersionMigrationComponent ??= [];
	coreConfig.types.schemaVersionMigrationComponent.push({
		type: SchemaVersionMigrationComponentType.Service,
		options: { config: { enabled: isSchemaMigrationEnabled } },
		cloneMode: EngineCloneMode.Never
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
	const isTenantEnabled = EnvHelper.envBoolean(envVars, "tenantEnabled", false);

	coreConfig.types.platformComponent ??= [];
	coreConfig.types.platformComponent.push({
		type: PlatformComponentType.Service,
		options: {
			config: {
				isMultiTenant: isTenantEnabled
			}
		},
		cloneMode: EngineCloneMode.Always
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
	const isTenantEnabled = EnvHelper.envBoolean(envVars, "tenantEnabled", false);

	if (isTenantEnabled) {
		coreConfig.types.tenantAdminComponent ??= [];
		coreConfig.types.tenantAdminComponent.push({
			type: TenantAdminComponentType.Service,
			options: {
				config: {
					tenantCacheMutexTimeoutMs: EnvHelper.envMs(envVars, "mutexTimeoutDefault")
				}
			}
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
		features: [CONTEXT_ID_HANDLER_FEATURE_DID],
		cloneMode: EngineCloneMode.Always
	});
	if (EnvHelper.envBoolean(envVars, "tenantEnabled", false)) {
		coreConfig.types.contextIdHandlerComponent.push({
			type: ContextIdHandlerComponentType.Tenant,
			features: [CONTEXT_ID_HANDLER_FEATURE_TENANT],
			cloneMode: EngineCloneMode.Always
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
	coreConfig.types.messagingEmailConnector ??= [];
	coreConfig.types.messagingSmsConnector ??= [];
	coreConfig.types.messagingPushNotificationConnector ??= [];

	const messagingEmailConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		MessagingEmailConnectorType
	>(envVars, "messagingEmailConnector", Object.values(MessagingEmailConnectorType));

	if (messagingEmailConnectorType === MessagingEmailConnectorType.EntityStorage) {
		coreConfig.types.messagingEmailConnector.push({
			type: MessagingEmailConnectorType.EntityStorage
		});
	} else if (messagingEmailConnectorType === MessagingEmailConnectorType.Aws) {
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
	} else if (messagingEmailConnectorType === MessagingEmailConnectorType.Smtp) {
		coreConfig.types.messagingEmailConnector.push({
			type: MessagingEmailConnectorType.Smtp,
			options: {
				config: {
					host: envVars.smtpHost ?? "",
					port: EnvHelper.envInteger(envVars, "smtpPort"),
					secure: EnvHelper.envBoolean(envVars, "smtpSecure"),
					username: envVars.smtpUsername,
					password: envVars.smtpPassword
				}
			}
		});
	}

	const messagingSmsConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		MessagingSmsConnectorType
	>(envVars, "messagingSmsConnector", Object.values(MessagingSmsConnectorType));

	if (messagingSmsConnectorType === MessagingSmsConnectorType.EntityStorage) {
		coreConfig.types.messagingSmsConnector.push({
			type: MessagingSmsConnectorType.EntityStorage
		});
	} else if (messagingSmsConnectorType === MessagingSmsConnectorType.Aws) {
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

	const messagingPushConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		MessagingPushNotificationConnectorType
	>(
		envVars,
		"messagingPushNotificationConnector",
		Object.values(MessagingPushNotificationConnectorType)
	);

	if (messagingPushConnectorType === MessagingPushNotificationConnectorType.EntityStorage) {
		coreConfig.types.messagingPushNotificationConnector.push({
			type: MessagingPushNotificationConnectorType.EntityStorage
		});
	} else if (messagingPushConnectorType === MessagingPushNotificationConnectorType.Aws) {
		coreConfig.types.messagingPushNotificationConnector.push({
			type: MessagingPushNotificationConnectorType.Aws,
			options: {
				config: {
					region: envVars.awsSesRegion ?? "",
					authMode: envVars.awsSesAuthMode as "credentials" | "pod",
					accessKeyId: envVars.awsSesAccessKeyId,
					secretAccessKey: envVars.awsSesSecretAccessKey,
					endpoint: envVars.awsSesEndpoint,
					applicationsSettings: EnvHelper.envArray(
						envVars,
						"awsMessagingPushNotificationApplications",
						[]
					)
				}
			}
		});
	}

	// If any messaging connectors are configured, then we should configure the messaging admin and
	// service components as well since they are required for the messaging connectors to work.
	if (
		coreConfig.types.messagingEmailConnector.length > 0 ||
		coreConfig.types.messagingSmsConnector.length > 0 ||
		coreConfig.types.messagingPushNotificationConnector.length > 0
	) {
		coreConfig.types.messagingAdminComponent ??= [];
		coreConfig.types.messagingAdminComponent.push({
			type: MessagingAdminComponentType.Service
		});

		coreConfig.types.messagingComponent ??= [];
		coreConfig.types.messagingComponent.push({ type: MessagingComponentType.Service });
	}
}

/**
 * Configures mailbox components, mail storage components, and email protocol connectors.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the mailbox configuration has been applied.
 */
async function configureMailbox(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.emailProtocolConnector ??= [];

	const emailProtocolConnectorTypes = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		EmailProtocolConnectorType
	>(envVars, "emailProtocolConnector", Object.values(EmailProtocolConnectorType));
	for (const emailProtocolConnectorType of emailProtocolConnectorTypes) {
		coreConfig.types.emailProtocolConnector.push({
			type: emailProtocolConnectorType,
			options: {
				config: {} as never
			},
			cloneMode: EngineCloneMode.Never,
			isMultiInstance: true
		});
	}

	// If email protocol connectors are configured, then we should configure the mailbox and mail store
	// components as well, since they are required for the email protocol connectors to work.
	if (coreConfig.types.emailProtocolConnector.length > 0) {
		coreConfig.types.mailStorageComponent ??= [];
		coreConfig.types.mailStorageComponent.push({
			type: MailStorageComponentType.Service,
			cloneMode: EngineCloneMode.Never
		});

		coreConfig.types.mailboxComponent ??= [];
		coreConfig.types.mailboxComponent.push({
			type: MailboxComponentType.Service,
			cloneMode: EngineCloneMode.Never
		});
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

	const faucetConnectorType = EnvHelper.envChoice<IEngineEnvironmentVariables, FaucetConnectorType>(
		envVars,
		"faucetConnector",
		Object.values(FaucetConnectorType)
	);

	if (faucetConnectorType === FaucetConnectorType.EntityStorage) {
		coreConfig.types.faucetConnector.push({
			type: FaucetConnectorType.EntityStorage
		});
	} else if (
		faucetConnectorType === FaucetConnectorType.Iota &&
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

	const walletConnectorType = EnvHelper.envChoice<IEngineEnvironmentVariables, WalletConnectorType>(
		envVars,
		"walletConnector",
		Object.values(WalletConnectorType)
	);

	if (walletConnectorType === WalletConnectorType.EntityStorage) {
		coreConfig.types.walletConnector.push({
			type: WalletConnectorType.EntityStorage
		});
	} else if (walletConnectorType === WalletConnectorType.Iota) {
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

	const nftConnectorType = EnvHelper.envChoice<IEngineEnvironmentVariables, NftConnectorType>(
		envVars,
		"nftConnector",
		Object.values(NftConnectorType)
	);

	if (nftConnectorType === NftConnectorType.EntityStorage) {
		coreConfig.types.nftConnector.push({
			type: NftConnectorType.EntityStorage
		});
	} else if (nftConnectorType === NftConnectorType.Iota) {
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

	const notarizationConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		NotarizationConnectorType
	>(envVars, "notarizationConnector", Object.values(NotarizationConnectorType));

	if (notarizationConnectorType === NotarizationConnectorType.EntityStorage) {
		coreConfig.types.notarizationConnector.push({
			type: NotarizationConnectorType.EntityStorage
		});
	} else if (notarizationConnectorType === NotarizationConnectorType.Iota) {
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
					taskRetryCount: EnvHelper.envCount(envVars, "immutableProofTaskRetryCount"),
					taskRetryInterval: EnvHelper.envSecToMs(envVars, "immutableProofTaskRetryInterval"),
					taskFailureRetainFor: EnvHelper.envMinToMs(envVars, "immutableProofTaskFailureRetainFor"),
					taskWorkerIdleTimeout: EnvHelper.envSecToMs(
						envVars,
						"immutableProofTaskWorkerIdleTimeout"
					),
					taskWorkerCount: EnvHelper.envCount(envVars, "immutableProofTaskWorkerCount"),
					sweepIntervalMinutes: EnvHelper.envMinutes(envVars, "immutableProofSweepInterval"),
					sweepStaleThresholdMs: EnvHelper.envMinToMs(envVars, "immutableProofSweepStaleThreshold"),
					sweepMaxAttempts: EnvHelper.envCount(envVars, "immutableProofSweepMaxAttempts"),
					sweepBatchLimit: EnvHelper.envCount(envVars, "immutableProofSweepBatchLimit"),
					sweepBackoffMs: EnvHelper.envMinToMs(envVars, "immutableProofSweepBackoff"),
					sweepAssumeRetryableBefore: EnvHelper.envDateTime(
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

	const identityConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		IdentityConnectorType
	>(envVars, "identityConnector", Object.values(IdentityConnectorType));

	if (identityConnectorType === IdentityConnectorType.EntityStorage) {
		coreConfig.types.identityConnector.push({
			type: IdentityConnectorType.EntityStorage,
			options: {
				config: {
					didResolutionCacheMutexTimeoutMs: envMutexMs(
						envVars,
						"identityDidResolutionCacheMutexTimeout"
					)
				}
			}
		});
	} else if (identityConnectorType === IdentityConnectorType.Iota) {
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
					walletAddressIndex: EnvHelper.envCount(envVars, "identityWalletAddressIndex") ?? 0,
					didResolutionCacheTtlMs: EnvHelper.envMs(envVars, "identityDidResolutionCacheTtl"),
					didResolutionCacheCapacity: EnvHelper.envCount(
						envVars,
						"identityDidResolutionCacheCapacity"
					),
					didResolutionCacheMutexTimeoutMs: envMutexMs(
						envVars,
						"identityDidResolutionCacheMutexTimeout"
					),
					didResolutionRetries: EnvHelper.envCount(envVars, "identityDidResolutionRetries"),
					didResolutionRetryDelayMs: EnvHelper.envMs(envVars, "identityDidResolutionRetryDelay")
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

	const identityResolverConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		IdentityResolverConnectorType
	>(envVars, "identityResolverConnector", Object.values(IdentityResolverConnectorType));

	if (identityResolverConnectorType === IdentityResolverConnectorType.EntityStorage) {
		coreConfig.types.identityResolverConnector.push({
			type: IdentityResolverConnectorType.EntityStorage,
			options: {
				config: {
					didResolutionCacheMutexTimeoutMs: envMutexMs(
						envVars,
						"identityDidResolutionCacheMutexTimeout"
					)
				}
			}
		});
	} else if (identityResolverConnectorType === IdentityResolverConnectorType.Iota) {
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
						: undefined,
					didResolutionCacheMutexTimeoutMs: envMutexMs(
						envVars,
						"identityDidResolutionCacheMutexTimeout"
					)
				}
			}
		});
	} else if (identityResolverConnectorType === IdentityResolverConnectorType.Universal) {
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

	const identityProfileConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		IdentityProfileConnectorType
	>(envVars, "identityProfileConnector", Object.values(IdentityProfileConnectorType));

	if (identityProfileConnectorType === IdentityProfileConnectorType.EntityStorage) {
		coreConfig.types.identityProfileConnector.push({
			type: IdentityProfileConnectorType.EntityStorage
		});
	}

	if (coreConfig.types.identityProfileConnector.length > 0) {
		coreConfig.types.identityProfileComponent ??= [];
		coreConfig.types.identityProfileComponent.push({
			type: IdentityProfileComponentType.Service,
			options: {
				config: {
					selfUpdateDeniedProperties: EnvHelper.envListToArray<IEngineEnvironmentVariables, string>(
						envVars,
						"identityProfileSelfUpdateDeniedProperties",
						undefined,
						undefined
					),
					adminScopes: EnvHelper.envListToArray<IEngineEnvironmentVariables, string>(
						envVars,
						"identityProfileAdminScopes",
						undefined,
						undefined
					)
				}
			}
		});
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

	const attestationConnectorType = EnvHelper.envChoice<
		IEngineEnvironmentVariables,
		AttestationConnectorType
	>(envVars, "attestationConnector", Object.values(AttestationConnectorType));

	if (attestationConnectorType === AttestationConnectorType.Nft) {
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
	if (EnvHelper.envBoolean(envVars, "auditableItemGraphEnabled", false)) {
		coreConfig.types.auditableItemGraphComponent ??= [];
		coreConfig.types.auditableItemGraphComponent.push({
			type: AuditableItemGraphComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMutexMs(envVars, "auditableItemGraphMutexTimeout")
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
	if (EnvHelper.envBoolean(envVars, "auditableItemStreamEnabled", false)) {
		coreConfig.types.auditableItemStreamComponent ??= [];
		coreConfig.types.auditableItemStreamComponent.push({
			type: AuditableItemStreamComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMutexMs(envVars, "auditableItemStreamMutexTimeout")
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
	coreConfig.types.dataConverterConnector ??= [];

	const converterConnectors = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		DataConverterConnectorType
	>(envVars, "dataConverterConnectors", Object.values(DataConverterConnectorType));
	for (const converterConnector of converterConnectors) {
		coreConfig.types.dataConverterConnector.push({
			type: converterConnector
		});
	}

	coreConfig.types.dataExtractorConnector ??= [];
	const extractorConnectors = EnvHelper.envListToArray<
		IEngineEnvironmentVariables,
		DataExtractorConnectorType
	>(envVars, "dataExtractorConnectors", Object.values(DataExtractorConnectorType));
	for (const extractorConnector of extractorConnectors) {
		coreConfig.types.dataExtractorConnector.push({
			type: extractorConnector
		});
	}

	if (
		coreConfig.types.dataConverterConnector.length > 0 ||
		coreConfig.types.dataExtractorConnector.length > 0
	) {
		coreConfig.types.dataProcessingComponent ??= [];
		coreConfig.types.dataProcessingComponent.push({ type: DataProcessingComponentType.Service });
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
	if (EnvHelper.envBoolean(envVars, "documentManagementEnabled", false)) {
		coreConfig.types.documentManagementComponent ??= [];
		coreConfig.types.documentManagementComponent.push({
			type: DocumentManagementComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMutexMs(envVars, "documentManagementMutexTimeout")
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
		const trustGeneratorTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			TrustGeneratorComponentType
		>(envVars, "trustGenerators", Object.values(TrustGeneratorComponentType));

		for (const trustGeneratorType of trustGeneratorTypes) {
			coreConfig.types.trustGeneratorComponent.push({
				type: trustGeneratorType,
				options: {
					config: {
						verificationMethodId: envVars.trustVerificationMethodId ?? "",
						tokenTtlInSeconds: EnvHelper.envCount(envVars, "trustJwtTtl")
					}
				}
			});
		}

		coreConfig.types.trustVerifierComponent ??= [];
		const trustVerifierTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			TrustVerifierComponentType
		>(envVars, "trustVerifiers", Object.values(TrustVerifierComponentType));
		for (const trustVerifierType of trustVerifierTypes) {
			if (trustVerifierType === TrustVerifierComponentType.IdentityAllowDeny) {
				coreConfig.types.trustVerifierComponent.push({
					type: TrustVerifierComponentType.IdentityAllowDeny,
					options: {
						config: {
							allowIdentities: EnvHelper.commaSeparatedListToArray<string>(
								envVars.trustIdentitiesAllow
							),
							denyIdentities: EnvHelper.commaSeparatedListToArray<string>(
								envVars.trustIdentitiesDeny
							)
						}
					}
				});
			} else if (trustVerifierType === TrustVerifierComponentType.JwtVerifiableCredential) {
				coreConfig.types.trustVerifierComponent.push({
					type: TrustVerifierComponentType.JwtVerifiableCredential,
					options: {
						config: {
							verificationCacheMutexTimeoutMs: EnvHelper.envMs(envVars, "mutexTimeoutDefault")
						}
					}
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
		const rightsManagementPath =
			EnvHelper.envString(envVars, "rightsManagementCallbackPath") ?? "rights-management";

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
					mutexTimeoutMs: envMutexMs(envVars, "rightsManagementMutexTimeout")
				}
			},
			isDefault: true
		});

		coreConfig.types.rightsManagementPnapComponent ??= [];
		coreConfig.types.rightsManagementPnapComponent.push({
			type: RightsManagementPnapComponentType.Service,
			options: {
				config: {
					mutexTimeoutMs: envMutexMs(envVars, "rightsManagementMutexTimeout")
				}
			}
		});

		coreConfig.types.rightsManagementPolicyArbiterComponent ??= [];
		const policyArbiterTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			RightsManagementPolicyArbiterComponentType
		>(
			envVars,
			"rightsManagementPolicyArbiters",
			Object.values(RightsManagementPolicyArbiterComponentType)
		);
		for (const policyArbiterType of policyArbiterTypes) {
			coreConfig.types.rightsManagementPolicyArbiterComponent.push({
				type: policyArbiterType
			});
		}

		coreConfig.types.rightsManagementPolicyObligationEnforcerComponent ??= [];
		const policyObligationEnforcerTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			RightsManagementPolicyObligationEnforcerComponentType
		>(
			envVars,
			"rightsManagementPolicyObligationEnforcers",
			Object.values(RightsManagementPolicyObligationEnforcerComponentType)
		);
		for (const policyObligationEnforcerType of policyObligationEnforcerTypes) {
			coreConfig.types.rightsManagementPolicyObligationEnforcerComponent.push({
				type: policyObligationEnforcerType
			});
		}

		coreConfig.types.rightsManagementPolicyEnforcementProcessorComponent ??= [];
		const policyEnforcementProcessTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			RightsManagementPolicyEnforcementProcessorComponentType
		>(
			envVars,
			"rightsManagementPolicyEnforcementProcessors",
			Object.values(RightsManagementPolicyEnforcementProcessorComponentType)
		);
		for (const policyEnforcementProcessorType of policyEnforcementProcessTypes) {
			coreConfig.types.rightsManagementPolicyEnforcementProcessorComponent.push({
				type: policyEnforcementProcessorType
			});
		}

		coreConfig.types.rightsManagementPolicyExecutionActionComponent ??= [];
		const policyExecutionActionTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			RightsManagementPolicyExecutionActionComponentType
		>(
			envVars,
			"rightsManagementPolicyExecutionActions",
			Object.values(RightsManagementPolicyExecutionActionComponentType)
		);
		for (const policyExecutionActionType of policyExecutionActionTypes) {
			coreConfig.types.rightsManagementPolicyExecutionActionComponent.push({
				type: policyExecutionActionType
			});
		}

		coreConfig.types.rightsManagementPolicyInformationSourceComponent ??= [];
		const policyInformationSourceTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			RightsManagementPolicyInformationSourceComponentType
		>(
			envVars,
			"rightsManagementPolicyInformationSources",
			Object.values(RightsManagementPolicyInformationSourceComponentType)
		);
		for (const policyInformationSourceType of policyInformationSourceTypes) {
			coreConfig.types.rightsManagementPolicyInformationSourceComponent.push({
				type: policyInformationSourceType
			});
		}

		coreConfig.types.rightsManagementPolicyRequesterComponent ??= [];
		const policyRequesterTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			RightsManagementPolicyRequesterComponentType
		>(
			envVars,
			"rightsManagementPolicyRequesters",
			Object.values(RightsManagementPolicyRequesterComponentType)
		);
		for (const policyRequesterType of policyRequesterTypes) {
			coreConfig.types.rightsManagementPolicyRequesterComponent.push({
				type: policyRequesterType
			});
		}

		coreConfig.types.rightsManagementPolicyNegotiatorComponent ??= [];
		const policyNegotiatorTypes = EnvHelper.envListToArray<
			IEngineEnvironmentVariables,
			RightsManagementPolicyNegotiatorComponentType
		>(
			envVars,
			"rightsManagementPolicyNegotiators",
			Object.values(RightsManagementPolicyNegotiatorComponentType)
		);
		for (const policyNegotiatorType of policyNegotiatorTypes) {
			coreConfig.types.rightsManagementPolicyNegotiatorComponent.push({
				type: policyNegotiatorType
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
						mutexTimeoutMs: envMutexMs(envVars, "federatedCatalogueMutexTimeout")
					}
				}
			});

			coreConfig.types.federatedCatalogueFilterComponent ??= [];
			const filters = EnvHelper.envListToArray<
				IEngineEnvironmentVariables,
				FederatedCatalogueFilterComponentType
			>(envVars, "federatedCatalogueFilters", Object.values(FederatedCatalogueFilterComponentType));

			for (const filter of filters) {
				coreConfig.types.federatedCatalogueFilterComponent.push({
					type: filter,
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
	if (EnvHelper.envBoolean(envVars, "dataspaceEnabled", false)) {
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
					autoStartTransfers: EnvHelper.envBoolean(envVars, "dataspaceAutoStartTransfers", false),
					stalledNegotiationTimeoutMs: EnvHelper.envSecToMs(
						envVars,
						"dataspaceStalledNegotiationTimeout"
					),
					stalledTransferTimeoutMs: EnvHelper.envSecToMs(
						envVars,
						"dataspaceStalledTransferTimeout"
					),
					retainTerminalTransfersForMs: EnvHelper.envSecToMs(
						envVars,
						"dataspaceRetainTerminalTransfersFor"
					),
					providerTransferIdleTimeoutMs: EnvHelper.envSecToMs(
						envVars,
						"dataspaceProviderTransferIdleTimeout"
					),
					providerTransferPolicySweepIntervalMs: EnvHelper.envSecToMs(
						envVars,
						"dataspaceProviderTransferPolicySweepInterval"
					),
					agreementUnusedThresholdMs: EnvHelper.envMs(envVars, "dataspaceAgreementUnusedThreshold"),
					agreementSweepIntervalMs: EnvHelper.envMs(envVars, "dataspaceAgreementSweepInterval")
				}
			},
			isDefault: true
		});

		coreConfig.types.dataspaceDataPlaneComponent ??= [];
		coreConfig.types.dataspaceDataPlaneComponent.push({
			type: DataspaceDataPlaneComponentType.Service,
			options: {
				config: {
					retainActivityLogsForMs: EnvHelper.envSecToMs(envVars, "dataspaceRetainActivityLogsFor"),
					activityLogsCleanUpIntervalMs: EnvHelper.envSecToMs(
						envVars,
						"dataspaceActivityLogsCleanupInterval"
					),
					retryCount: EnvHelper.envCount(envVars, "dataspaceRetryCount"),
					pushRetryCount: EnvHelper.envCount(envVars, "dataspacePushRetryCount"),
					pushRetryBaseDelayMs: EnvHelper.envMs(envVars, "dataspacePushRetryBaseDelay"),
					pushTimeoutMs: EnvHelper.envMs(envVars, "dataspacePushTimeout"),
					pushSubscriptionCleanupIntervalMs: EnvHelper.envMs(
						envVars,
						"dataspacePushSubscriptionCleanupInterval"
					),
					agreementCacheTtlMs: EnvHelper.envMs(envVars, "dataspaceAgreementCacheTtl"),
					agreementCacheMutexTimeoutMs: envMutexMs(envVars, "dataspaceAgreementCacheMutexTimeout")
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
					coinType: EnvHelper.envCount(envVars, "iotaCoinType"),
					gasStation: gasStationConfig,
					gasBudget: EnvHelper.envCount(envVars, "iotaGasBudget"),
					gasReservationDuration: EnvHelper.envSeconds(envVars, "iotaGasReservationDuration")
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
		EnvHelper.envBoolean(envVars, "dataspaceEnabled", false) ||
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
	return (
		EnvHelper.envBoolean(envVars, "dataspaceEnabled", false) ||
		isImmutableProofRequired(envVars) ||
		EnvHelper.envBoolean(envVars, "healthEnabled", false) ||
		EnvHelper.commaSeparatedListToArray<TelemetryConnectorType>(
			envVars.telemetryConnector
		).includes(TelemetryConnectorType.EntityStorage)
	);
}

/**
 * Checks if the immutable proof subsystem is required.
 * Returns true when any component that depends on the immutable proof subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if verifiable storage is enabled.
 */
export function isImmutableProofRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		EnvHelper.envBoolean(envVars, "auditableItemGraphEnabled", false) ||
		EnvHelper.envBoolean(envVars, "auditableItemStreamEnabled", false) ||
		EnvHelper.envBoolean(envVars, "documentManagementEnabled", false)
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
		EnvHelper.envBoolean(envVars, "federatedCatalogueEnabled", false) ||
		Is.stringValue(envVars.federatedCatalogueRemoteEndpoint) ||
		Is.stringValue(envVars.federatedCatalogueFilters) ||
		EnvHelper.envBoolean(envVars, "dataspaceEnabled", false)
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
	return EnvHelper.envBoolean(envVars, "dataspaceEnabled", false);
}

/**
 * Checks if the task scheduler subsystem is required.
 * Returns true when any component that depends on the task scheduler subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if task scheduler is enabled.
 */
export function isTaskSchedulerRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		EnvHelper.envBoolean(envVars, "taskSchedulerEnabled", false) ||
		EnvHelper.envBoolean(envVars, "dataspaceEnabled", false) ||
		isRightsManagementRequired(envVars) ||
		isAuthEntityStorageRequired(envVars) ||
		isImmutableProofRequired(envVars) ||
		isMailboxEnabled(envVars)
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
 * Checks if the telemetry subsystem is enabled.
 * Returns true when any component that depends on the telemetry subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if telemetry is enabled.
 */
export function isTelemetryEnabled(envVars: IEngineEnvironmentVariables): boolean {
	return EnvHelper.commaSeparatedListToArray<TelemetryConnectorType>(
		envVars.telemetryConnector
	).some(
		t => t === TelemetryConnectorType.EntityStorage || t === TelemetryConnectorType.OpenTelemetry
	);
}

/**
 * Checks if the tracing subsystem is enabled.
 * Returns true when any component that depends on the tracing subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if tracing is enabled.
 */
export function isTracingEnabled(envVars: IEngineEnvironmentVariables): boolean {
	return EnvHelper.commaSeparatedListToArray<TracingConnectorType>(envVars.tracingConnector).some(
		t =>
			t === TracingConnectorType.EntityStorage ||
			t === TracingConnectorType.OpenTelemetry ||
			t === TracingConnectorType.Console
	);
}

/**
 * Checks if the mailbox subsystem is enabled.
 * Returns true when any component that depends on the mailbox subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if mailbox is enabled.
 */
export function isMailboxEnabled(envVars: IEngineEnvironmentVariables): boolean {
	return EnvHelper.commaSeparatedListToArray<EmailProtocolConnectorType>(
		envVars.emailProtocolConnector
	).some(
		t =>
			t === EmailProtocolConnectorType.Imap ||
			t === EmailProtocolConnectorType.Pop3 ||
			t === EmailProtocolConnectorType.Gmail ||
			t === EmailProtocolConnectorType.Outlook
	);
}

/**
 * Get the log levels the logging connectors should record.
 * @param envVars The environment variables.
 * @returns The log levels, or undefined when not configured.
 * @throws GeneralError if the list contains an unknown log level.
 */
function getLoggingLevels(envVars: IEngineEnvironmentVariables): LogLevel[] | undefined {
	return EnvHelper.envListToArray<IEngineEnvironmentVariables, LogLevel>(
		envVars,
		"loggingLevels",
		Object.values(LogLevel),
		undefined
	);
}
