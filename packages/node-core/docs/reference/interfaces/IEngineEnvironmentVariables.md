# Interface: IEngineEnvironmentVariables

The engine core environment variables.

## Properties

### debug? {#debug}

> `optional` **debug?**: `string`

Start the engine in debug mode.

***

### silent? {#silent}

> `optional` **silent?**: `string`

Start the engine in silent mode.

***

### strictEnv? {#strictenv}

> `optional` **strictEnv?**: `string`

Controls how unrecognised TWIN_* environment variables are handled at startup.
"error" (default): throws a startup error, allowing CI and production deployments
to hard-fail on misconfigured or misspelled variable names.
"warn": logs a warning and continues.
"ignore": skips validation entirely.
Any other value is rejected at startup.

#### Default

```ts
"error"
```

***

### envAllowList? {#envallowlist}

> `optional` **envAllowList?**: `string`

Comma-separated list of raw environment variable names to exempt from the unknown-key check.
Use this to allowlist variables introduced by custom extensions that are not part of the
core interface, e.g. TWIN_MY_EXTENSION_SECRET.

***

### storageFileRoot? {#storagefileroot}

> `optional` **storageFileRoot?**: `string`

The root directory for storing items like state file.

***

### stateFilename? {#statefilename}

> `optional` **stateFilename?**: `string`

The name of the state file.

***

### tenantEnabled? {#tenantenabled}

> `optional` **tenantEnabled?**: `string`

Is multi-tenant support enabled, defaults to false.

***

### schemaMigrationEnabled? {#schemamigrationenabled}

> `optional` **schemaMigrationEnabled?**: `string`

Enable schema migration, defaults to true.

***

### entityStorageConnectorType? {#entitystorageconnectortype}

> `optional` **entityStorageConnectorType?**: `string`

The type of the entity storage to create, comma separate for more than one connector.
values: file, memory, aws-dynamodb, azure-cosmosdb, gcp-firestoredb, scylladb, mysql, mongodb, postgresql

***

### entityStorageConnectorDefault? {#entitystorageconnectordefault}

> `optional` **entityStorageConnectorDefault?**: `string`

The default entity storage connector to use, defaults to the first one in the list.

***

### entityStorageTablePrefix? {#entitystoragetableprefix}

> `optional` **entityStorageTablePrefix?**: `string`

A prefix for all the table in entity-storage, can be empty.

***

### awsDynamodbAuthMode? {#awsdynamodbauthmode}

> `optional` **awsDynamodbAuthMode?**: `string`

AWS DynamoDB auth mode, either credentials or pod.

***

### awsDynamodbAccessKeyId? {#awsdynamodbaccesskeyid}

> `optional` **awsDynamodbAccessKeyId?**: `string`

AWS Dynamo DB access key id.

***

### awsDynamodbEndpoint? {#awsdynamodbendpoint}

> `optional` **awsDynamodbEndpoint?**: `string`

AWS Dynamo DB Endpoint if running local instance.

***

### awsDynamodbRegion? {#awsdynamodbregion}

> `optional` **awsDynamodbRegion?**: `string`

AWS Dynamo DB region.

***

### awsDynamodbSecretAccessKey? {#awsdynamodbsecretaccesskey}

> `optional` **awsDynamodbSecretAccessKey?**: `string`

AWS Dynamo DB secret access key.

***

### awsDynamodbConnectionTimeout? {#awsdynamodbconnectiontimeout}

> `optional` **awsDynamodbConnectionTimeout?**: `string`

AWS Dynamo DB connection timeout in milliseconds.

***

### azureCosmosdbKey? {#azurecosmosdbkey}

> `optional` **azureCosmosdbKey?**: `string`

Azure Cosmos DB key.

***

### azureCosmosdbContainerId? {#azurecosmosdbcontainerid}

> `optional` **azureCosmosdbContainerId?**: `string`

Azure Cosmos DB container id.

***

### azureCosmosdbDatabaseId? {#azurecosmosdbdatabaseid}

> `optional` **azureCosmosdbDatabaseId?**: `string`

Azure Cosmos DB database id.

***

### azureCosmosdbEndpoint? {#azurecosmosdbendpoint}

> `optional` **azureCosmosdbEndpoint?**: `string`

Azure Cosmos DB endpoint.

***

### gcpFirestoreCollectionName? {#gcpfirestorecollectionname}

