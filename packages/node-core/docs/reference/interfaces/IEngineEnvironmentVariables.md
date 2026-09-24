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

### scylladbPoolCoreConnectionsPerHost? {#scylladbpoolcoreconnectionsperhost}

> `optional` **scylladbPoolCoreConnectionsPerHost?**: `string`

ScyllaDB connection pool: number of connections per local host.

***

### scylladbPoolMaxRequestsPerConnection? {#scylladbpoolmaxrequestsperconnection}

> `optional` **scylladbPoolMaxRequestsPerConnection?**: `string`

ScyllaDB connection pool: maximum requests per connection.

***

### mySqlHost? {#mysqlhost}

> `optional` **mySqlHost?**: `string`

MySQL host.

***

### mySqlPort? {#mysqlport}

> `optional` **mySqlPort?**: `string`

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

### mySqlPoolConnectionLimit? {#mysqlpoolconnectionlimit}

> `optional` **mySqlPoolConnectionLimit?**: `string`

MySQL connection pool: maximum number of connections.

***

### mySqlPoolMaxIdle? {#mysqlpoolmaxidle}

> `optional` **mySqlPoolMaxIdle?**: `string`

MySQL connection pool: maximum number of idle connections.

***

### mySqlPoolIdleTimeout? {#mysqlpoolidletimeout}

> `optional` **mySqlPoolIdleTimeout?**: `string`

MySQL connection pool: milliseconds before an idle connection is removed.

***

### mySqlPoolEnableKeepAlive? {#mysqlpoolenablekeepalive}

> `optional` **mySqlPoolEnableKeepAlive?**: `string`

MySQL connection pool: enable TCP keep-alive.

***

### mySqlPoolWaitForConnections? {#mysqlpoolwaitforconnections}

> `optional` **mySqlPoolWaitForConnections?**: `string`

MySQL connection pool: wait for a connection when pool is full.

***

### mySqlPoolQueueLimit? {#mysqlpoolqueuelimit}

> `optional` **mySqlPoolQueueLimit?**: `string`

MySQL connection pool: maximum queued requests (0 = unlimited).

***

### mongoDbHost? {#mongodbhost}

> `optional` **mongoDbHost?**: `string`

MongoDB host.

***

### mongoDbPort? {#mongodbport}

> `optional` **mongoDbPort?**: `string`

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

### mongoDbPoolMaxPoolSize? {#mongodbpoolmaxpoolsize}

> `optional` **mongoDbPoolMaxPoolSize?**: `string`

MongoDB connection pool: maximum number of connections.

***

### mongoDbPoolMinPoolSize? {#mongodbpoolminpoolsize}

> `optional` **mongoDbPoolMinPoolSize?**: `string`

MongoDB connection pool: minimum number of connections to maintain.

***

### mongoDbPoolMaxIdleTime? {#mongodbpoolmaxidletime}

> `optional` **mongoDbPoolMaxIdleTime?**: `string`

MongoDB connection pool: milliseconds a connection can remain idle before removal.

***

### mongoDbPoolWaitQueueTimeout? {#mongodbpoolwaitqueuetimeout}

> `optional` **mongoDbPoolWaitQueueTimeout?**: `string`

MongoDB connection pool: milliseconds to wait for a connection before throwing.

***

### postgreSqlHost? {#postgresqlhost}

> `optional` **postgreSqlHost?**: `string`

PostgreSQl host.

***

### postgreSqlPort? {#postgresqlport}

> `optional` **postgreSqlPort?**: `string`

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

### postgreSqlPoolMax? {#postgresqlpoolmax}

> `optional` **postgreSqlPoolMax?**: `string`

PostgreSQL connection pool: maximum number of connections.

***

### postgreSqlPoolIdleTimeout? {#postgresqlpoolidletimeout}

> `optional` **postgreSqlPoolIdleTimeout?**: `string`

PostgreSQL connection pool: seconds a connection can remain idle before being closed.

***

### postgreSqlPoolConnectTimeout? {#postgresqlpoolconnecttimeout}

> `optional` **postgreSqlPoolConnectTimeout?**: `string`

PostgreSQL connection pool: seconds to wait when establishing a connection.

***

### postgreSqlPoolMaxLifetime? {#postgresqlpoolmaxlifetime}

> `optional` **postgreSqlPoolMaxLifetime?**: `string`

PostgreSQL connection pool: maximum seconds a connection can remain open.

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

The type of logging task connector, can be a comma separated list: console, entity-storage, open-telemetry, file.

***

### loggingBatchSize? {#loggingbatchsize}

> `optional` **loggingBatchSize?**: `string`

