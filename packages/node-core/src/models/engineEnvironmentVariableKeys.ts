// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineEnvironmentVariables } from "./IEngineEnvironmentVariables.js";

// Mapped type exhaustiveness check: TypeScript requires every key of
// Required<IEngineEnvironmentVariables> to appear here with value `true`.
// Removing a key → compile error ("Property X is missing").
// Adding an invented key → compile error ("Object literal may only specify known properties").
const engineEnvironmentVariableKeysInternal: {
	[K in keyof Required<IEngineEnvironmentVariables>]: true;
} = {
	// global
	debug: true,
	silent: true,
	strictEnv: true,
	envAllowList: true,
	storageFileRoot: true,
	stateFilename: true,
	tenantEnabled: true,
	schemaMigrationEnabled: true,
	extensions: true,
	// entity storage
	entityStorageConnectorType: true,
	entityStorageConnectorDefault: true,
	entityStorageTablePrefix: true,
	entityStorageMemoryMutexTimeout: true,
	entityStorageFileMutexTimeout: true,
	// AWS DynamoDB
	awsDynamodbAuthMode: true,
	awsDynamodbAccessKeyId: true,
	awsDynamodbSecretAccessKey: true,
	awsDynamodbRegion: true,
	awsDynamodbEndpoint: true,
	awsDynamodbConnectionTimeout: true,
	// Azure Cosmos DB
	azureCosmosdbKey: true,
	azureCosmosdbContainerId: true,
	azureCosmosdbDatabaseId: true,
	azureCosmosdbEndpoint: true,
	// GCP Firestore
	gcpFirestoreCollectionName: true,
	gcpFirestoreCredentials: true,
	gcpFirestoreDatabaseId: true,
	gcpFirestoreEndpoint: true,
	gcpFirestoreProjectId: true,
	// ScyllaDB
	scylladbHosts: true,
	scylladbKeyspace: true,
	scylladbLocalDataCenter: true,
	scylladbPort: true,
	// MySQL
	mySqlHost: true,
	mySqlPort: true,
	mySqlUser: true,
	mySqlPassword: true,
	mySqlDatabase: true,
	// MongoDB
	mongoDbHost: true,
	mongoDbPort: true,
	mongoDbUser: true,
	mongoDbPassword: true,
	mongoDbDatabase: true,
	// PostgreSQL
	postgreSqlHost: true,
	postgreSqlPort: true,
	postgreSqlUser: true,
	postgreSqlPassword: true,
	postgreSqlDatabase: true,
	// IPFS
	ipfsBearerToken: true,
	ipfsApiUrl: true,
	// blob storage
	blobStorageConnectorType: true,
	blobStorageConnectorDefault: true,
	blobStorageEnableEncryption: true,
	blobStorageEncryptionKeyId: true,
	blobStoragePrefix: true,
	// AWS S3
	awsS3Region: true,
	awsS3BucketName: true,
	awsS3AuthMode: true,
	awsS3AccessKeyId: true,
	awsS3SecretAccessKey: true,
	awsS3Endpoint: true,
	// Azure Storage
	azureStorageAccountKey: true,
	azureStorageAccountName: true,
	azureStorageContainerName: true,
	azureStorageEndpoint: true,
	// GCP Storage
	gcpStorageBucketName: true,
	gcpStorageCredentials: true,
	gcpStorageEndpoint: true,
	gcpStorageProjectId: true,
	// vault
	vaultConnector: true,
	vaultPrefix: true,
	hashicorpVaultToken: true,
	hashicorpVaultEndpoint: true,
	// logging
	loggingConnector: true,
	loggingBatchSize: true,
	loggingBatchFlushInterval: true,
	loggingRetainForMs: true,
	loggingMaxEntries: true,
	loggingRetentionIntervalMs: true,
	loggingRetentionBatchSize: true,
	loggingSilentComponents: true,
	loggingFileDirectory: true,
	loggingFileFilename: true,
	loggingFileMaxFileSizeBytes: true,
	loggingFileMaxRetainedFiles: true,
	loggingMutexTimeout: true,
	// open telemetry logging
	openTelemetryLoggingLoggerName: true,
	openTelemetryLoggingLoggerVersion: true,
	openTelemetryLoggingPrometheusEndpoint: true,
	openTelemetryLoggingProcessor: true,
	// event bus
	eventBusConnector: true,
	eventBusComponent: true,
	// messaging
	messagingEnabled: true,
	messagingEmailConnector: true,
	messagingSmsConnector: true,
	messagingPushNotificationConnector: true,
	// AWS SES
	awsSesRegion: true,
	awsSesAuthMode: true,
	awsSesSecretAccessKey: true,
	awsSesAccessKeyId: true,
	awsSesEndpoint: true,
	awsMessagingPushNotificationApplications: true,
	// telemetry
	telemetryConnector: true,
	openTelemetryMeterName: true,
	openTelemetryMeterVersion: true,
	openTelemetryReader: true,
	openTelemetryPrometheusPort: true,
	telemetryMetricsCollectorInterval: true,
	telemetryMetricsProducers: true,
	telemetryMetricsProducerMaxHistory: true,
	// DLT / identity
	faucetConnector: true,
	walletConnector: true,
	nftConnector: true,
	nftPackageId: true,
	notarizationConnector: true,
	identityConnector: true,
	identityWalletAddressIndex: true,
	identityDidResolutionCacheTtlMs: true,
	identityResolverConnector: true,
	identityProfileConnector: true,
	universalResolverEndpoint: true,
	// IOTA
	iotaFaucetEndpoint: true,
	iotaNodeEndpoint: true,
	iotaNetwork: true,
	iotaCoinType: true,
	iotaGasBudget: true,
	iotaGasReservationDuration: true,
	iotaExplorerEndpoint: true,
	iotaGasStationEndpoint: true,
	iotaGasStationAuthToken: true,
	iotaIdentityPackageId: true,
	// attestation / proofs
	immutableProofVerificationMethodId: true,
	attestationConnector: true,
	attestationVerificationMethodId: true,
	// data processing
	dataProcessingEnabled: true,
	dataConverterConnectors: true,
	dataExtractorConnectors: true,
	taskSchedulerEnabled: true,
	// auditable items / documents
	auditableItemGraphEnabled: true,
	auditableItemGraphMutexTimeout: true,
	auditableItemStreamEnabled: true,
	auditableItemStreamMutexTimeout: true,
	documentManagementEnabled: true,
	documentManagementMutexTimeout: true,
	// federated catalogue
	federatedCatalogueEnabled: true,
	federatedCatalogueFilters: true,
	federatedCatalogueRemoteEndpoint: true,
	federatedCatalogueRestClientPathPrefix: true,
	federatedCatalogueMutexTimeout: true,
	// trust
	trustGenerators: true,
	trustVerifiers: true,
	trustVerificationMethodId: true,
	trustJwtTtl: true,
	trustIdentitiesAllow: true,
	trustIdentitiesDeny: true,
	// rights management
	rightsManagementCallbackPath: true,
	rightsManagementPolicyInformationSources: true,
	rightsManagementPolicyNegotiators: true,
	rightsManagementPolicyRequesters: true,
	rightsManagementPolicyExecutionActions: true,
	rightsManagementPolicyEnforcementProcessors: true,
	rightsManagementPolicyArbiters: true,
	rightsManagementPolicyObligationEnforcers: true,
	rightsManagementMutexTimeout: true,
	// dataspace
	dataspaceEnabled: true,
	dataspaceRetainActivityLogsFor: true,
	dataspaceActivityLogsCleanupInterval: true,
	dataspaceDataPlanePath: true,
	dataspaceAutoStartTransfers: true,
	dataspaceStalledNegotiationTimeout: true,
	dataspaceStalledTransferTimeout: true,
	dataspaceCallbackPath: true,
	// health
	healthEnabled: true,
	healthInterval: true,
	healthStartupInterval: true,
	// automation / mutex
	automationActionTypes: true,
	mutexTimeoutMsDefault: true
};

/**
 * The set of camelCase property names that are valid IEngineEnvironmentVariables keys.
 */
export const ENGINE_ENVIRONMENT_VARIABLE_KEYS: ReadonlySet<string> = new Set(
	Object.keys(engineEnvironmentVariableKeysInternal)
);