> `optional` **gcpFirestoreCollectionName?**: `string`

GCP Firestore collection name.

***

### gcpFirestoreCredentials? {#gcpfirestorecredentials}

> `optional` **gcpFirestoreCredentials?**: `string`

GCP Firestore credentials.

***

### gcpFirestoreDatabaseId? {#gcpfirestoredatabaseid}

> `optional` **gcpFirestoreDatabaseId?**: `string`

GCP Firestore database id.

***

### gcpFirestoreEndpoint? {#gcpfirestoreendpoint}

> `optional` **gcpFirestoreEndpoint?**: `string`

GCP Firestore endpoint.

***

### gcpFirestoreProjectId? {#gcpfirestoreprojectid}

> `optional` **gcpFirestoreProjectId?**: `string`

GCP Firestore project id.

***

### scylladbHosts? {#scylladbhosts}

> `optional` **scylladbHosts?**: `string`

ScyllaDB hosts as comma separated string.

***

### scylladbKeyspace? {#scylladbkeyspace}

> `optional` **scylladbKeyspace?**: `string`

ScyllaDB keyspace.

***

### scylladbLocalDataCenter? {#scylladblocaldatacenter}

> `optional` **scylladbLocalDataCenter?**: `string`

ScyllaDB local data center.

***

### scylladbPort? {#scylladbport}

> `optional` **scylladbPort?**: `string`

ScyllaDB port.

***

### mySqlHost? {#mysqlhost}

> `optional` **mySqlHost?**: `string`

MySQL host.

***

### mySqlPort? {#mysqlport}

> `optional` **mySqlPort?**: `number`

MySQL port.

***

### mySqlUser? {#mysqluser}

> `optional` **mySqlUser?**: `string`

MySQL username.

***

### mySqlPassword? {#mysqlpassword}

> `optional` **mySqlPassword?**: `string`

MySQL password.

***

### mySqlDatabase? {#mysqldatabase}

> `optional` **mySqlDatabase?**: `string`

MySQL Database.

***

### mongoDbHost? {#mongodbhost}

> `optional` **mongoDbHost?**: `string`

MongoDB host.

***

### mongoDbPort? {#mongodbport}

> `optional` **mongoDbPort?**: `number`

MongoDB port.

***

### mongoDbUser? {#mongodbuser}

> `optional` **mongoDbUser?**: `string`

MongoDB username.

***

### mongoDbPassword? {#mongodbpassword}

> `optional` **mongoDbPassword?**: `string`

MongoDB password.

***

### mongoDbDatabase? {#mongodbdatabase}

> `optional` **mongoDbDatabase?**: `string`

MongoDB Database.

***

### postgreSqlHost? {#postgresqlhost}

> `optional` **postgreSqlHost?**: `string`

PostgreSQl host.

***

### postgreSqlPort? {#postgresqlport}

> `optional` **postgreSqlPort?**: `number`

PostgreSQl port.

***

### postgreSqlUser? {#postgresqluser}

> `optional` **postgreSqlUser?**: `string`

PostgreSQl username.

***

### postgreSqlPassword? {#postgresqlpassword}

> `optional` **postgreSqlPassword?**: `string`

PostgreSQl password.

***

### postgreSqlDatabase? {#postgresqldatabase}

> `optional` **postgreSqlDatabase?**: `string`

PostgreSQl Database.

***

### ipfsBearerToken? {#ipfsbearertoken}

> `optional` **ipfsBearerToken?**: `string`

The security token for accessing IPFS API.

***

### ipfsApiUrl? {#ipfsapiurl}

> `optional` **ipfsApiUrl?**: `string`

The url for accessing IPFS API.

***

### blobStorageConnectorType? {#blobstorageconnectortype}

> `optional` **blobStorageConnectorType?**: `string`

The type of the entity storage to create, comma separate for more than one connector.
values: memory, file, ipfs, aws-s3, azure-storage, gcp-storage.

***

### blobStorageConnectorDefault? {#blobstorageconnectordefault}

> `optional` **blobStorageConnectorDefault?**: `string`

The default blob storage connector to use, defaults to the first one in the list.

***

### blobStorageEnableEncryption? {#blobstorageenableencryption}

> `optional` **blobStorageEnableEncryption?**: `string`

Enable encryption for the blob storage.

***

