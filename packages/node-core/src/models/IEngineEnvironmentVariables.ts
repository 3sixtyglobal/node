// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The engine core environment variables.
 */
export interface IEngineEnvironmentVariables {
	/**
	 * Start the engine in debug mode.
	 */
	debug?: string;

	/**
	 * Start the engine in silent mode.
	 */
	silent?: string;

	/**
	 * Controls how unrecognised TWIN_* environment variables are handled at startup.
	 * "error" (default): throws a startup error, allowing CI and production deployments
	 * to hard-fail on misconfigured or misspelled variable names.
	 * "warn": logs a warning and continues.
	 * "ignore": skips validation entirely.
	 * Any other value is rejected at startup.
	 * @default "error"
	 */
	strictEnv?: string;

	/**
	 * Comma-separated list of raw environment variable names to exempt from the unknown-key check.
	 * Use this to allowlist variables introduced by custom extensions that are not part of the
	 * core interface, e.g. TWIN_MY_EXTENSION_SECRET.
	 */
	envAllowList?: string;

	/**
	 * The root directory for storing items like state file.
	 */
	storageFileRoot?: string;

	/**
	 * The name of the state file.
	 */
	stateFilename?: string;

	/**
	 * Is multi-tenant support enabled, defaults to false.
	 */
	tenantEnabled?: string;

	/**
	 * Enable schema migration, defaults to true.
	 */
	schemaMigrationEnabled?: string;

	/**
	 * The type of the entity storage to create, comma separate for more than one connector.
	 * values: file, memory, aws-dynamodb, azure-cosmosdb, gcp-firestoredb, scylladb, mysql, mongodb, postgresql
	 */
	entityStorageConnectorType?: string;

	/**
	 * The default entity storage connector to use, defaults to the first one in the list.
	 */
	entityStorageConnectorDefault?: string;

	/**
	 * A prefix for all the table in entity-storage, can be empty.
	 */
	entityStorageTablePrefix?: string;

	/**
	 * AWS DynamoDB auth mode, either credentials or pod.
	 */
	awsDynamodbAuthMode?: string;

	/**
	 * AWS Dynamo DB access key id.
	 */
	awsDynamodbAccessKeyId?: string;

	/**
	 * AWS Dynamo DB Endpoint if running local instance.
	 */
	awsDynamodbEndpoint?: string;

	/**
	 * AWS Dynamo DB region.
	 */
	awsDynamodbRegion?: string;

	/**
	 * AWS Dynamo DB secret access key.
	 */
	awsDynamodbSecretAccessKey?: string;

	/**
	 * AWS Dynamo DB connection timeout in milliseconds.
	 */
	awsDynamodbConnectionTimeout?: string;

	/**
	 * Azure Cosmos DB key.
	 */
	azureCosmosdbKey?: string;

	/**
	 * Azure Cosmos DB container id.
	 */
	azureCosmosdbContainerId?: string;

	/**
	 * Azure Cosmos DB database id.
	 */
	azureCosmosdbDatabaseId?: string;

	/**
	 * Azure Cosmos DB endpoint.
	 */
	azureCosmosdbEndpoint?: string;

	/**
	 * GCP Firestore collection name.
	 */
	gcpFirestoreCollectionName?: string;

	/**
	 * GCP Firestore credentials.
	 */
	gcpFirestoreCredentials?: string;

	/**
	 * GCP Firestore database id.
	 */
	gcpFirestoreDatabaseId?: string;

	/**
	 * GCP Firestore endpoint.
	 */
	gcpFirestoreEndpoint?: string;

	/**
	 * GCP Firestore project id.
	 */
	gcpFirestoreProjectId?: string;

	/**
	 * ScyllaDB hosts as comma separated string.
	 */
	scylladbHosts?: string;

	/**
	 * ScyllaDB keyspace.
	 */
	scylladbKeyspace?: string;

	/**
	 * ScyllaDB local data center.
	 */
	scylladbLocalDataCenter?: string;

	/**
	 * ScyllaDB port.
	 */
	scylladbPort?: string;

	/**
	 * MySQL host.
	 */
	mySqlHost?: string;

	/**
	 * MySQL port.
	 */
	mySqlPort?: string;

	/**
	 * MySQL username.
	 */
	mySqlUser?: string;

	/**
	 * MySQL password.
	 */
	mySqlPassword?: string;

	/**
	 * MySQL Database.
	 */
	mySqlDatabase?: string;

	/**
	 * MongoDB host.
	 */
	mongoDbHost?: string;

