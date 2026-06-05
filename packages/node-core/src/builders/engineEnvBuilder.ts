// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Coerce, Is } from "@twin.org/core";
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
	SynchronisedStorageComponentType,
	TaskSchedulerComponentType,
	TelemetryComponentType,
	TelemetryConnectorType,
	TenantAdminComponentType,
	TenantComponentType,
	TrustComponentType,
	type TrustGeneratorComponentType,
	type TrustVerifierComponentType,
	UrlTransformerComponentType,
	VaultConnectorType,
	VerifiableStorageComponentType,
	VerifiableStorageConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import {
	type IOpenTelemetryTelemetryConnectorConfig,
	OpenTelemetryReaderTypes
} from "@twin.org/telemetry-connector-opentelemetry";
import { CONTEXT_ID_HANDLER_FEATURE_DID, CONTEXT_ID_HANDLER_FEATURE_TENANT } from "../defaults.js";
import { isAuthEntityStorageRequired } from "./engineServerEnvBuilder.js";
import type { IEngineEnvironmentVariables } from "../models/IEngineEnvironmentVariables.js";

/**
 * Build the engine core configuration from environment variables.
 * @param envVars The environment variables.
 * @param contextIdKeys The context ID keys.
 * @returns The config for the core.
 */
export async function buildEngineConfiguration(
	envVars: IEngineEnvironmentVariables,
	contextIdKeys: { key: string; requiredHandlerFeatures: string[] }[]
): Promise<IEngineConfig> {
	if (Is.stringValue(envVars.storageFileRoot)) {
		envVars.stateFilename ??= "engine-state.json";
		envVars.storageFileRoot = path.resolve(envVars.storageFileRoot);
		envVars.stateFilename = path.join(envVars.storageFileRoot, envVars.stateFilename);
	}

	const coreConfig: IEngineConfig = {
		debug: Coerce.boolean(envVars.debug) ?? false,
		silent: Coerce.boolean(envVars.silent) ?? false,
		types: {}
	};

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
	await configureMessaging(coreConfig, envVars);
	await configureAutomation(coreConfig, envVars);
	await configureHealth(coreConfig, envVars);
	await configureUrlTransformer(coreConfig, envVars);

	await configureFaucet(coreConfig, envVars);
	await configureWallet(coreConfig, envVars);
	await configureNft(coreConfig, envVars);
	await configureNotarization(coreConfig, envVars);
	await configureVerifiableStorage(coreConfig, envVars);
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
	await configureSynchronisedStorage(coreConfig, envVars);
	await configureFederatedCatalogue(coreConfig, envVars);
	await configureDataspace(coreConfig, envVars);

	return coreConfig;
}

/**
 * Configures the entity storage.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureEntityStorage(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types ??= {};
	coreConfig.types.entityStorageConnector ??= [];

	const entityStorageConnectorTypes = commaSeparatedListToArray<
		Omit<EntityStorageConnectorType, typeof EntityStorageConnectorType.Synchronised>
	>(envVars.entityStorageConnectorType);

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.Memory)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.Memory
		});
	}

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.File)) {
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.File,
			options: {
				config: { directory: envVars.storageFileRoot ?? "" },
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
					connectionTimeoutMs: Coerce.integer(envVars.awsDynamodbConnectionTimeoutMs)
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
					containerId: envVars.azureCosmosdbContainerId ?? ""
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
					endpoint: envVars.gcpFirestoreApiEndpoint ?? ""
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
					port: Coerce.integer(envVars.scylladbPort)
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
					port: Coerce.integer(envVars.mySqlPort),
					user: envVars.mySqlUser ?? "",
					password: envVars.mySqlPassword ?? "",
					database: envVars.mySqlDatabase ?? ""
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
					port: Coerce.integer(envVars.mongoDbPort),
					user: envVars.mongoDbUser ?? "",
					password: envVars.mongoDbPassword ?? "",
					database: envVars.mongoDbDatabase ?? ""
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
					port: Coerce.integer(envVars.postgreSqlPort),
					user: envVars.postgreSqlUser ?? "",
					password: envVars.postgreSqlPassword ?? "",
					database: envVars.postgreSqlDatabase ?? ""
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
					apiEndpoint: envVars.gcpFirestoreApiEndpoint
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
			// If this blob storage connector is the one to use for public access
			// then add it as a feature
			if (
				Is.stringValue(envVars.blobStorageConnectorPublic) &&
				config.type === envVars.blobStorageConnectorPublic
			) {
				config.features ??= [];
				config.features.push("public");
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
				type: LoggingConnectorType.EntityStorage
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
 * Configures the event bud.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
 */