### blobStorageEncryptionKeyId? {#blobstorageencryptionkeyid}

> `optional` **blobStorageEncryptionKeyId?**: `string`

The id of the encryption key for the blob storage.

***

### blobStoragePrefix? {#blobstorageprefix}

> `optional` **blobStoragePrefix?**: `string`

A prefix for all the blobs in blob-storage, can be empty.

***

### awsS3Region? {#awss3region}

> `optional` **awsS3Region?**: `string`

AWS S3 region.

***

### awsS3BucketName? {#awss3bucketname}

> `optional` **awsS3BucketName?**: `string`

AWS S3 bucket name.

***

### awsS3AuthMode? {#awss3authmode}

> `optional` **awsS3AuthMode?**: `string`

AWS S3 auth mode, either credentials or pod, defaults to credentials.

***

### awsS3AccessKeyId? {#awss3accesskeyid}

> `optional` **awsS3AccessKeyId?**: `string`

AWS S3 access key id.

***

### awsS3SecretAccessKey? {#awss3secretaccesskey}

> `optional` **awsS3SecretAccessKey?**: `string`

AWS S3 secret access key.

***

### awsS3Endpoint? {#awss3endpoint}

> `optional` **awsS3Endpoint?**: `string`

AWS S3 endpoint.

***

### azureStorageAccountKey? {#azurestorageaccountkey}

> `optional` **azureStorageAccountKey?**: `string`

Azure Storage account key.

***

### azureStorageAccountName? {#azurestorageaccountname}

> `optional` **azureStorageAccountName?**: `string`

Azure Storage account name.

***

### azureStorageContainerName? {#azurestoragecontainername}

> `optional` **azureStorageContainerName?**: `string`

Azure Storage container.

***

### azureStorageEndpoint? {#azurestorageendpoint}

> `optional` **azureStorageEndpoint?**: `string`

Azure Storage endpoint.

***

### gcpStorageBucketName? {#gcpstoragebucketname}

> `optional` **gcpStorageBucketName?**: `string`

GCP Storage bucket.

***

### gcpStorageCredentials? {#gcpstoragecredentials}

> `optional` **gcpStorageCredentials?**: `string`

GCP Storage credentials.

***

### gcpStorageEndpoint? {#gcpstorageendpoint}

> `optional` **gcpStorageEndpoint?**: `string`

GCP Storage endpoint.

***

### gcpStorageProjectId? {#gcpstorageprojectid}

> `optional` **gcpStorageProjectId?**: `string`

GCP Storage project id.

***

### vaultConnector? {#vaultconnector}

> `optional` **vaultConnector?**: `string`

The type of the default vault connector: entity-storage, hashicorp.

***

### vaultPrefix? {#vaultprefix}

> `optional` **vaultPrefix?**: `string`

Prefix to prepend to entries in the vault.

***

### hashicorpVaultToken? {#hashicorpvaulttoken}

> `optional` **hashicorpVaultToken?**: `string`

Hashicorp Vault token.

***

### hashicorpVaultEndpoint? {#hashicorpvaultendpoint}

> `optional` **hashicorpVaultEndpoint?**: `string`

Hashicorp Vault endpoint.

***

### loggingConnector? {#loggingconnector}

> `optional` **loggingConnector?**: `string`

The type of logging task connector, can be a comma separated list: console, entity-storage, otel, file.

***

### loggingBatchSize? {#loggingbatchsize}

> `optional` **loggingBatchSize?**: `string`

The batch size for the logging task, set to 1 for no batching.

***

### loggingBatchFlushInterval? {#loggingbatchflushinterval}

> `optional` **loggingBatchFlushInterval?**: `string`

The batch flush interval in seconds for the logging task, how often to flush the logs when using batching, defaults to 5 seconds.

***

### loggingRetainForMs? {#loggingretainforms}

> `optional` **loggingRetainForMs?**: `string`

Delete log entries older than this many milliseconds for the entity-storage logging connector.
Set to 0 to disable age-based retention.

#### Default

```ts
172800000 (2 days)
```

***

### loggingMaxEntries? {#loggingmaxentries}

> `optional` **loggingMaxEntries?**: `string`

Keep at most this many log entries for the entity-storage logging connector.
Set to 0 to disable count-based retention.

#### Default

```ts
10000
```

***

### loggingRetentionIntervalMs? {#loggingretentionintervalms}