	/**
	 * MongoDB port.
	 */
	mongoDbPort?: string;

	/**
	 * MongoDB username.
	 */
	mongoDbUser?: string;

	/**
	 * MongoDB password.
	 */
	mongoDbPassword?: string;

	/**
	 * MongoDB Database.
	 */
	mongoDbDatabase?: string;

	/**
	 * PostgreSQl host.
	 */
	postgreSqlHost?: string;

	/**
	 * PostgreSQl port.
	 */
	postgreSqlPort?: string;

	/**
	 * PostgreSQl username.
	 */
	postgreSqlUser?: string;

	/**
	 * PostgreSQl password.
	 */
	postgreSqlPassword?: string;

	/**
	 * PostgreSQl Database.
	 */
	postgreSqlDatabase?: string;

	/**
	 * The security token for accessing IPFS API.
	 */
	ipfsBearerToken?: string;

	/**
	 * The url for accessing IPFS API.
	 */
	ipfsApiUrl?: string;

	/**
	 * The type of the entity storage to create, comma separate for more than one connector.
	 * values: memory, file, ipfs, aws-s3, azure-storage, gcp-storage.
	 */
	blobStorageConnectorType?: string;

	/**
	 * The default blob storage connector to use, defaults to the first one in the list.
	 */
	blobStorageConnectorDefault?: string;

	/**
	 * Enable encryption for the blob storage.
	 */
	blobStorageEnableEncryption?: string;

	/**
	 * The id of the encryption key for the blob storage.
	 */
	blobStorageEncryptionKeyId?: string;

	/**
	 * A prefix for all the blobs in blob-storage, can be empty.
	 */
	blobStoragePrefix?: string;

	/**
	 * AWS S3 region.
	 */
	awsS3Region?: string;

	/**
	 * AWS S3 bucket name.
	 */
	awsS3BucketName?: string;

	/**
	 * AWS S3 auth mode, either credentials or pod, defaults to credentials.
	 */
	awsS3AuthMode?: string;

	/**
	 * AWS S3 access key id.
	 */
	awsS3AccessKeyId?: string;

	/**
	 * AWS S3 secret access key.
	 */
	awsS3SecretAccessKey?: string;

	/**
	 * AWS S3 endpoint.
	 */
	awsS3Endpoint?: string;

	/**
	 * Azure Storage account key.
	 */
	azureStorageAccountKey?: string;

	/**
	 * Azure Storage account name.
	 */
	azureStorageAccountName?: string;

	/**
	 * Azure Storage container.
	 */
	azureStorageContainerName?: string;

	/**
	 * Azure Storage endpoint.
	 */
	azureStorageEndpoint?: string;

	/**
	 * GCP Storage bucket.
	 */
	gcpStorageBucketName?: string;

	/**
	 * GCP Storage credentials.
	 */
	gcpStorageCredentials?: string;

	/**
	 * GCP Storage endpoint.
	 */
	gcpStorageEndpoint?: string;

	/**
	 * GCP Storage project id.
	 */
	gcpStorageProjectId?: string;

	/**
	 * The type of the default vault connector: entity-storage, hashicorp.
	 */
	vaultConnector?: string;

	/**
	 * Prefix to prepend to entries in the vault.
	 */
	vaultPrefix?: string;

	/**
	 * Hashicorp Vault token.
	 */
	hashicorpVaultToken?: string;

	/**
	 * Hashicorp Vault endpoint.
	 */
	hashicorpVaultEndpoint?: string;

	/**
	 * The type of logging task connector, can be a comma separated list: console, entity-storage, open-telemetry, file.
	 */
	loggingConnector?: string;

	/**
	 * The batch size for the logging task, set to 1 for no batching.
	 */
	loggingBatchSize?: string;

	/**
	 * The batch flush interval in seconds for the logging task, how often to flush the logs when using batching, defaults to 5 seconds.
	 */
	loggingBatchFlushInterval?: string;

	/**
	 * Delete log entries older than this many minutes for the entity-storage logging connector.
	 * Set to 0 to disable age-based retention.
	 * @default 2880 (2 days)
	 */
	loggingRetainFor?: string;

	/**
	 * Keep at most this many log entries for the entity-storage logging connector.
	 * Set to 0 to disable count-based retention.
	 * @default 10000
	 */
	loggingMaxEntries?: string;

	/**
	 * How often the retention cleanup task runs in minutes for the entity-storage logging connector.
	 * Set to 0 to disable periodic cleanup.
	 * @default 5
	 */
	loggingRetentionInterval?: string;