async function configureTelemetry(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.telemetryConnector ??= [];

	if (envVars.telemetryConnector === TelemetryConnectorType.EntityStorage) {
		coreConfig.types.telemetryConnector.push({
			type: TelemetryConnectorType.EntityStorage
		});
	} else if (envVars.telemetryConnector === TelemetryConnectorType.OpenTelemetry) {
		let readers: IOpenTelemetryTelemetryConnectorConfig["readers"];
		if (envVars.openTelemetryReader === "prometheus") {
			readers = {
				prometheus: {
					type: OpenTelemetryReaderTypes.Prometheus,
					port: Coerce.integer(envVars.openTelemetryPrometheusPort)
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
 */
async function configureMetricsCollector(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isTelemetryRequired(envVars)) {
		const intervalSec = Coerce.integer(envVars.telemetryMetricsCollectorIntervalSeconds) ?? 60;

		coreConfig.types.metricsCollectorComponent ??= [];
		coreConfig.types.metricsCollectorComponent.push({
			type: MetricsCollectorComponentType.Service,
			options: { config: { intervalMs: intervalSec * 1000 } }
		});

		const maxHistory = Coerce.integer(envVars.telemetryMetricsProducerMaxHistory) ?? 1440;
		coreConfig.types.metricsProducerComponent ??= [];

		const metricsProducers = commaSeparatedListToArray(
			envVars.telemetryMetricsProducers ??
				[MetricsProducerComponentType.System, MetricsProducerComponentType.Process].join(",")
		);

		for (const producerType of metricsProducers) {
			coreConfig.types.metricsProducerComponent.push({
				type: producerType as MetricsProducerComponentType,
				options: { maxHistory }
			});
		}
	}
}

/**
 * Configures the automation.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
 */
async function configureHealth(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.healthComponent ??= [];

	if (Coerce.boolean(envVars.healthEnabled) ?? false) {
		coreConfig.types.healthComponent.push({
			type: HealthComponentType.Service,
			options: {
				config: {
					healthCheckInterval: (Coerce.integer(envVars.healthIntervalSeconds) ?? 60) * 1000,
					initialInterval: (Coerce.integer(envVars.healthStartupIntervalSeconds) ?? 2) * 1000
				}
			}
		});
	}
}

/**
 * Configures the url transformer.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureUrlTransformer(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.urlTransformerComponent ??= [];

	if (isUrlTransformerRequired(envVars) ?? false) {
		coreConfig.types.urlTransformerComponent.push({
			type: UrlTransformerComponentType.Service,
			options: {
				config: {
					paramEncryptionKeyName: envVars.urlTransformerEncryptionKeyId,
					queryParamNames: {
						tenant: "tenant-token"
					}
				}
			}
		});
	}
}

/**
 * Configures the tenant.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureTenant(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.tenantEnabled) ?? false) {
		coreConfig.types.tenantComponent ??= [];
		coreConfig.types.tenantComponent.push({
			type: TenantComponentType.Service
		});

		coreConfig.types.tenantAdminComponent ??= [];
		coreConfig.types.tenantAdminComponent.push({
			type: TenantAdminComponentType.Service
		});
	}
}

/**
 * Configures the context id handlers.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
	if (Coerce.boolean(envVars.tenantEnabled) ?? false) {
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
 */
async function configureMessaging(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.messagingEnabled) ?? false) {
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
			coreConfig.types.messagingPushNotificationConnector.push({
				type: MessagingPushNotificationConnectorType.Aws,
				options: {
					config: {
						region: envVars.awsSesRegion ?? "",
						authMode: envVars.awsSesAuthMode as "credentials" | "pod",
						accessKeyId: envVars.awsSesAccessKeyId,
						secretAccessKey: envVars.awsSesSecretAccessKey,
						endpoint: envVars.awsSesEndpoint,
						applicationsSettings: Is.array(envVars.awsMessagingPushNotificationApplications)
							? JSON.parse(envVars.awsMessagingPushNotificationApplications)
							: []
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
	} else if (envVars.faucetConnector === FaucetConnectorType.Iota) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);
		coreConfig.types.faucetConnector.push({
			type: FaucetConnectorType.Iota,
			options: {
				config: {
					endpoint: envVars.iotaFaucetEndpoint ?? "",
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
 * Configures the verifiable storage.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureVerifiableStorage(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	coreConfig.types.verifiableStorageConnector ??= [];

	if (envVars.verifiableStorageConnector === VerifiableStorageConnectorType.EntityStorage) {
		coreConfig.types.verifiableStorageConnector.push({
			type: VerifiableStorageConnectorType.EntityStorage
		});
	} else if (envVars.verifiableStorageConnector === VerifiableStorageConnectorType.Iota) {
		const dltConfig = EngineTypeHelper.getConfigOfType<DltConfig>(
			coreConfig,
			"dltConfig",
			DltConfigType.Iota
		);

		const config = {
			...(dltConfig?.options?.config as IIotaConfig),
			deploymentPkgId: Is.stringValue(envVars.verifiableStoragePackageId)
				? envVars.verifiableStoragePackageId
				: undefined
		};
		coreConfig.types.verifiableStorageConnector.push({
			type: VerifiableStorageConnectorType.Iota,
			options: {
				config
			}
		});
	}

	if (coreConfig.types.verifiableStorageConnector.length > 0) {
		coreConfig.types.verifiableStorageComponent ??= [];
		coreConfig.types.verifiableStorageComponent.push({
			type: VerifiableStorageComponentType.Service
		});
	}
}

/**
 * Configures the immutable proof.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
					verificationMethodId: envVars.immutableProofVerificationMethodId
				}
			}
		});
	}
}

/**
 * Configures the identity.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
					walletAddressIndex: Coerce.integer(envVars.identityWalletAddressIndex) ?? 0
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
 */
async function configureAuditableItemGraph(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.auditableItemGraphEnabled) ?? false) {
		coreConfig.types.auditableItemGraphComponent ??= [];
		coreConfig.types.auditableItemGraphComponent.push({
			type: AuditableItemGraphComponentType.Service
		});
	}
}

/**
 * Configures the auditable item stream.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureAuditableItemStream(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.auditableItemStreamEnabled) ?? false) {
		coreConfig.types.auditableItemStreamComponent ??= [];
		coreConfig.types.auditableItemStreamComponent.push({
			type: AuditableItemStreamComponentType.Service
		});
	}
}

/**
 * Configures the data processing.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureDataProcessing(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.dataProcessingEnabled) ?? false) {
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
 */
async function configureDocumentManagement(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.documentManagementEnabled) ?? false) {
		coreConfig.types.documentManagementComponent ??= [];
		coreConfig.types.documentManagementComponent.push({
			type: DocumentManagementComponentType.Service
		});
	}
}

/**
 * Configures the trust components.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
						tokenTtlInSeconds: Coerce.integer(envVars.trustJwtTtlSeconds)
					}
				}
			});
		}

		coreConfig.types.trustVerifierComponent ??= [];
		const trustVerifierTypes = commaSeparatedListToArray(envVars.trustVerifiers);
		for (const trustVerifierType of trustVerifierTypes) {
			coreConfig.types.trustVerifierComponent.push({
				type: trustVerifierType as TrustVerifierComponentType
			});
		}
	}
}

/**
 * Configures the rights management.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
					includeErrorDetails: coreConfig.debug ?? false
				}
			},
			isDefault: true
		});

		coreConfig.types.rightsManagementPnapComponent ??= [];
		coreConfig.types.rightsManagementPnapComponent.push({
			type: RightsManagementPnapComponentType.Service
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
 * Configures the synchronised storage.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureSynchronisedStorage(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (
		Is.arrayValue(coreConfig.types.identityResolverComponent) &&
		(Coerce.boolean(envVars.synchronisedStorageEnabled) ?? false)
	) {
		// Check if the config provides a custom verifiable storage key id
		let verifiableStorageKeyId = Coerce.string(envVars.synchronisedStorageVerifiableStorageKeyId);

		if (!Is.stringValue(verifiableStorageKeyId)) {
			// No custom key so default to the network setting
			verifiableStorageKeyId = envVars.iotaNetwork;
		}
		coreConfig.types.synchronisedStorageComponent ??= [];
		coreConfig.types.synchronisedStorageComponent.push({
			type: SynchronisedStorageComponentType.Service,
			options: {
				config: {
					verifiableStorageKeyId: verifiableStorageKeyId ?? "",
					blobStorageEncryptionKeyId: envVars.synchronisedStorageBlobStorageEncryptionKeyId,
					entityUpdateIntervalMinutes: Coerce.number(
						envVars.synchronisedStorageEntityUpdateIntervalMinutes
					),
					consolidationIntervalMinutes: Coerce.number(
						envVars.synchronisedStorageConsolidationIntervalMinutes
					),
					consolidationBatchSize: Coerce.number(envVars.synchronisedStorageConsolidationBatchSize),
					maxConsolidations: Coerce.number(envVars.synchronisedStorageMaxConsolidations)
				}
			}
		});

		// If there is a trusted url set, we need to add a client
		// and give it a feature of trusted so that when the synchronised
		// storage is created it can pickup the correct component
		if (Is.stringValue(envVars.synchronisedStorageTrustedUrl)) {
			coreConfig.types.synchronisedStorageComponent.push({
				type: SynchronisedStorageComponentType.RestClient,
				options: {
					endpoint: envVars.synchronisedStorageTrustedUrl
				},
				features: ["trusted"]
			});
		}
	}
}

/**
 * Configures the federated catalogue.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureFederatedCatalogue(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (isFederatedCatalogueRequired(envVars)) {
		// If synchronised storage is enabled, then we need to add an entity storage connector
		// using synchronised storage for the federated catalogue component
		// as it relies on the synchronised storage to sync the data between the different instances of the federated catalogue
		let overrideEntityStorageType;
		if (
			(Coerce.boolean(envVars.synchronisedStorageEnabled) ?? false) &&
			Is.arrayValue(coreConfig.types.entityStorageConnector)
		) {
			let defaultConnector = coreConfig.types.entityStorageConnector.find(
				connector => connector.isDefault
			);
			if (Is.empty(defaultConnector)) {
				// If there is no default connector, we set the first one as the default one
				defaultConnector = coreConfig.types.entityStorageConnector[0];
			}

			overrideEntityStorageType = "federated-catalogue-dataset";
			coreConfig.types.entityStorageConnector ??= [];
			coreConfig.types.entityStorageConnector.push({
				type: EntityStorageConnectorType.Synchronised,
				overrideInstanceType: overrideEntityStorageType,
				options: {
					entityStorageConnectorType: defaultConnector.type
				}
			});
		}

		coreConfig.types.federatedCatalogueComponent ??= [];
		coreConfig.types.federatedCatalogueComponent.push({
			type: FederatedCatalogueComponentType.Service,
			options: {
				datasetEntityStorageType: overrideEntityStorageType
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

/**
 * Configures the dataspace control plane and data plane.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureDataspace(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.dataspaceEnabled) ?? false) {
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
					dataPlanePath: envVars.dataspaceDataPlanePath
				}
			},
			isDefault: true
		});

		coreConfig.types.dataspaceDataPlaneComponent ??= [];
		coreConfig.types.dataspaceDataPlaneComponent.push({
			type: DataspaceDataPlaneComponentType.Service,
			options: {
				config: {
					retainActivityLogsFor: Coerce.number(envVars.dataspaceRetainActivityLogsFor),
					activityLogsCleanUpInterval: Coerce.number(envVars.dataspaceActivityLogsCleanUpInterval)
				}
			}
		});
	}
}

/**
 * Configures the DLT.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
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
					coinType: Coerce.number(envVars.iotaCoinType),
					gasStation: gasStationConfig
				}
			}
		});
	}
}

/**
 * Converts a comma separated list to an array.
 * @param value The comma separated list.
 * @returns The array.
 */
function commaSeparatedListToArray<T>(value: string | undefined): T[] {
	return (value ?? "")
		.split(",")
		.map(item => item.trim())
		.filter(item => item.length > 0) as T[];
}

/**
 * Checks if the trust subsystem is required.
 * Returns true when any component that depends on the trust subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if rights-management, synchronised-storage, or dataspace is enabled.
 */
export function isTrustRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		isRightsManagementRequired(envVars) ||
		(Coerce.boolean(envVars.dataspaceEnabled) ?? false) ||
		(Coerce.boolean(envVars.synchronisedStorageEnabled) ?? false)
	);
}

/**
 * Checks if the URL transformer subsystem is required.
 * Returns true when any component that depends on the URL transformer subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if rights-management, dataspace, federated-catalogue, tenant, or auth entity storage is enabled.
 */
export function isUrlTransformerRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		isRightsManagementRequired(envVars) ||
		(Coerce.boolean(envVars.dataspaceEnabled) ?? false) ||
		(Coerce.boolean(envVars.tenantEnabled) ?? false) ||
		isFederatedCatalogueRequired(envVars) ||
		isAuthEntityStorageRequired(envVars)
	);
}

/**
 * Checks if the background tasks subsystem is required.
 * Returns true when any component that depends on the background tasks subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if dataspace or verifiable storage is enabled.
 */
export function isBackgroundTasksRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (Coerce.boolean(envVars.dataspaceEnabled) ?? false) || isImmutableProofRequired(envVars);
}

/**
 * Checks if the immutable proof subsystem is required.
 * Returns true when any component that depends on the immutable proof subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if verifiable storage is enabled.
 */
export function isImmutableProofRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		(Coerce.boolean(envVars.auditableItemGraphEnabled) ?? false) ||
		(Coerce.boolean(envVars.auditableItemStreamEnabled) ?? false) ||
		(Coerce.boolean(envVars.documentManagementEnabled) ?? false)
	);
}