> `optional` **loggingRetentionIntervalMs?**: `string`

How often the retention cleanup task runs in milliseconds for the entity-storage logging connector.
Set to 0 to disable periodic cleanup.

#### Default

```ts
300000 (5 minutes)
```

***

### loggingRetentionBatchSize? {#loggingretentionbatchsize}

> `optional` **loggingRetentionBatchSize?**: `string`

Maximum number of entries deleted per cleanup batch for the entity-storage logging connector.
Keeping this value smaller helps avoid spikes in database load.

#### Default

```ts
1000
```

***

### loggingSilentComponents? {#loggingsilentcomponents}

> `optional` **loggingSilentComponents?**: `string`

A list of components to exclude from logging, can be a comma separated list of component Class names e.g. "ComponentA,ComponentB".

***

### loggingFileDirectory? {#loggingfiledirectory}

> `optional` **loggingFileDirectory?**: `string`

The directory to write log files into when using the file logging connector. Required when TWIN_LOGGING_CONNECTOR includes "file".

***

### loggingFileFilename? {#loggingfilefilename}

> `optional` **loggingFileFilename?**: `string`

The log filename when using the file logging connector, defaults to "app.log".

***

### loggingFileMaxFileSizeBytes? {#loggingfilemaxfilesizebytes}

> `optional` **loggingFileMaxFileSizeBytes?**: `string`

The maximum log file size in bytes before rotation when using the file logging connector, defaults to 10485760 (10 MB). Set to 0 or negative to disable rotation.

***

### loggingFileMaxRetainedFiles? {#loggingfilemaxretainedfiles}

> `optional` **loggingFileMaxRetainedFiles?**: `string`

The number of rotated log files to retain when using the file logging connector, defaults to 5. Set to 0 or negative to keep all rotated files.

***

### openTelemetryLoggingLoggerName? {#opentelemetryloggingloggername}

> `optional` **openTelemetryLoggingLoggerName?**: `string`

The name of the OpenTelemetry logger, only required if using open-telemetry as logging connector, defaults to twin-logging.

***

### openTelemetryLoggingLoggerVersion? {#opentelemetryloggingloggerversion}

> `optional` **openTelemetryLoggingLoggerVersion?**: `string`

The version of the OpenTelemetry logger, only required if using open-telemetry as logging connector, defaults to 1.0.0.

***

### openTelemetryLoggingPrometheusEndpoint? {#opentelemetryloggingprometheusendpoint}

> `optional` **openTelemetryLoggingPrometheusEndpoint?**: `string`

The OTLP endpoint URL for the OpenTelemetry logging exporter, required when using open-telemetry as logging connector, e.g. http://localhost:4318/v1/logs.

***

### openTelemetryLoggingProcessor? {#opentelemetryloggingprocessor}

> `optional` **openTelemetryLoggingProcessor?**: `string`

The log record processor to use for the OpenTelemetry logging exporter, either batch or simple, defaults to batch.

***

### eventBusConnector? {#eventbusconnector}

> `optional` **eventBusConnector?**: `string`

The type of event bus connector: local.

***

### eventBusComponent? {#eventbuscomponent}

> `optional` **eventBusComponent?**: `string`

The type of event bus component: service.

***

### messagingEnabled? {#messagingenabled}

> `optional` **messagingEnabled?**: `string`

Are the messaging components enabled, defaults to false.

***

### awsSesRegion? {#awssesregion}

> `optional` **awsSesRegion?**: `string`

AWS SES region.

***

### awsSesAuthMode? {#awssesauthmode}

> `optional` **awsSesAuthMode?**: `string`

AWS SES auth mode, either credentials or pod, defaults to credentials.

***

### awsSesSecretAccessKey? {#awssessecretaccesskey}

> `optional` **awsSesSecretAccessKey?**: `string`

AWS SES secret access key.

***

### awsSesAccessKeyId? {#awssesaccesskeyid}

> `optional` **awsSesAccessKeyId?**: `string`

AWS SES access key id.

***

### awsSesEndpoint? {#awssesendpoint}

> `optional` **awsSesEndpoint?**: `string`

AWS SES endpoint.

***

### awsMessagingPushNotificationApplications? {#awsmessagingpushnotificationapplications}

> `optional` **awsMessagingPushNotificationApplications?**: `string`