The batch size for the logging task, set to 1 for no batching.

***

### loggingBatchFlushInterval? {#loggingbatchflushinterval}

> `optional` **loggingBatchFlushInterval?**: `string`

The batch flush interval in seconds for the logging task, how often to flush the logs when using batching, defaults to 5 seconds.

***

### loggingRetainFor? {#loggingretainfor}

> `optional` **loggingRetainFor?**: `string`

Delete log entries older than this many minutes for the entity-storage logging connector.
Set to 0 to disable age-based retention.

#### Default

```ts
2880 (2 days)
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

### loggingRetentionInterval? {#loggingretentioninterval}

> `optional` **loggingRetentionInterval?**: `string`

How often the retention cleanup task runs in minutes for the entity-storage logging connector.
Set to 0 to disable periodic cleanup.

#### Default

```ts
5
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

### telemetrySilentComponents? {#telemetrysilentcomponents}

> `optional` **telemetrySilentComponents?**: `string`

A list of components to exclude from telemetry, can be a comma separated list of component Class names e.g. "ComponentA,ComponentB".

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

### emailProtocolConnector? {#emailprotocolconnector}

> `optional` **emailProtocolConnector?**: `string`

The email protocol connector types, comma-separated: pop3, imap, gmail, outlook.

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

The type of messaging email connector: entity-storage, aws, smtp.

***

### smtpHost? {#smtphost}

> `optional` **smtpHost?**: `string`

SMTP server hostname or IP address.

***

### smtpPort? {#smtpport}

> `optional` **smtpPort?**: `string`

SMTP server port, defaults to 587.

***

### smtpSecure? {#smtpsecure}

> `optional` **smtpSecure?**: `string`

Whether the SMTP connector uses TLS.

***

### smtpUsername? {#smtpusername}

> `optional` **smtpUsername?**: `string`

SMTP authentication username.

***

### smtpPassword? {#smtppassword}

> `optional` **smtpPassword?**: `string`

SMTP authentication password.

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

The type of telemetry connector, comma-separated for multiple: entity-storage, open-telemetry, silent.

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

### telemetryBatchSize? {#telemetrybatchsize}

> `optional` **telemetryBatchSize?**: `string`

The batch size for the telemetry connector, set to 1 to disable size-based flushing.

***

### telemetryBatchFlushInterval? {#telemetrybatchflushinterval}

> `optional` **telemetryBatchFlushInterval?**: `string`

The batch flush interval in seconds for the telemetry connector, how often to flush when using batching, defaults to 5 seconds.

***

### telemetryMaxCacheSize? {#telemetrymaxcachesize}

> `optional` **telemetryMaxCacheSize?**: `string`

The maximum number of metric values to hold in the write-ahead cache for the telemetry connector. Set to 0 for unlimited.

#### Default

```ts
1000
```

***

### telemetryFlushTimeout? {#telemetryflushtimeout}

> `optional` **telemetryFlushTimeout?**: `string`

How long in milliseconds the telemetry connector waits for its background thread to confirm
a flush before a read continues without it.

#### Default

```ts
30000
```

***

### telemetryTaskCoalesce? {#telemetrytaskcoalesce}

> `optional` **telemetryTaskCoalesce?**: `string`

How long in milliseconds the telemetry connector holds values so several share a single
background task, instead of creating one task per value. Set to 0 to disable coalescing.

#### Default

```ts
1000
```

***

### telemetryTaskStallTimeout? {#telemetrytaskstalltimeout}

> `optional` **telemetryTaskStallTimeout?**: `string`

How long in milliseconds the telemetry connector allows with tasks outstanding and none of
them completing before its background thread is treated as stalled and replaced. Set to 0
to disable the check.

#### Default

```ts
60000
```

***

### telemetryMetricDefinitionCacheCapacity? {#telemetrymetricdefinitioncachecapacity}

> `optional` **telemetryMetricDefinitionCacheCapacity?**: `string`

The maximum number of metric definitions held in the in-memory definition cache for the telemetry connector.

#### Default

```ts
100
```

***

### telemetryMetricDefinitionCacheTtiMs? {#telemetrymetricdefinitioncachettims}

> `optional` **telemetryMetricDefinitionCacheTtiMs?**: `string`

The time-to-idle in milliseconds for cached metric definitions in the telemetry connector.

#### Default

```ts
3600000
```

***

### tracingSilentComponents? {#tracingsilentcomponents}

> `optional` **tracingSilentComponents?**: `string`

A list of components to exclude from tracing, can be a comma separated list of component Class names e.g. "ComponentA,ComponentB".

***