	/**
	 * Maximum number of entries deleted per cleanup batch for the entity-storage logging connector.
	 * Keeping this value smaller helps avoid spikes in database load.
	 * @default 1000
	 */
	loggingRetentionBatchSize?: string;

	/**
	 * A list of components to exclude from logging, can be a comma separated list of component Class names e.g. "ComponentA,ComponentB".
	 */
	loggingSilentComponents?: string;

	/**
	 * The directory to write log files into when using the file logging connector. Required when TWIN_LOGGING_CONNECTOR includes "file".
	 */
	loggingFileDirectory?: string;

	/**
	 * The log filename when using the file logging connector, defaults to "app.log".
	 */
	loggingFileFilename?: string;

	/**
	 * The maximum log file size in bytes before rotation when using the file logging connector, defaults to 10485760 (10 MB). Set to 0 or negative to disable rotation.
	 */
	loggingFileMaxFileSizeBytes?: string;

	/**
	 * The number of rotated log files to retain when using the file logging connector, defaults to 5. Set to 0 or negative to keep all rotated files.
	 */
	loggingFileMaxRetainedFiles?: string;

	/**
	 * The name of the OpenTelemetry logger, only required if using open-telemetry as logging connector, defaults to twin-logging.
	 */
	openTelemetryLoggingLoggerName?: string;

	/**
	 * The version of the OpenTelemetry logger, only required if using open-telemetry as logging connector, defaults to 1.0.0.
	 */
	openTelemetryLoggingLoggerVersion?: string;

	/**
	 * The OTLP endpoint URL for the OpenTelemetry logging exporter, required when using open-telemetry as logging connector, e.g. http://localhost:4318/v1/logs.
	 */
	openTelemetryLoggingPrometheusEndpoint?: string;

	/**
	 * The log record processor to use for the OpenTelemetry logging exporter, either batch or simple, defaults to batch.
	 */
	openTelemetryLoggingProcessor?: string;

	/**
	 * The type of event bus connector: local.
	 */
	eventBusConnector?: string;

	/**
	 * The type of event bus component: service.
	 */
	eventBusComponent?: string;

	/**
	 * Are the messaging components enabled, defaults to false.
	 */
	messagingEnabled?: string;

	/**
	 * AWS SES region.
	 */
	awsSesRegion?: string;

	/**
	 * AWS SES auth mode, either credentials or pod, defaults to credentials.
	 */
	awsSesAuthMode?: string;

	/**
	 * AWS SES secret access key.
	 */
	awsSesSecretAccessKey?: string;

	/**
	 * AWS SES access key id.
	 */
	awsSesAccessKeyId?: string;

	/**
	 * AWS SES endpoint.
	 */
	awsSesEndpoint?: string;

	/**
	 * The applications for the push notifications reference a separate json with @json: prefix.
	 */
	awsMessagingPushNotificationApplications?: string;

	/**
	 * The type of messaging email connector: entity-storage, aws.
	 */
	messagingEmailConnector?: string;

	/**
	 * The type of messaging sms connector: entity-storage, aws.
	 */
	messagingSmsConnector?: string;

	/**
	 * The type of messaging push notification connector: entity-storage, aws.
	 */
	messagingPushNotificationConnector?: string;

	/**
	 * The type of telemetry connector: entity-storage.
	 */
	telemetryConnector?: string;

	/**
	 * The name of the Open Telemetry meter to use, only required if using open-telemetry as telemetry connector, defaults to twin-node.
	 */
	openTelemetryMeterName?: string;

	/**
	 * The version of the Open Telemetry metrics specification to use, only required if using open-telemetry as telemetry connector, defaults to 1.0.0.
	 */
	openTelemetryMeterVersion?: string;

	/**
	 * The type of Open Telemetry metric reader to use, only required if using open-telemetry as telemetry connector, values: prometheus.
	 */
	openTelemetryReader?: string;

	/**
	 * The port to use for the Open Telemetry Prometheus metrics server, only required if using open-telemetry as telemetry connector and prometheus as reader, defaults to 9464.
	 */
	openTelemetryPrometheusPort?: string;

	/**
	 * Polling interval in seconds for the telemetry metrics collector. Defaults to 60.
	 */
	telemetryMetricsCollectorInterval?: string;

	/**
	 * The type of telemetry metrics producers, can be a comma separated list: system, process.
	 */
	telemetryMetricsProducers?: string;