The applications for the push notifications reference a separate json with @json: prefix.

***

### messagingEmailConnector? {#messagingemailconnector}

> `optional` **messagingEmailConnector?**: `string`

The type of messaging email connector: entity-storage, aws.

***

### messagingSmsConnector? {#messagingsmsconnector}

> `optional` **messagingSmsConnector?**: `string`

The type of messaging sms connector: entity-storage, aws.

***

### messagingPushNotificationConnector? {#messagingpushnotificationconnector}

> `optional` **messagingPushNotificationConnector?**: `string`

The type of messaging push notification connector: entity-storage, aws.

***

### telemetryConnector? {#telemetryconnector}

> `optional` **telemetryConnector?**: `string`

The type of telemetry connector: entity-storage.

***

### openTelemetryMeterName? {#opentelemetrymetername}

> `optional` **openTelemetryMeterName?**: `string`

The name of the Open Telemetry meter to use, only required if using open-telemetry as telemetry connector, defaults to twin-node.

***

### openTelemetryMeterVersion? {#opentelemetrymeterversion}

> `optional` **openTelemetryMeterVersion?**: `string`

The version of the Open Telemetry metrics specification to use, only required if using open-telemetry as telemetry connector, defaults to 1.0.0.

***

### openTelemetryReader? {#opentelemetryreader}

> `optional` **openTelemetryReader?**: `string`

The type of Open Telemetry metric reader to use, only required if using open-telemetry as telemetry connector, values: prometheus.

***

### openTelemetryPrometheusPort? {#opentelemetryprometheusport}

> `optional` **openTelemetryPrometheusPort?**: `string`

The port to use for the Open Telemetry Prometheus metrics server, only required if using open-telemetry as telemetry connector and prometheus as reader, defaults to 9464.

***

### telemetryMetricsCollectorInterval? {#telemetrymetricscollectorinterval}

> `optional` **telemetryMetricsCollectorInterval?**: `string`

Polling interval in seconds for the telemetry metrics collector. Defaults to 60.

***

### telemetryMetricsProducers? {#telemetrymetricsproducers}

> `optional` **telemetryMetricsProducers?**: `string`

The type of telemetry metrics producers, can be a comma separated list: system, process.

***

### telemetryMetricsProducerMaxHistory? {#telemetrymetricsproducermaxhistory}

> `optional` **telemetryMetricsProducerMaxHistory?**: `string`

Maximum number of values retained per telemetry metric (count-based history cap). Defaults to 1440.

***

### faucetConnector? {#faucetconnector}

> `optional` **faucetConnector?**: `string`

The type of faucet connector: entity-storage, iota.

***

### walletConnector? {#walletconnector}

> `optional` **walletConnector?**: `string`

The type of wallet connector: entity-storage, iota.

***

### nftConnector? {#nftconnector}

> `optional` **nftConnector?**: `string`

The type of NFT connector: entity-storage, iota.

***

### nftPackageId? {#nftpackageid}

> `optional` **nftPackageId?**: `string`

The NFT deployed package id, for custom deployments.

***

### notarizationConnector? {#notarizationconnector}

> `optional` **notarizationConnector?**: `string`

The type of notarization connector: entity-storage, iota.

***

### identityConnector? {#identityconnector}

> `optional` **identityConnector?**: `string`

The type of identity connector: entity-storage, iota.

***

### identityWalletAddressIndex? {#identitywalletaddressindex}

> `optional` **identityWalletAddressIndex?**: `string`

The index of the wallet address to use, defaults to 0.

***

### identityDidResolutionCacheTtlMs? {#identitydidresolutioncachettlms}

> `optional` **identityDidResolutionCacheTtlMs?**: `string`

The TTL in milliseconds for caching resolved DIDs when using the IOTA identity connector. Omit to use the connector default.

***

### identityResolverConnector? {#identityresolverconnector}

> `optional` **identityResolverConnector?**: `string`

The type of identity resolver connector: entity-storage, iota.

***

### iotaFaucetEndpoint? {#iotafaucetendpoint}

> `optional` **iotaFaucetEndpoint?**: `string`

IOTA Faucet Endpoint.

***

### iotaNodeEndpoint? {#iotanodeendpoint}

> `optional` **iotaNodeEndpoint?**: `string`

IOTA Node Endpoint.

***

### iotaNetwork? {#iotanetwork}