### tracingConnector? {#tracingconnector}

> `optional` **tracingConnector?**: `string`

The type of tracing connector, comma-separated for multiple: entity-storage, open-telemetry, console, silent.

***

### facade? {#facade}

> `optional` **facade?**: `string`

The type of facade to activate, comma-separated for multiple: tracing. When this is not set no
facades are activated.

***

### tracingFacadeFactories? {#tracingfacadefactories}

> `optional` **tracingFacadeFactories?**: `string`

The factories the tracing facade is activated on, as a comma separated list of factory type names
e.g. "component,vault", replacing the default set rather than adding to it. Only applies when the
tracing facade is activated.

***

### tracingFacadeComponentExcludeTypes? {#tracingfacadecomponentexcludetypes}

> `optional` **tracingFacadeComponentExcludeTypes?**: `string`

Additional instance types the tracing facade is not applied to in the component factory, as a comma
separated list of regular expressions matched anywhere in the type name e.g. "^my-tracing-service$".
These extend the types which are always excluded, "tracing", "telemetry", "metrics", "logging" and
"platform", they do not replace them.

***

### tracingFacadeExcludeParams? {#tracingfacadeexcludeparams}

> `optional` **tracingFacadeExcludeParams?**: `string`

Additional parameter names the tracing facade does not record, as a comma separated list
e.g. "ssn,accountNumber". These extend the names which are always excluded, they do not
replace them.

***

### tracingFacadeExcludeMethods? {#tracingfacadeexcludemethods}

> `optional` **tracingFacadeExcludeMethods?**: `string`

Additional method names the tracing facade does not record a span for, as a comma separated
list e.g. "health,ping". These extend the names which are always excluded, they do not
replace them.

***

### tracingFacadeIncludeObjects? {#tracingfacadeincludeobjects}

> `optional` **tracingFacadeIncludeObjects?**: `string`

The object values the tracing facade records, as a comma separated list of patterns matched
against the end of "parameter" or "parameter.property", where the returned value is named
"resolved" e.g. "filter.id,resolved.id". Naming the parameter records the whole object
including any secrets it holds, naming a property records only that property. Object
parameters and returned objects are omitted unless matched here.

***

### openTelemetryTracingTracerName? {#opentelemetrytracingtracername}

> `optional` **openTelemetryTracingTracerName?**: `string`

The name of the Open Telemetry tracer to use, only required if using open-telemetry as tracing connector, defaults to twin-node.

***

### openTelemetryTracingTracerVersion? {#opentelemetrytracingtracerversion}

> `optional` **openTelemetryTracingTracerVersion?**: `string`

The version of the Open Telemetry tracing specification to use, only required if using open-telemetry as tracing connector, defaults to 1.0.0.

***

### openTelemetryTracingEndpoint? {#opentelemetrytracingendpoint}

> `optional` **openTelemetryTracingEndpoint?**: `string`

The OTLP HTTP endpoint to push spans to, e.g. http://localhost:4318/v1/traces. Required when using open-telemetry as tracing connector.

***

### openTelemetryTracingProcessor? {#opentelemetrytracingprocessor}

> `optional` **openTelemetryTracingProcessor?**: `string`

The span processor: batch (default) or simple. Only used when TWIN_TRACING_CONNECTOR=open-telemetry.

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

### identityDidResolutionCacheTtl? {#identitydidresolutioncachettl}

> `optional` **identityDidResolutionCacheTtl?**: `string`

The TTL in milliseconds for caching resolved DIDs when using the IOTA identity connector. Omit to use the connector default.

***

### identityDidResolutionCacheCapacity? {#identitydidresolutioncachecapacity}

> `optional` **identityDidResolutionCacheCapacity?**: `string`

The maximum number of DID documents to hold in the resolution cache. Only used when using the IOTA identity connector and caching is enabled.

***

### identityDidResolutionCacheMutexTimeout? {#identitydidresolutioncachemutextimeout}

> `optional` **identityDidResolutionCacheMutexTimeout?**: `string`

The mutex timeout in milliseconds for the DID resolution cache. Only used when using the IOTA identity connector and caching is enabled.

***

### identityDidResolutionRetries? {#identitydidresolutionretries}

> `optional` **identityDidResolutionRetries?**: `string`

The number of times to retry resolving a DID after a write operation (create, update, or delete) to confirm propagation. Only used when using the IOTA identity connector.

***

### identityDidResolutionRetryDelay? {#identitydidresolutionretrydelay}

> `optional` **identityDidResolutionRetryDelay?**: `string`

The delay in milliseconds between DID resolution retries after a write operation. Only used when using the IOTA identity connector.

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