/**
 * Checks if the immutable proof subsystem is required.
 * Returns true when any component that depends on the immutable proof subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if verifiable storage is enabled.
 */
export function isFederatedCatalogueRequired(envVars: IEngineEnvironmentVariables): boolean {
	return Coerce.boolean(envVars.dataspaceEnabled) ?? false;
}

/**
 * Checks if the rights management subsystem is required.
 * Returns true when any component that depends on the rights management subsystem is enabled.
 * Note: rights management has no standalone enable flag — it is gated entirely on
 * `dataspaceEnabled`. Setting `TWIN_RIGHTS_MANAGEMENT_*` env var in isolation does not
 * enable the subsystem; `TWIN_DATASPACE_ENABLED` must also be true.
 * @param envVars The environment variables.
 * @returns True if rights management is enabled.
 */
export function isRightsManagementRequired(envVars: IEngineEnvironmentVariables): boolean {
	return Coerce.boolean(envVars.dataspaceEnabled) ?? false;
}

/**
 * Checks if the task scheduler subsystem is required.
 * Returns true when any component that depends on the task scheduler subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if task scheduler is enabled.
 */
export function isTaskSchedulerRequired(envVars: IEngineEnvironmentVariables): boolean {
	return (
		(Coerce.boolean(envVars.dataspaceEnabled) ?? false) ||
		(Coerce.boolean(envVars.synchronisedStorageEnabled) ?? false) ||
		isRightsManagementRequired(envVars) ||
		isAuthEntityStorageRequired(envVars)
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