> `optional` **iotaNetwork?**: `string`

IOTA network.

***

### iotaCoinType? {#iotacointype}

> `optional` **iotaCoinType?**: `string`

IOTA coin type.

***

### iotaGasBudget? {#iotagasbudget}

> `optional` **iotaGasBudget?**: `string`

IOTA gas budget, in nanos.

***

### iotaGasReservationDuration? {#iotagasreservationduration}

> `optional` **iotaGasReservationDuration?**: `string`

IOTA gas reservation duration, in seconds.

***

### iotaExplorerEndpoint? {#iotaexplorerendpoint}

> `optional` **iotaExplorerEndpoint?**: `string`

IOTA Explorer Endpoint.

***

### iotaGasStationEndpoint? {#iotagasstationendpoint}

> `optional` **iotaGasStationEndpoint?**: `string`

IOTA Gas Station Endpoint.

***

### iotaGasStationAuthToken? {#iotagasstationauthtoken}

> `optional` **iotaGasStationAuthToken?**: `string`

IOTA Gas Station Authentication Token.

***

### iotaIdentityPackageId? {#iotaidentitypackageid}

> `optional` **iotaIdentityPackageId?**: `string`

The IOTA Identity deployed package id, for custom deployments.

***

### universalResolverEndpoint? {#universalresolverendpoint}

> `optional` **universalResolverEndpoint?**: `string`

Universal Resolver Endpoint.

***

### identityProfileConnector? {#identityprofileconnector}

> `optional` **identityProfileConnector?**: `string`

The type of identity profile connector: entity-storage.

***

### immutableProofVerificationMethodId? {#immutableproofverificationmethodid}

> `optional` **immutableProofVerificationMethodId?**: `string`

The identity verification method id to use with immutable proofs.

***

### attestationConnector? {#attestationconnector}

> `optional` **attestationConnector?**: `string`

The type of attestation connector: entity-storage, iota.

***

### attestationVerificationMethodId? {#attestationverificationmethodid}

> `optional` **attestationVerificationMethodId?**: `string`

The identity verification method id to use with attestation.

***

### dataProcessingEnabled? {#dataprocessingenabled}

> `optional` **dataProcessingEnabled?**: `string`

Is the data processing enabled, defaults to false.

***

### dataConverterConnectors? {#dataconverterconnectors}

> `optional` **dataConverterConnectors?**: `string`

The type of the default data converters, can be a comma separated list: json, xml.

***

### dataExtractorConnectors? {#dataextractorconnectors}

> `optional` **dataExtractorConnectors?**: `string`

The type of the default data extractor, can be a comma separated list: json-path.

***

### taskSchedulerEnabled? {#taskschedulerenabled}

> `optional` **taskSchedulerEnabled?**: `string`

Enable the task scheduler regardless of which other components are active, defaults to false.

***

### auditableItemGraphEnabled? {#auditableitemgraphenabled}

> `optional` **auditableItemGraphEnabled?**: `string`

Is the auditable item graph enabled, defaults to false.

***

### auditableItemStreamEnabled? {#auditableitemstreamenabled}

> `optional` **auditableItemStreamEnabled?**: `string`

Is the auditable item stream enabled, defaults to false.

***

### documentManagementEnabled? {#documentmanagementenabled}

> `optional` **documentManagementEnabled?**: `string`

Is the document management enabled, defaults to false.

***

### federatedCatalogueEnabled? {#federatedcatalogueenabled}

> `optional` **federatedCatalogueEnabled?**: `string`

Enable the federated catalogue, defaults to false, automatically enabled if remote endpoint, filters or dataspace is enabled.

***

### federatedCatalogueFilters? {#federatedcataloguefilters}

> `optional` **federatedCatalogueFilters?**: `string`

Federated catalog filters, command separated list of filters to add.

***

### federatedCatalogueRemoteEndpoint? {#federatedcatalogueremoteendpoint}

> `optional` **federatedCatalogueRemoteEndpoint?**: `string`

Federated catalog remote endpoint, if set will use a REST client instead of local service.

***

### federatedCatalogueRestClientPathPrefix? {#federatedcataloguerestclientpathprefix}

> `optional` **federatedCatalogueRestClientPathPrefix?**: `string`

The path prefix used by the federated catalogue REST client when forwarding requests to the remote endpoint, defaults to "federated-catalogue".