### immutableProofTaskRetryCount? {#immutableprooftaskretrycount}

> `optional` **immutableProofTaskRetryCount?**: `string`

The number of times to retry a proof task when it fails, 0 to disable retries.

#### Default

```ts
5
```

***

### immutableProofTaskRetryInterval? {#immutableprooftaskretryinterval}

> `optional` **immutableProofTaskRetryInterval?**: `string`

The interval in seconds to wait between proof task retries.

#### Default

```ts
5
```

***

### immutableProofTaskFailureRetainFor? {#immutableprooftaskfailureretainfor}

> `optional` **immutableProofTaskFailureRetainFor?**: `string`

The time in minutes to retain the record of a failed proof task.
Set to -1 to retain failures forever.

#### Default

```ts
10080
```

***

### immutableProofTaskWorkerIdleTimeout? {#immutableprooftaskworkeridletimeout}

> `optional` **immutableProofTaskWorkerIdleTimeout?**: `string`

How long in seconds the proof task worker stays idle before it shuts down.
Set to 0 to shut it down after every task, or -1 to never shut it down.

#### Default

```ts
60
```

***

### immutableProofTaskWorkerCount? {#immutableprooftaskworkercount}

> `optional` **immutableProofTaskWorkerCount?**: `string`

The maximum number of proof task workers that can run in parallel.

#### Default

```ts
1
```

***

### immutableProofSweepInterval? {#immutableproofsweepinterval}

> `optional` **immutableProofSweepInterval?**: `string`

How often in minutes the immutable proof reconciliation sweep runs.

#### Default

```ts
30
```

***

### immutableProofSweepStaleThreshold? {#immutableproofsweepstalethreshold}

> `optional` **immutableProofSweepStaleThreshold?**: `string`

The minimum age in minutes before a proof with no notarization is considered stuck.

#### Default

```ts
180
```

***

### immutableProofSweepMaxAttempts? {#immutableproofsweepmaxattempts}

> `optional` **immutableProofSweepMaxAttempts?**: `string`

The number of sweep attempts made before a proof is parked.

#### Default

```ts
5
```

***

### immutableProofSweepBatchLimit? {#immutableproofsweepbatchlimit}

> `optional` **immutableProofSweepBatchLimit?**: `string`

The maximum number of proofs to re-enqueue per tenant per sweep cycle.

#### Default

```ts
10
```

***

### immutableProofSweepBackoff? {#immutableproofsweepbackoff}

> `optional` **immutableProofSweepBackoff?**: `string`

The minimum time in minutes between sweep attempts for the same proof.

#### Default

```ts
60
```

***

### immutableProofSweepAssumeRetryableBefore? {#immutableproofsweepassumeretryablebefore}

> `optional` **immutableProofSweepAssumeRetryableBefore?**: `string`

ISO 8601 date-time used to treat older missing-task proofs as retryable.

***

### attestationConnector? {#attestationconnector}

> `optional` **attestationConnector?**: `string`

The type of attestation connector: entity-storage, iota.

***

### attestationVerificationMethodId? {#attestationverificationmethodid}

> `optional` **attestationVerificationMethodId?**: `string`

The identity verification method id to use with attestation.

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

### dataspaceAgreementCacheTtl? {#dataspaceagreementcachettl}

> `optional` **dataspaceAgreementCacheTtl?**: `string`

The TTL in milliseconds for the dataspace agreement cache.

***

### dataspaceAgreementCacheMutexTimeout? {#dataspaceagreementcachemutextimeout}

> `optional` **dataspaceAgreementCacheMutexTimeout?**: `string`

The mutex timeout in milliseconds for the dataspace agreement cache.

***

### dataspaceAgreementUnusedThreshold? {#dataspaceagreementunusedthreshold}

> `optional` **dataspaceAgreementUnusedThreshold?**: `string`

The time in milliseconds after which an unused agreement is eligible for removal.

***

### dataspaceAgreementSweepInterval? {#dataspaceagreementsweepinterval}

> `optional` **dataspaceAgreementSweepInterval?**: `string`

The interval in milliseconds between agreement sweep runs.

***

### dataspaceRetryCount? {#dataspaceretrycount}

> `optional` **dataspaceRetryCount?**: `string`

The number of times to retry failed data plane tasks.

***

### dataspacePushRetryCount? {#dataspacepushretrycount}

> `optional` **dataspacePushRetryCount?**: `string`

Maximum HTTP retry attempts per push delivery task execution.

***

### dataspacePushRetryBaseDelay? {#dataspacepushretrybasedelay}