	/**
	 * Maximum number of values retained per telemetry metric (count-based history cap). Defaults to 1440.
	 */
	telemetryMetricsProducerMaxHistory?: string;

	/**
	 * The mutex timeout in milliseconds for the telemetry connector.
	 */
	telemetryMutexTimeout?: string;

	/**
	 * The type of tracing connector: entity-storage, open-telemetry.
	 */
	tracingConnector?: string;

	/**
	 * The name of the Open Telemetry tracer to use, only required if using open-telemetry as tracing connector, defaults to twin-node.
	 */
	openTelemetryTracingTracerName?: string;

	/**
	 * The version of the Open Telemetry tracing specification to use, only required if using open-telemetry as tracing connector, defaults to 1.0.0.
	 */
	openTelemetryTracingTracerVersion?: string;

	/**
	 * The OTLP HTTP endpoint to push spans to, e.g. http://localhost:4318/v1/traces. Required when using open-telemetry as tracing connector.
	 */
	openTelemetryTracingEndpoint?: string;

	/**
	 * The span processor: batch (default) or simple. Only used when TWIN_TRACING_CONNECTOR=open-telemetry.
	 */
	openTelemetryTracingProcessor?: string;

	/**
	 * The mutex timeout in milliseconds for the tracing connector.
	 */
	tracingMutexTimeout?: string;

	/**
	 * The type of faucet connector: entity-storage, iota.
	 */
	faucetConnector?: string;

	/**
	 * The type of wallet connector: entity-storage, iota.
	 */
	walletConnector?: string;

	/**
	 * The type of NFT connector: entity-storage, iota.
	 */
	nftConnector?: string;

	/**
	 * The NFT deployed package id, for custom deployments.
	 */
	nftPackageId?: string;

	/**
	 * The type of notarization connector: entity-storage, iota.
	 */
	notarizationConnector?: string;

	/**
	 * The type of identity connector: entity-storage, iota.
	 */
	identityConnector?: string;

	/**
	 * The index of the wallet address to use, defaults to 0.
	 */
	identityWalletAddressIndex?: string;

	/**
	 * The TTL in milliseconds for caching resolved DIDs when using the IOTA identity connector. Omit to use the connector default.
	 */
	identityDidResolutionCacheTtlMs?: string;

	/**
	 * The type of identity resolver connector: entity-storage, iota.
	 */
	identityResolverConnector?: string;

	/**
	 * IOTA Faucet Endpoint.
	 */
	iotaFaucetEndpoint?: string;

	/**
	 * IOTA Node Endpoint.
	 */
	iotaNodeEndpoint?: string;

	/**
	 * IOTA network.
	 */
	iotaNetwork?: string;

	/**
	 * IOTA coin type.
	 */
	iotaCoinType?: string;

	/**
	 * IOTA gas budget, in nanos.
	 */
	iotaGasBudget?: string;

	/**
	 * IOTA gas reservation duration, in seconds.
	 */
	iotaGasReservationDuration?: string;

	/**
	 * IOTA Explorer Endpoint.
	 */
	iotaExplorerEndpoint?: string;

	/**
	 * IOTA Gas Station Endpoint.
	 */
	iotaGasStationEndpoint?: string;

	/**
	 * IOTA Gas Station Authentication Token.
	 */
	iotaGasStationAuthToken?: string;

	/**
	 * The IOTA Identity deployed package id, for custom deployments.
	 */
	iotaIdentityPackageId?: string;

	/**
	 * Universal Resolver Endpoint.
	 */
	universalResolverEndpoint?: string;

	/**
	 * The type of identity profile connector: entity-storage.
	 */
	identityProfileConnector?: string;

	/**
	 * The identity verification method id to use with immutable proofs.
	 */
	immutableProofVerificationMethodId?: string;

	/**
	 * The number of times to retry a proof task when it fails, 0 to disable retries.
	 * @default 5
	 */
	immutableProofTaskRetryCount?: string;

	/**
	 * The interval in seconds to wait between proof task retries.
	 * @default 5
	 */
	immutableProofTaskRetryInterval?: string;

	/**
	 * The time in minutes to retain the record of a failed proof task.
	 * Set to -1 to retain failures forever.
	 * @default 10080
	 */
	immutableProofTaskFailureRetainFor?: string;

	/**
	 * How often in minutes the immutable proof reconciliation sweep runs.
	 * @default 30
	 */
	immutableProofSweepInterval?: string;

	/**
	 * The minimum age in minutes before a proof with no notarization is considered stuck.
	 * @default 180
	 */
	immutableProofSweepStaleThreshold?: string;