***

### trustGenerators? {#trustgenerators}

> `optional` **trustGenerators?**: `string`

The trust generators to add to the factory, comma separated list.

***

### trustVerifiers? {#trustverifiers}

> `optional` **trustVerifiers?**: `string`

The trust verifiers to add to the factory, comma separated list.

***

### trustVerificationMethodId? {#trustverificationmethodid}

> `optional` **trustVerificationMethodId?**: `string`

The verification method to use for trust identities.
Defaults to trust-assertion.

***

### trustJwtTtl? {#trustjwtttl}

> `optional` **trustJwtTtl?**: `string`

The trust time to live for generating JWTs in seconds.
Defaults to undefined for never expiring.

***

### trustIdentitiesAllow? {#trustidentitiesallow}

> `optional` **trustIdentitiesAllow?**: `string`

The allow lists for the trust identity verifier, comma separated list of identities.

***

### trustIdentitiesDeny? {#trustidentitiesdeny}

> `optional` **trustIdentitiesDeny?**: `string`

The deny lists for the trust identity verifier, comma separated list of identities.

***

### rightsManagementCallbackPath? {#rightsmanagementcallbackpath}

> `optional` **rightsManagementCallbackPath?**: `string`

Path under which the rights management service is mounted (single source
of truth). The same value drives:
- the server route mount (via engine config)
- the PNP service's callback URL builder (`buildCallbackUrl`)
- the PNP rest-client's pathPrefix (consumer side)
Defaults to `rights-management`. Set when deploying behind a reverse proxy
with path rewriting, K8s ingress with path-based routing, or any custom
mount point.

***

### rightsManagementPolicyInformationSources? {#rightsmanagementpolicyinformationsources}

> `optional` **rightsManagementPolicyInformationSources?**: `string`

The rights management policy information sources to add to the factory.

***

### rightsManagementPolicyNegotiators? {#rightsmanagementpolicynegotiators}

> `optional` **rightsManagementPolicyNegotiators?**: `string`

The rights management policy negotiators sources to add to the factory.

***

### rightsManagementPolicyRequesters? {#rightsmanagementpolicyrequesters}

> `optional` **rightsManagementPolicyRequesters?**: `string`

The rights management policy requesters to add to the factory.

***

### rightsManagementPolicyExecutionActions? {#rightsmanagementpolicyexecutionactions}

> `optional` **rightsManagementPolicyExecutionActions?**: `string`

The rights management policy execution actions to add to the factory.

***

### rightsManagementPolicyEnforcementProcessors? {#rightsmanagementpolicyenforcementprocessors}

> `optional` **rightsManagementPolicyEnforcementProcessors?**: `string`

The rights management policy enforcement processors to add to the factory.

***

### rightsManagementPolicyArbiters? {#rightsmanagementpolicyarbiters}

> `optional` **rightsManagementPolicyArbiters?**: `string`

The rights management policy arbiters to add to the factory.

***

### rightsManagementPolicyObligationEnforcers? {#rightsmanagementpolicyobligationenforcers}

> `optional` **rightsManagementPolicyObligationEnforcers?**: `string`

The rights management policy obligation enforcers to add to the factory.

***

### dataspaceEnabled? {#dataspaceenabled}

> `optional` **dataspaceEnabled?**: `string`

Is the dataspace enabled, defaults to false.

***

### dataspaceRetainActivityLogsFor? {#dataspaceretainactivitylogsfor}

> `optional` **dataspaceRetainActivityLogsFor?**: `string`

The length of time to retain the activity logs for in seconds, set to -1 to keep forever.

#### Default

```ts
600
```

***

### dataspaceActivityLogsCleanupInterval? {#dataspaceactivitylogscleanupinterval}

> `optional` **dataspaceActivityLogsCleanupInterval?**: `string`

The interval in seconds for cleaning up the activity logs.

#### Default

```ts
3600
```

***

### dataspaceDataPlanePath? {#dataspacedataplanepath}

> `optional` **dataspaceDataPlanePath?**: `string`

Base route path for the data plane service (path only, not full URL).
Combined with the public origin to form the `dataAddress.endpoint` sent to PULL consumers
and the inbox URL sent to PUSH providers.

This must be the mount-point prefix of the data plane routes, NOT a specific route path.
Do NOT append sub-paths such as `/entities` or `/inbox` — those are appended automatically
by each transfer handler and by the data plane REST client.