> `optional` **dataspacePushRetryBaseDelay?**: `string`

Base delay in milliseconds for exponential backoff between push HTTP retries.

***

### dataspacePushTimeout? {#dataspacepushtimeout}

> `optional` **dataspacePushTimeout?**: `string`

Timeout in milliseconds for each push delivery HTTP POST request.

***

### dataspacePushSubscriptionCleanupInterval? {#dataspacepushsubscriptioncleanupinterval}

> `optional` **dataspacePushSubscriptionCleanupInterval?**: `string`

Interval in milliseconds between orphaned push subscription cleanup scans.

***

### dataspaceDataPlanePath? {#dataspacedataplanepath}

> `optional` **dataspaceDataPlanePath?**: `string`

Base route path for the data plane service (path only, not full URL).
Combined with the public origin to form the `dataAddress.endpoint` sent to PULL consumers
and the inbox URL sent to PUSH providers.

This must be the mount-point prefix of the data plane routes, NOT a specific route path.
Do NOT append sub-paths such as `/entities` or `/inbox` - those are appended automatically
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

### dataspaceProviderTransferIdleTimeout? {#dataspaceprovidertransferidletimeout}

> `optional` **dataspaceProviderTransferIdleTimeout?**: `string`

How long in seconds a provider transfer may stay idle before the idle policy marks it as stalled.

***

### dataspaceProviderTransferPolicySweepInterval? {#dataspaceprovidertransferpolicysweepinterval}

> `optional` **dataspaceProviderTransferPolicySweepInterval?**: `string`

How frequently in seconds the provider idle transfer policy sweep runs.

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

The interval in seconds for performing health checks at startup, defaults to 30.
This allows components that take a long time to initialize to be healthy before the first health check is performed.

***

### healthApplicationInterval? {#healthapplicationinterval}

> `optional` **healthApplicationInterval?**: `string`

The interval in seconds for running the application health lifecycle (init, application, teardown), defaults to 300.

***

### healthExcludeCloneComponents? {#healthexcludeclonecomponents}

> `optional` **healthExcludeCloneComponents?**: `string`

Comma separated list of regular expressions matched against the engine component type keys,
any which match are excluded from the engine clone used by the application health background
task. Defaults to the component groups which provide no application health checks.

***

### backgroundTaskMaxSystemWorkerCount? {#backgroundtaskmaxsystemworkercount}

> `optional` **backgroundTaskMaxSystemWorkerCount?**: `string`

The maximum number of workers to use for processing background tasks, defaults to twice the number of CPU cores.

***

### backgroundTaskInterval? {#backgroundtaskinterval}

> `optional` **backgroundTaskInterval?**: `string`

The interval in milliseconds to leave between background tasks, defaults to 100.

***

### backgroundTaskRetryInterval? {#backgroundtaskretryinterval}

> `optional` **backgroundTaskRetryInterval?**: `string`

The interval in milliseconds to leave between background task retries, defaults to 5000.

***

### backgroundTaskCleanupInterval? {#backgroundtaskcleanupinterval}

> `optional` **backgroundTaskCleanupInterval?**: `string`

The interval in milliseconds between sweeps removing retained background tasks, defaults to 120000.

***

### backgroundTaskWorkerShutdownTimeout? {#backgroundtaskworkershutdowntimeout}

> `optional` **backgroundTaskWorkerShutdownTimeout?**: `string`

The time in milliseconds to wait for each handler's workers to shut down before terminating them, defaults to 5000.

***

### backgroundTaskMaxDispatchCount? {#backgroundtaskmaxdispatchcount}

> `optional` **backgroundTaskMaxDispatchCount?**: `string`

The maximum dispatches of a background task attempt before it is failed as interrupted, defaults to 3, set to -1 for no limit.

***

### automationActionTypes? {#automationactiontypes}

> `optional` **automationActionTypes?**: `string`

The type of the automation action to create, comma separate for more than one connector.
values: fetch

***

### mutexTimeoutDefault? {#mutextimeoutdefault}

> `optional` **mutexTimeoutDefault?**: `string`

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

### entityStorageMutexTimeout? {#entitystoragemutextimeout}

> `optional` **entityStorageMutexTimeout?**: `string`

The mutex timeout in milliseconds for the memory and file entity storage connectors.

***

### rightsManagementMutexTimeout? {#rightsmanagementmutextimeout}

> `optional` **rightsManagementMutexTimeout?**: `string`

The mutex timeout in milliseconds for the rights management component.

***

### extensions? {#extensions}

> `optional` **extensions?**: `string`

A comma separated list of additional node extensions to load, the initialiseExtension method will be called for each extension.
