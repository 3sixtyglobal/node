// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Coerce, Is } from "@twin.org/core";
import type { IIotaConfig } from "@twin.org/dlt-iota";
import type { IEngineModuleConfig } from "@twin.org/engine-models";
import {
	AttestationComponentType,
	AttestationConnectorType,
	AuditableItemGraphComponentType,
	AuditableItemStreamComponentType,
	AuthenticationGeneratorComponentType,
	BackgroundTaskConnectorType,
	BlobStorageComponentType,
	BlobStorageConnectorType,
	DataConverterConnectorType,
	DataExtractorConnectorType,
	DataProcessingComponentType,
	DataSpaceConnectorComponentType,
	type DltConfig,
	DltConfigType,
	DocumentManagementComponentType,
	EngineTypeHelper,
	EntityStorageConnectorType,
	EventBusComponentType,
	EventBusConnectorType,
	FaucetConnectorType,
	FederatedCatalogueComponentType,
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
	NftComponentType,
	NftConnectorType,
	RightsManagementDapComponentType,
	RightsManagementDarpComponentType,
	RightsManagementPapComponentType,
	RightsManagementPdpComponentType,
	RightsManagementPepComponentType,
	RightsManagementPipComponentType,
	RightsManagementPmpComponentType,
	RightsManagementPnapComponentType,
	RightsManagementPnpComponentType,
	RightsManagementPxpComponentType,
	SynchronisedStorageComponentType,
	TaskSchedulerComponentType,
	TelemetryComponentType,
	TelemetryConnectorType,
	VaultConnectorType,
	VerifiableStorageComponentType,
	VerifiableStorageConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import {
	DataAccessPointClient,
	PolicyNegotiationPointClient
} from "@twin.org/rights-management-rest-client";
import type { IOdrlOffer } from "@twin.org/standards-w3c-odrl";
import {
	ATTESTATION_VERIFICATION_METHOD_ID,
	BLOB_STORAGE_ENCRYPTION_KEY_ID,
	IMMUTABLE_PROOF_VERIFICATION_METHOD_ID,
	SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID,
	VC_AUTHENTICATION_VERIFICATION_METHOD_ID
} from "../defaults";
import type { IEngineEnvironmentVariables } from "../models/IEngineEnvironmentVariables";

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
		debug: Coerce.boolean(envVars.debug) ?? false,
		types: {}
	};

	await configureEntityStorage(coreConfig, envVars);
	await configureBlobStorage(coreConfig, envVars);
	await configureVault(coreConfig, envVars);
	await configureDlt(coreConfig, envVars);

	await configureLogging(coreConfig, envVars);
	await configureBackgroundTask(coreConfig, envVars);
	await configureTaskScheduler(coreConfig, envVars);
	await configureEventBus(coreConfig, envVars);
	await configureTelemetry(coreConfig, envVars);
	await configureMessaging(coreConfig, envVars);

	await configureFaucet(coreConfig, envVars);
	await configureWallet(coreConfig, envVars);
	await configureNft(coreConfig, envVars);
	await configureVerifiableStorage(coreConfig, envVars);
	await configureIdentity(coreConfig, envVars);
	await configureIdentityResolver(coreConfig, envVars);
	await configureIdentityProfile(coreConfig, envVars);
	await configureAttestation(coreConfig, envVars);
	await configureDataProcessing(coreConfig, envVars);

	await configureAuditableItemGraph(coreConfig, envVars);
	await configureAuditableItemStream(coreConfig, envVars);
	await configureDocumentManagement(coreConfig, envVars);
	await configureVerifiableCredentialAuthentication(coreConfig, envVars);
	await configureRightsManagement(coreConfig, envVars);
	await configureSynchronisedStorage(coreConfig, envVars);
	await configureFederatedCatalogue(coreConfig, envVars);
	await configureDataSpaceConnector(coreConfig, envVars);

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

	const entityStorageConnectorTypes = envVars.entityStorageConnectorType?.split(",") ?? [];

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
					endpoint: envVars.awsDynamodbEndpoint
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
					hosts: envVars.scylladbHosts?.split(",") ?? [],
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

	if (entityStorageConnectorTypes.includes(EntityStorageConnectorType.Synchronised)) {
		// For synchronised storage we use the default connector as the one we wrap for real DB operations
		coreConfig.types.entityStorageConnector.push({
			type: EntityStorageConnectorType.Synchronised,
			options: {
				entityStorageConnectorType: defaultEntityStorageConnectorType
			}
		});
	}

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

	const blobStorageConnectorTypes = envVars.blobStorageConnectorType?.split(",") ?? [];

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
							? (envVars.blobStorageEncryptionKeyId ?? BLOB_STORAGE_ENCRYPTION_KEY_ID)
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

	const loggingConnectorTypes = (envVars.loggingConnector ?? "").split(",");
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

	if (additionalConnectorCount > 1) {
		coreConfig.types.loggingConnector?.push({
			type: LoggingConnectorType.Multi,
			options: {
				loggingConnectorTypes
			}
		});
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
			type: VaultConnectorType.EntityStorage
		});
	} else if (envVars.vaultConnector === VaultConnectorType.Hashicorp) {
		coreConfig.types.vaultConnector.push({
			type: VaultConnectorType.Hashicorp,
			options: {
				config: {
					endpoint: envVars.hashicorpVaultEndpoint ?? "",
					token: envVars.hashicorpVaultToken ?? ""
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
	coreConfig.types.backgroundTaskConnector ??= [];

	if (envVars.backgroundTaskConnector === BackgroundTaskConnectorType.EntityStorage) {
		coreConfig.types.backgroundTaskConnector.push({
			type: BackgroundTaskConnectorType.EntityStorage
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
	}

	if (coreConfig.types.telemetryConnector.length > 0) {
		coreConfig.types.telemetryComponent ??= [];
		coreConfig.types.telemetryComponent.push({ type: TelemetryComponentType.Service });
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
						applicationsSettings: Is.json(envVars.awsMessagingPushNotificationApplications)
							? JSON.parse(envVars.awsMessagingPushNotificationApplications)
							: []
					}
				}
			});
		}

		const templates = Is.arrayValue<{
			templateId: string;
			title: string;
			content: { [locale: string]: string };
		}>(envVars.messagingTemplates)
			? envVars.messagingTemplates
			: undefined;

		coreConfig.types.messagingAdminComponent ??= [];
		coreConfig.types.messagingAdminComponent.push({
			type: MessagingAdminComponentType.Service,
			options: {
				config: {
					templates
				}
			}
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
		coreConfig.types.nftConnector.push({
			type: NftConnectorType.Iota,
			options: {
				config: dltConfig?.options?.config ?? ({} as IIotaConfig)
			}
		});
	}

	if (coreConfig.types.nftConnector.length > 0) {
		coreConfig.types.nftComponent ??= [];
		coreConfig.types.nftComponent.push({ type: NftComponentType.Service });
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
		coreConfig.types.verifiableStorageConnector.push({
			type: VerifiableStorageConnectorType.Iota,
			options: {
				config: dltConfig?.options?.config ?? ({} as IIotaConfig)
			}
		});
	}

	if (coreConfig.types.verifiableStorageConnector.length > 0) {
		coreConfig.types.verifiableStorageComponent ??= [];
		coreConfig.types.verifiableStorageComponent.push({
			type: VerifiableStorageComponentType.Service
		});

		coreConfig.types.immutableProofComponent ??= [];
		coreConfig.types.immutableProofComponent.push({
			type: ImmutableProofComponentType.Service,
			options: {
				config: {
					verificationMethodId:
						envVars.immutableProofVerificationMethodId ?? IMMUTABLE_PROOF_VERIFICATION_METHOD_ID
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
				config: dltConfig?.options?.config ?? ({} as IIotaConfig)
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
				config: dltConfig?.options?.config ?? ({} as IIotaConfig)
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
					verificationMethodId:
						envVars.attestationVerificationMethodId ?? ATTESTATION_VERIFICATION_METHOD_ID
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

		const converterConnectors = envVars.dataConverterConnectors?.split(",") ?? [];
		for (const converterConnector of converterConnectors) {
			if (converterConnector === DataConverterConnectorType.Json) {
				coreConfig.types.dataConverterConnector.push({
					type: DataConverterConnectorType.Json
				});
			} else if (converterConnector === DataConverterConnectorType.Xml) {
				coreConfig.types.dataConverterConnector.push({
					type: DataConverterConnectorType.Xml
				});
			}
		}

		coreConfig.types.dataExtractorConnector ??= [];
		const extractorConnectors = envVars.dataExtractorConnectors?.split(",") ?? [];
		for (const extractorConnector of extractorConnectors) {
			if (extractorConnector === DataExtractorConnectorType.JsonPath) {
				coreConfig.types.dataExtractorConnector.push({
					type: DataExtractorConnectorType.JsonPath
				});
			}
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
 * Configures the verifiable credential authentication.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureVerifiableCredentialAuthentication(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.vcAuthenticationEnabled) ?? false) {
		// Can only perform VC authentication if identity component is available
		coreConfig.types.authenticationGeneratorComponent ??= [];
		coreConfig.types.authenticationGeneratorComponent.push({
			type: AuthenticationGeneratorComponentType.VerifiableCredential,
			options: {
				config: {
					verificationMethodId:
						envVars.vcAuthenticationVerificationMethodId ?? VC_AUTHENTICATION_VERIFICATION_METHOD_ID
				}
			},
			features: ["verifiable-credential"]
		});
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
	if (Coerce.boolean(envVars.rightsManagementEnabled) ?? false) {
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
			type: RightsManagementPipComponentType.Service,
			options: {
				informationModulesConfig: Is.arrayValue<IEngineModuleConfig>(
					envVars.rightsManagementInformationSources
				)
					? envVars.rightsManagementInformationSources
					: undefined
			}
		});

		coreConfig.types.rightsManagementPxpComponent ??= [];
		coreConfig.types.rightsManagementPxpComponent.push({
			type: RightsManagementPxpComponentType.Service,
			options: {
				actionModulesConfig: Is.arrayValue<IEngineModuleConfig>(
					envVars.rightsManagementExecutionActions
				)
					? envVars.rightsManagementExecutionActions
					: undefined
			}
		});

		coreConfig.types.rightsManagementPdpComponent ??= [];
		coreConfig.types.rightsManagementPdpComponent.push({
			type: RightsManagementPdpComponentType.Service,
			options: {
				arbiterModulesConfig: Is.arrayValue<IEngineModuleConfig>(envVars.rightsManagementArbiters)
					? envVars.rightsManagementArbiters
					: undefined
			}
		});

		coreConfig.types.rightsManagementPepComponent ??= [];
		coreConfig.types.rightsManagementPepComponent.push({
			type: RightsManagementPepComponentType.Service,
			options: {
				processorModulesConfig: Is.arrayValue<IEngineModuleConfig>(
					envVars.rightsManagementEnforcementProcessors
				)
					? envVars.rightsManagementEnforcementProcessors
					: undefined
			}
		});

		coreConfig.types.rightsManagementPnpComponent ??= [];
		coreConfig.types.rightsManagementPnpComponent.push({
			type: RightsManagementPnpComponentType.Service,
			options: {
				negotiatorModulesConfig: Is.arrayValue<IEngineModuleConfig>(
					envVars.rightsManagementNegotiators
				)
					? envVars.rightsManagementNegotiators
					: undefined,
				requesterModulesConfig: Is.arrayValue<IEngineModuleConfig>(
					envVars.rightsManagementRequesters
				)
					? envVars.rightsManagementRequesters
					: undefined,
				config: {
					baseCallbackUrl: envVars.rightsManagementBaseCallbackUrl ?? "",
					offers: Is.arrayValue<IOdrlOffer>(envVars.rightsManagementOffers)
						? envVars.rightsManagementOffers
						: [],
					negotiationComponentCreator: async url =>
						new PolicyNegotiationPointClient({ endpoint: url })
				}
			}
		});

		coreConfig.types.rightsManagementPnapComponent ??= [];
		coreConfig.types.rightsManagementPnapComponent.push({
			type: RightsManagementPnapComponentType.Service
		});

		coreConfig.types.rightsManagementDapComponent ??= [];
		coreConfig.types.rightsManagementDapComponent.push({
			type: RightsManagementDapComponentType.Service
		});

		coreConfig.types.rightsManagementDarpComponent ??= [];
		coreConfig.types.rightsManagementDarpComponent.push({
			type: RightsManagementDarpComponentType.Service,
			options: {
				config: {
					dataAccessComponentCreator: async url => new DataAccessPointClient({ endpoint: url })
				}
			}
		});
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
	if (Coerce.boolean(envVars.taskSchedulerEnabled) ?? false) {
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
					blobStorageEncryptionKeyId:
						envVars.synchronisedStorageBlobStorageEncryptionKeyId ??
						SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID,
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
	if (Coerce.boolean(envVars.federatedCatalogueEnabled) ?? false) {
		coreConfig.types.federatedCatalogueComponent ??= [];
		coreConfig.types.federatedCatalogueComponent.push({
			type: FederatedCatalogueComponentType.Service,
			options: {
				config: {
					subResourceCacheTtlMs: Coerce.number(envVars.federatedCatalogueCacheTtlMs),
					clearingHouseApproverList:
						Coerce.object<string[]>(envVars.federatedCatalogueClearingHouseApproverList) ?? []
				}
			}
		});
	}
}

/**
 * Configures the data space connector.
 * @param coreConfig The core config.
 * @param envVars The environment variables.
 */
async function configureDataSpaceConnector(
	coreConfig: IEngineConfig,
	envVars: IEngineEnvironmentVariables
): Promise<void> {
	if (Coerce.boolean(envVars.dataSpaceConnectorEnabled) ?? false) {
		coreConfig.types.dataSpaceConnectorComponent ??= [];
		coreConfig.types.dataSpaceConnectorComponent.push({
			type: DataSpaceConnectorComponentType.Service,
			options: {
				config: {
					retainActivityLogsFor: Coerce.number(envVars.dataSpaceConnectorRetainActivityLogsFor),
					activityLogsCleanUpInterval: Coerce.number(
						envVars.dataSpaceConnectorActivityLogsCleanUpInterval
					)
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