	/**
	 * The number of sweep attempts made before a proof is parked.
	 * @default 5
	 */
	immutableProofSweepMaxAttempts?: string;

	/**
	 * The maximum number of proofs to re-enqueue per tenant per sweep cycle.
	 * @default 10
	 */
	immutableProofSweepBatchLimit?: string;

	/**
	 * The minimum time in minutes between sweep attempts for the same proof.
	 * @default 60
	 */
	immutableProofSweepBackoff?: string;

	/**
	 * ISO 8601 date-time used to treat older missing-task proofs as retryable.
	 */
	immutableProofSweepAssumeRetryableBefore?: string;

	/**
	 * The type of attestation connector: entity-storage, iota.
	 */
	attestationConnector?: string;

	/**
	 * The identity verification method id to use with attestation.
	 */
	attestationVerificationMethodId?: string;

	/**
	 * Is the data processing enabled, defaults to false.
	 */
	dataProcessingEnabled?: string;

	/**
	 * The type of the default data converters, can be a comma separated list: json, xml.
	 */
	dataConverterConnectors?: string;

	/**
	 * The type of the default data extractor, can be a comma separated list: json-path.
	 */
	dataExtractorConnectors?: string;

	/**
	 * Enable the task scheduler regardless of which other components are active, defaults to false.
	 */
	taskSchedulerEnabled?: string;

	/**
	 * Is the auditable item graph enabled, defaults to false.
	 */
	auditableItemGraphEnabled?: string;

	/**
	 * Is the auditable item stream enabled, defaults to false.
	 */
	auditableItemStreamEnabled?: string;

	/**
	 * Is the document management enabled, defaults to false.
	 */
	documentManagementEnabled?: string;

	/**
	 * Enable the federated catalogue, defaults to false, automatically enabled if remote endpoint, filters or dataspace is enabled.
	 */
	federatedCatalogueEnabled?: string;

	/**
	 * Federated catalog filters, command separated list of filters to add.
	 */
	federatedCatalogueFilters?: string;

	/**
	 * Federated catalog remote endpoint, if set will use a REST client instead of local service.
	 */
	federatedCatalogueRemoteEndpoint?: string;

	/**
	 * The path prefix used by the federated catalogue REST client when forwarding requests to the remote endpoint, defaults to "federated-catalogue".
	 */
	federatedCatalogueRestClientPathPrefix?: string;

	/**
	 * The trust generators to add to the factory, comma separated list.
	 */
	trustGenerators?: string;

	/**
	 * The trust verifiers to add to the factory, comma separated list.
	 */
	trustVerifiers?: string;

	/**
	 * The verification method to use for trust identities.
	 * Defaults to trust-assertion.
	 */
	trustVerificationMethodId?: string;

	/**
	 * The trust time to live for generating JWTs in seconds.
	 * Defaults to undefined for never expiring.
	 */
	trustJwtTtl?: string;

	/**
	 * The allow lists for the trust identity verifier, comma separated list of identities.
	 */
	trustIdentitiesAllow?: string;

	/**
	 * The deny lists for the trust identity verifier, comma separated list of identities.
	 */
	trustIdentitiesDeny?: string;

	/**
	 * Path under which the rights management service is mounted (single source
	 * of truth). The same value drives:
	 * - the server route mount (via engine config)
	 * - the PNP service's callback URL builder (`buildCallbackUrl`)
	 * - the PNP rest-client's pathPrefix (consumer side)
	 * Defaults to `rights-management`. Set when deploying behind a reverse proxy
	 * with path rewriting, K8s ingress with path-based routing, or any custom
	 * mount point.
	 */
	rightsManagementCallbackPath?: string;

	/**
	 * The rights management policy information sources to add to the factory.
	 */
	rightsManagementPolicyInformationSources?: string;

	/**
	 * The rights management policy negotiators sources to add to the factory.
	 */
	rightsManagementPolicyNegotiators?: string;

	/**
	 * The rights management policy requesters to add to the factory.
	 */
	rightsManagementPolicyRequesters?: string;

	/**
	 * The rights management policy execution actions to add to the factory.
	 */
	rightsManagementPolicyExecutionActions?: string;

	/**
	 * The rights management policy enforcement processors to add to the factory.
	 */
	rightsManagementPolicyEnforcementProcessors?: string;

	/**
	 * The rights management policy arbiters to add to the factory.
	 */
	rightsManagementPolicyArbiters?: string;