REQUIRED if PULL or PUSH transfers are supported.
If not specified, PULL and PUSH transfers will not be available.

Example: "dataspace"

***

### dataspaceAutoStartTransfers? {#dataspaceautostarttransfers}

> `optional` **dataspaceAutoStartTransfers?**: `string`

Whether the provider immediately starts a transfer once it has been requested.
When false the transfer stays in REQUESTED until the provider explicitly calls transferStarted.

#### Default

```ts
false
```

***

### dataspaceStalledNegotiationTimeout? {#dataspacestallednegotiationtimeout}

> `optional` **dataspaceStalledNegotiationTimeout?**: `string`

How long in seconds a negotiation may sit without progress before it is treated as timed out.

#### Default

```ts
30
```

***

### dataspaceStalledTransferTimeout? {#dataspacestalledtransfertimeout}

> `optional` **dataspaceStalledTransferTimeout?**: `string`

How long in seconds a consumer-initiated transfer may sit in REQUESTED without the provider
progressing it before it is treated as timed out.

#### Default

```ts
30
```

***

### dataspaceCallbackPath? {#dataspacecallbackpath}

> `optional` **dataspaceCallbackPath?**: `string`

Path under which the dataspace control plane is mounted (path only, not full URL).
This must match the control-plane REST mount, as it is combined with the public
origin to build the consumer's advertised callback address.

#### Default

```ts
"dataspace-control-plane"
```

***

### healthEnabled? {#healthenabled}

> `optional` **healthEnabled?**: `string`

Are the health components enabled, defaults to false.

***

### healthInterval? {#healthinterval}

> `optional` **healthInterval?**: `string`

The interval in seconds for performing health checks, defaults to 60.

***

### healthStartupInterval? {#healthstartupinterval}

> `optional` **healthStartupInterval?**: `string`

The interval in seconds for performing health checks at startup, defaults to 2.
This allows components that take a long time to initialize to be healthy before the first health check is performed.

***

### automationActionTypes? {#automationactiontypes}

> `optional` **automationActionTypes?**: `string`

The type of the automation action to create, comma separate for more than one connector.
values: fetch

***

### mutexTimeoutMsDefault? {#mutextimeoutmsdefault}

> `optional` **mutexTimeoutMsDefault?**: `string`

The default mutex timeout in milliseconds, used when no component-specific timeout is set, defaults to 5000 if omitted.

***

### auditableItemGraphMutexTimeout? {#auditableitemgraphmutextimeout}

> `optional` **auditableItemGraphMutexTimeout?**: `string`

The mutex timeout in milliseconds for the auditable item graph component.

***

### auditableItemStreamMutexTimeout? {#auditableitemstreammutextimeout}

> `optional` **auditableItemStreamMutexTimeout?**: `string`

The mutex timeout in milliseconds for the auditable item stream component.

***

### federatedCatalogueMutexTimeout? {#federatedcataloguemutextimeout}

> `optional` **federatedCatalogueMutexTimeout?**: `string`

The mutex timeout in milliseconds for the federated catalogue component.

***

### documentManagementMutexTimeout? {#documentmanagementmutextimeout}

> `optional` **documentManagementMutexTimeout?**: `string`

The mutex timeout in milliseconds for the document management component.

***

### loggingMutexTimeout? {#loggingmutextimeout}

> `optional` **loggingMutexTimeout?**: `string`

The mutex timeout in milliseconds for the logging component.

***

### entityStorageMemoryMutexTimeout? {#entitystoragememorymutextimeout}

> `optional` **entityStorageMemoryMutexTimeout?**: `string`

The mutex timeout in milliseconds for the memory entity storage connector.

***

### entityStorageFileMutexTimeout? {#entitystoragefilemutextimeout}

> `optional` **entityStorageFileMutexTimeout?**: `string`

The mutex timeout in milliseconds for the file entity storage connector.

***

### rightsManagementMutexTimeout? {#rightsmanagementmutextimeout}

> `optional` **rightsManagementMutexTimeout?**: `string`

The mutex timeout in milliseconds for the rights management component.

***

### extensions? {#extensions}

> `optional` **extensions?**: `string`

A comma separated list of additional node extensions to load, the initialiseExtension method will be called for each extension.