	/**
	 * The rights management policy obligation enforcers to add to the factory.
	 */
	rightsManagementPolicyObligationEnforcers?: string;

	/**
	 * Is the dataspace enabled, defaults to false.
	 */
	dataspaceEnabled?: string;

	/**
	 * The length of time to retain the activity logs for in seconds, set to -1 to keep forever.
	 * @default 600
	 */
	dataspaceRetainActivityLogsFor?: string;

	/**
	 * The interval in seconds for cleaning up the activity logs.
	 * @default 3600
	 */
	dataspaceActivityLogsCleanupInterval?: string;

	/**
	 * Base route path for the data plane service (path only, not full URL).
	 * Combined with the public origin to form the `dataAddress.endpoint` sent to PULL consumers
	 * and the inbox URL sent to PUSH providers.
	 *
	 * This must be the mount-point prefix of the data plane routes, NOT a specific route path.
	 * Do NOT append sub-paths such as `/entities` or `/inbox` - those are appended automatically
	 * by each transfer handler and by the data plane REST client.
	 *
	 * REQUIRED if PULL or PUSH transfers are supported.
	 * If not specified, PULL and PUSH transfers will not be available.
	 *
	 * Example: "dataspace"
	 */
	dataspaceDataPlanePath?: string;

	/**
	 * Whether the provider immediately starts a transfer once it has been requested.
	 * When false the transfer stays in REQUESTED until the provider explicitly calls transferStarted.
	 * @default false
	 */
	dataspaceAutoStartTransfers?: string;

	/**
	 * How long in seconds a negotiation may sit without progress before it is treated as timed out.
	 * @default 30
	 */
	dataspaceStalledNegotiationTimeout?: string;

	/**
	 * How long in seconds a consumer-initiated transfer may sit in REQUESTED without the provider
	 * progressing it before it is treated as timed out.
	 * @default 30
	 */
	dataspaceStalledTransferTimeout?: string;

	/**
	 * How long in seconds a provider transfer may stay idle before the idle policy marks it as stalled.
	 */
	dataspaceProviderTransferIdleTimeout?: string;

	/**
	 * How frequently in seconds the provider idle transfer policy sweep runs.
	 */
	dataspaceProviderTransferPolicySweepInterval?: string;

	/**
	 * Path under which the dataspace control plane is mounted (path only, not full URL).
	 * This must match the control-plane REST mount, as it is combined with the public
	 * origin to build the consumer's advertised callback address.
	 * @default "dataspace-control-plane"
	 */
	dataspaceCallbackPath?: string;

	/**
	 * Are the health components enabled, defaults to false.
	 */
	healthEnabled?: string;

	/**
	 * The interval in seconds for performing health checks, defaults to 60.
	 */
	healthInterval?: string;

	/**
	 * The interval in seconds for performing health checks at startup, defaults to 2.
	 * This allows components that take a long time to initialize to be healthy before the first health check is performed.
	 */
	healthStartupInterval?: string;

	/**
	 * The interval in seconds for running the application health lifecycle (init, application, teardown), defaults to 300.
	 */
	healthApplicationInterval?: string;

	/**
	 * The type of the automation action to create, comma separate for more than one connector.
	 * values: fetch
	 */
	automationActionTypes?: string;

	/**
	 * The default mutex timeout in milliseconds, used when no component-specific timeout is set, defaults to 5000 if omitted.
	 */
	mutexTimeoutMsDefault?: string;

	/**
	 * The mutex timeout in milliseconds for the auditable item graph component.
	 */
	auditableItemGraphMutexTimeout?: string;

	/**
	 * The mutex timeout in milliseconds for the auditable item stream component.
	 */
	auditableItemStreamMutexTimeout?: string;

	/**
	 * The mutex timeout in milliseconds for the federated catalogue component.
	 */
	federatedCatalogueMutexTimeout?: string;

	/**
	 * The mutex timeout in milliseconds for the document management component.
	 */
	documentManagementMutexTimeout?: string;

	/**
	 * The mutex timeout in milliseconds for the logging component.
	 */
	loggingMutexTimeout?: string;

	/**
	 * The mutex timeout in milliseconds for the memory and file entity storage connectors.
	 */
	entityStorageMutexTimeout?: string;

	/**
	 * The mutex timeout in milliseconds for the rights management component.
	 */
	rightsManagementMutexTimeout?: string;

	/**
	 * A comma separated list of additional node extensions to load, the initialiseExtension method will be called for each extension.
	 */
	extensions?: string;
}
