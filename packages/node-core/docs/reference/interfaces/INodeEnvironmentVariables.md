# Interface: INodeEnvironmentVariables

The environment variables for the node.

## Extends

- [`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md)

## Properties

### debug? {#debug}

> `optional` **debug?**: `string`

Start the engine in debug mode.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`debug`](IEngineServerEnvironmentVariables.md#debug)

***

### silent? {#silent}

> `optional` **silent?**: `string`

Start the engine in silent mode.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`silent`](IEngineServerEnvironmentVariables.md#silent)

***

### storageFileRoot? {#storagefileroot}

> `optional` **storageFileRoot?**: `string`

The root directory for storing items like state file.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`storageFileRoot`](IEngineServerEnvironmentVariables.md#storagefileroot)

***

### stateFilename? {#statefilename}

> `optional` **stateFilename?**: `string`

The name of the state file.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`stateFilename`](IEngineServerEnvironmentVariables.md#statefilename)

***

### tenantEnabled? {#tenantenabled}

> `optional` **tenantEnabled?**: `string`

Is multi-tenant support enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`tenantEnabled`](IEngineServerEnvironmentVariables.md#tenantenabled)

***

### entityStorageConnectorType? {#entitystorageconnectortype}

> `optional` **entityStorageConnectorType?**: `string`

The type of the entity storage to create, comma separate for more than one connector.
values: file, memory, aws-dynamodb, azure-cosmosdb, gcp-firestoredb, scylladb, mysql, mongodb, postgresql

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`entityStorageConnectorType`](IEngineServerEnvironmentVariables.md#entitystorageconnectortype)

***

### entityStorageConnectorDefault? {#entitystorageconnectordefault}

> `optional` **entityStorageConnectorDefault?**: `string`

The default entity storage connector to use, defaults to the first one in the list.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`entityStorageConnectorDefault`](IEngineServerEnvironmentVariables.md#entitystorageconnectordefault)

***

### entityStorageTablePrefix? {#entitystoragetableprefix}

> `optional` **entityStorageTablePrefix?**: `string`

A prefix for all the table in entity-storage, can be empty.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`entityStorageTablePrefix`](IEngineServerEnvironmentVariables.md#entitystoragetableprefix)

***

### awsDynamodbAuthMode? {#awsdynamodbauthmode}

> `optional` **awsDynamodbAuthMode?**: `string`

AWS DynamoDB auth mode, either credentials or pod.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsDynamodbAuthMode`](IEngineServerEnvironmentVariables.md#awsdynamodbauthmode)

***

### awsDynamodbAccessKeyId? {#awsdynamodbaccesskeyid}

> `optional` **awsDynamodbAccessKeyId?**: `string`

AWS Dynamo DB access key id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsDynamodbAccessKeyId`](IEngineServerEnvironmentVariables.md#awsdynamodbaccesskeyid)

***

### awsDynamodbEndpoint? {#awsdynamodbendpoint}

> `optional` **awsDynamodbEndpoint?**: `string`

AWS Dynamo DB Endpoint if running local instance.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsDynamodbEndpoint`](IEngineServerEnvironmentVariables.md#awsdynamodbendpoint)

***

### awsDynamodbRegion? {#awsdynamodbregion}

> `optional` **awsDynamodbRegion?**: `string`

AWS Dynamo DB region.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsDynamodbRegion`](IEngineServerEnvironmentVariables.md#awsdynamodbregion)

***

### awsDynamodbSecretAccessKey? {#awsdynamodbsecretaccesskey}

> `optional` **awsDynamodbSecretAccessKey?**: `string`

AWS Dynamo DB secret access key.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsDynamodbSecretAccessKey`](IEngineServerEnvironmentVariables.md#awsdynamodbsecretaccesskey)

***

### awsDynamodbConnectionTimeoutMs? {#awsdynamodbconnectiontimeoutms}

> `optional` **awsDynamodbConnectionTimeoutMs?**: `string`

AWS Dynamo DB connection timeout.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsDynamodbConnectionTimeoutMs`](IEngineServerEnvironmentVariables.md#awsdynamodbconnectiontimeoutms)

***

### azureCosmosdbKey? {#azurecosmosdbkey}

> `optional` **azureCosmosdbKey?**: `string`

Azure Cosmos DB key.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureCosmosdbKey`](IEngineServerEnvironmentVariables.md#azurecosmosdbkey)

***

### azureCosmosdbContainerId? {#azurecosmosdbcontainerid}

> `optional` **azureCosmosdbContainerId?**: `string`

Azure Cosmos DB container id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureCosmosdbContainerId`](IEngineServerEnvironmentVariables.md#azurecosmosdbcontainerid)

***

### azureCosmosdbDatabaseId? {#azurecosmosdbdatabaseid}

> `optional` **azureCosmosdbDatabaseId?**: `string`

Azure Cosmos DB database id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureCosmosdbDatabaseId`](IEngineServerEnvironmentVariables.md#azurecosmosdbdatabaseid)

***

### azureCosmosdbEndpoint? {#azurecosmosdbendpoint}

> `optional` **azureCosmosdbEndpoint?**: `string`

Azure Cosmos DB endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureCosmosdbEndpoint`](IEngineServerEnvironmentVariables.md#azurecosmosdbendpoint)

***

### gcpFirestoreCollectionName? {#gcpfirestorecollectionname}

> `optional` **gcpFirestoreCollectionName?**: `string`

GCP Firestore collection name.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpFirestoreCollectionName`](IEngineServerEnvironmentVariables.md#gcpfirestorecollectionname)

***

### gcpFirestoreCredentials? {#gcpfirestorecredentials}

> `optional` **gcpFirestoreCredentials?**: `string`

GCP Firestore credentials.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpFirestoreCredentials`](IEngineServerEnvironmentVariables.md#gcpfirestorecredentials)

***

### gcpFirestoreDatabaseId? {#gcpfirestoredatabaseid}

> `optional` **gcpFirestoreDatabaseId?**: `string`

GCP Firestore database id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpFirestoreDatabaseId`](IEngineServerEnvironmentVariables.md#gcpfirestoredatabaseid)

***

### gcpFirestoreEndpoint? {#gcpfirestoreendpoint}

> `optional` **gcpFirestoreEndpoint?**: `string`

GCP Firestore endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpFirestoreEndpoint`](IEngineServerEnvironmentVariables.md#gcpfirestoreendpoint)

***

### gcpFirestoreProjectId? {#gcpfirestoreprojectid}

> `optional` **gcpFirestoreProjectId?**: `string`

GCP Firestore project id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpFirestoreProjectId`](IEngineServerEnvironmentVariables.md#gcpfirestoreprojectid)

***

### scylladbHosts? {#scylladbhosts}

> `optional` **scylladbHosts?**: `string`

ScyllaDB hosts as comma separated string.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`scylladbHosts`](IEngineServerEnvironmentVariables.md#scylladbhosts)

***

### scylladbKeyspace? {#scylladbkeyspace}

> `optional` **scylladbKeyspace?**: `string`

ScyllaDB keyspace.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`scylladbKeyspace`](IEngineServerEnvironmentVariables.md#scylladbkeyspace)

***

### scylladbLocalDataCenter? {#scylladblocaldatacenter}

> `optional` **scylladbLocalDataCenter?**: `string`

ScyllaDB local data center.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`scylladbLocalDataCenter`](IEngineServerEnvironmentVariables.md#scylladblocaldatacenter)

***

### scylladbPort? {#scylladbport}

> `optional` **scylladbPort?**: `string`

ScyllaDB port.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`scylladbPort`](IEngineServerEnvironmentVariables.md#scylladbport)

***

### mySqlHost? {#mysqlhost}

> `optional` **mySqlHost?**: `string`

MySQL host.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mySqlHost`](IEngineServerEnvironmentVariables.md#mysqlhost)

***

### mySqlPort? {#mysqlport}

> `optional` **mySqlPort?**: `number`

MySQL port.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mySqlPort`](IEngineServerEnvironmentVariables.md#mysqlport)

***

### mySqlUser? {#mysqluser}

> `optional` **mySqlUser?**: `string`

MySQL username.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mySqlUser`](IEngineServerEnvironmentVariables.md#mysqluser)

***

### mySqlPassword? {#mysqlpassword}

> `optional` **mySqlPassword?**: `string`

MySQL password.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mySqlPassword`](IEngineServerEnvironmentVariables.md#mysqlpassword)

***

### mySqlDatabase? {#mysqldatabase}

> `optional` **mySqlDatabase?**: `string`

MySQL Database.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mySqlDatabase`](IEngineServerEnvironmentVariables.md#mysqldatabase)

***

### mongoDbHost? {#mongodbhost}

> `optional` **mongoDbHost?**: `string`

MongoDB host.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mongoDbHost`](IEngineServerEnvironmentVariables.md#mongodbhost)

***

### mongoDbPort? {#mongodbport}

> `optional` **mongoDbPort?**: `number`

MongoDB port.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mongoDbPort`](IEngineServerEnvironmentVariables.md#mongodbport)

***

### mongoDbUser? {#mongodbuser}

> `optional` **mongoDbUser?**: `string`

MongoDB username.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mongoDbUser`](IEngineServerEnvironmentVariables.md#mongodbuser)

***

### mongoDbPassword? {#mongodbpassword}

> `optional` **mongoDbPassword?**: `string`

MongoDB password.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mongoDbPassword`](IEngineServerEnvironmentVariables.md#mongodbpassword)

***

### mongoDbDatabase? {#mongodbdatabase}

> `optional` **mongoDbDatabase?**: `string`

MongoDB Database.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mongoDbDatabase`](IEngineServerEnvironmentVariables.md#mongodbdatabase)

***

### postgreSqlHost? {#postgresqlhost}

> `optional` **postgreSqlHost?**: `string`

PostgreSQl host.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`postgreSqlHost`](IEngineServerEnvironmentVariables.md#postgresqlhost)

***

### postgreSqlPort? {#postgresqlport}

> `optional` **postgreSqlPort?**: `number`

PostgreSQl port.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`postgreSqlPort`](IEngineServerEnvironmentVariables.md#postgresqlport)

***

### postgreSqlUser? {#postgresqluser}

> `optional` **postgreSqlUser?**: `string`

PostgreSQl username.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`postgreSqlUser`](IEngineServerEnvironmentVariables.md#postgresqluser)

***

### postgreSqlPassword? {#postgresqlpassword}

> `optional` **postgreSqlPassword?**: `string`

PostgreSQl password.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`postgreSqlPassword`](IEngineServerEnvironmentVariables.md#postgresqlpassword)

***

### postgreSqlDatabase? {#postgresqldatabase}

> `optional` **postgreSqlDatabase?**: `string`

PostgreSQl Database.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`postgreSqlDatabase`](IEngineServerEnvironmentVariables.md#postgresqldatabase)

***

### ipfsBearerToken? {#ipfsbearertoken}

> `optional` **ipfsBearerToken?**: `string`

The security token for accessing IPFS API.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`ipfsBearerToken`](IEngineServerEnvironmentVariables.md#ipfsbearertoken)

***

### ipfsApiUrl? {#ipfsapiurl}

> `optional` **ipfsApiUrl?**: `string`

The url for accessing IPFS API.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`ipfsApiUrl`](IEngineServerEnvironmentVariables.md#ipfsapiurl)

***

### blobStorageConnectorType? {#blobstorageconnectortype}

> `optional` **blobStorageConnectorType?**: `string`

The type of the entity storage to create, comma separate for more than one connector.
values: memory, file, ipfs, aws-s3, azure-storage, gcp-storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`blobStorageConnectorType`](IEngineServerEnvironmentVariables.md#blobstorageconnectortype)

***

### blobStorageConnectorDefault? {#blobstorageconnectordefault}

> `optional` **blobStorageConnectorDefault?**: `string`

The default blob storage connector to use, defaults to the first one in the list.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`blobStorageConnectorDefault`](IEngineServerEnvironmentVariables.md#blobstorageconnectordefault)

***

### blobStorageEnableEncryption? {#blobstorageenableencryption}

> `optional` **blobStorageEnableEncryption?**: `string`

Enable encryption for the blob storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`blobStorageEnableEncryption`](IEngineServerEnvironmentVariables.md#blobstorageenableencryption)

***

### blobStorageEncryptionKeyId? {#blobstorageencryptionkeyid}

> `optional` **blobStorageEncryptionKeyId?**: `string`

The id of the encryption key for the blob storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`blobStorageEncryptionKeyId`](IEngineServerEnvironmentVariables.md#blobstorageencryptionkeyid)

***

### blobStoragePrefix? {#blobstorageprefix}

> `optional` **blobStoragePrefix?**: `string`

A prefix for all the blobs in blob-storage, can be empty.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`blobStoragePrefix`](IEngineServerEnvironmentVariables.md#blobstorageprefix)

***

### awsS3Region? {#awss3region}

> `optional` **awsS3Region?**: `string`

AWS S3 region.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsS3Region`](IEngineServerEnvironmentVariables.md#awss3region)

***

### awsS3BucketName? {#awss3bucketname}

> `optional` **awsS3BucketName?**: `string`

AWS S3 bucket name.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsS3BucketName`](IEngineServerEnvironmentVariables.md#awss3bucketname)

***

### awsS3AuthMode? {#awss3authmode}

> `optional` **awsS3AuthMode?**: `string`

AWS S3 auth mode, either credentials or pod, defaults to credentials.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsS3AuthMode`](IEngineServerEnvironmentVariables.md#awss3authmode)

***

### awsS3AccessKeyId? {#awss3accesskeyid}

> `optional` **awsS3AccessKeyId?**: `string`

AWS S3 access key id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsS3AccessKeyId`](IEngineServerEnvironmentVariables.md#awss3accesskeyid)

***

### awsS3SecretAccessKey? {#awss3secretaccesskey}

> `optional` **awsS3SecretAccessKey?**: `string`

AWS S3 secret access key.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsS3SecretAccessKey`](IEngineServerEnvironmentVariables.md#awss3secretaccesskey)

***

### awsS3Endpoint? {#awss3endpoint}

> `optional` **awsS3Endpoint?**: `string`

AWS S3 endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsS3Endpoint`](IEngineServerEnvironmentVariables.md#awss3endpoint)

***

### azureStorageAccountKey? {#azurestorageaccountkey}

> `optional` **azureStorageAccountKey?**: `string`

Azure Storage account key.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureStorageAccountKey`](IEngineServerEnvironmentVariables.md#azurestorageaccountkey)

***

### azureStorageAccountName? {#azurestorageaccountname}

> `optional` **azureStorageAccountName?**: `string`

Azure Storage account name.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureStorageAccountName`](IEngineServerEnvironmentVariables.md#azurestorageaccountname)

***

### azureStorageContainerName? {#azurestoragecontainername}

> `optional` **azureStorageContainerName?**: `string`

Azure Storage container.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureStorageContainerName`](IEngineServerEnvironmentVariables.md#azurestoragecontainername)

***

### azureStorageEndpoint? {#azurestorageendpoint}

> `optional` **azureStorageEndpoint?**: `string`

Azure Storage endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`azureStorageEndpoint`](IEngineServerEnvironmentVariables.md#azurestorageendpoint)

***

### gcpStorageBucketName? {#gcpstoragebucketname}

> `optional` **gcpStorageBucketName?**: `string`

GCP Storage bucket.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpStorageBucketName`](IEngineServerEnvironmentVariables.md#gcpstoragebucketname)

***

### gcpStorageCredentials? {#gcpstoragecredentials}

> `optional` **gcpStorageCredentials?**: `string`

GCP Storage credentials.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpStorageCredentials`](IEngineServerEnvironmentVariables.md#gcpstoragecredentials)

***

### gcpStorageEndpoint? {#gcpstorageendpoint}

> `optional` **gcpStorageEndpoint?**: `string`

GCP Storage endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpStorageEndpoint`](IEngineServerEnvironmentVariables.md#gcpstorageendpoint)

***

### gcpStorageProjectId? {#gcpstorageprojectid}

> `optional` **gcpStorageProjectId?**: `string`

GCP Storage project id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpStorageProjectId`](IEngineServerEnvironmentVariables.md#gcpstorageprojectid)

***

### vaultConnector? {#vaultconnector}

> `optional` **vaultConnector?**: `string`

The type of the default vault connector: entity-storage, hashicorp.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`vaultConnector`](IEngineServerEnvironmentVariables.md#vaultconnector)

***

### vaultPrefix? {#vaultprefix}

> `optional` **vaultPrefix?**: `string`

Prefix to prepend to entries in the vault.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`vaultPrefix`](IEngineServerEnvironmentVariables.md#vaultprefix)

***

### hashicorpVaultToken? {#hashicorpvaulttoken}

> `optional` **hashicorpVaultToken?**: `string`

Hashicorp Vault token.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`hashicorpVaultToken`](IEngineServerEnvironmentVariables.md#hashicorpvaulttoken)

***

### hashicorpVaultEndpoint? {#hashicorpvaultendpoint}

> `optional` **hashicorpVaultEndpoint?**: `string`

Hashicorp Vault endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`hashicorpVaultEndpoint`](IEngineServerEnvironmentVariables.md#hashicorpvaultendpoint)

***

### loggingConnector? {#loggingconnector}

> `optional` **loggingConnector?**: `string`

The type of logging task connector, can be a comma separated list: console, entity-storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`loggingConnector`](IEngineServerEnvironmentVariables.md#loggingconnector)

***

### loggingBatchSize? {#loggingbatchsize}

> `optional` **loggingBatchSize?**: `string`

The batch size for the logging task, set to 1 for no batching.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`loggingBatchSize`](IEngineServerEnvironmentVariables.md#loggingbatchsize)

***

### loggingBatchFlushIntervalSeconds? {#loggingbatchflushintervalseconds}

> `optional` **loggingBatchFlushIntervalSeconds?**: `string`

The batch flush interval in seconds for the logging task, how often to flush the logs when using batching, defaults to 5 seconds.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`loggingBatchFlushIntervalSeconds`](IEngineServerEnvironmentVariables.md#loggingbatchflushintervalseconds)

***

### loggingSilentComponents? {#loggingsilentcomponents}

> `optional` **loggingSilentComponents?**: `string`

A list of components to exclude from logging, can be a comma separated list of component Class names e.g. "ComponentA,ComponentB".

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`loggingSilentComponents`](IEngineServerEnvironmentVariables.md#loggingsilentcomponents)

***

### eventBusConnector? {#eventbusconnector}

> `optional` **eventBusConnector?**: `string`

The type of event bus connector: local.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`eventBusConnector`](IEngineServerEnvironmentVariables.md#eventbusconnector)

***

### eventBusComponent? {#eventbuscomponent}

> `optional` **eventBusComponent?**: `string`

The type of event bus component: service.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`eventBusComponent`](IEngineServerEnvironmentVariables.md#eventbuscomponent)

***

### messagingEnabled? {#messagingenabled}

> `optional` **messagingEnabled?**: `string`

Are the messaging components enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`messagingEnabled`](IEngineServerEnvironmentVariables.md#messagingenabled)

***

### awsSesRegion? {#awssesregion}

> `optional` **awsSesRegion?**: `string`

AWS SES region.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsSesRegion`](IEngineServerEnvironmentVariables.md#awssesregion)

***

### awsSesAuthMode? {#awssesauthmode}

> `optional` **awsSesAuthMode?**: `string`

AWS SES auth mode, either credentials or pod, defaults to credentials.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsSesAuthMode`](IEngineServerEnvironmentVariables.md#awssesauthmode)

***

### awsSesSecretAccessKey? {#awssessecretaccesskey}

> `optional` **awsSesSecretAccessKey?**: `string`

AWS SES secret access key.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsSesSecretAccessKey`](IEngineServerEnvironmentVariables.md#awssessecretaccesskey)

***

### awsSesAccessKeyId? {#awssesaccesskeyid}

> `optional` **awsSesAccessKeyId?**: `string`

AWS SES access key id.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsSesAccessKeyId`](IEngineServerEnvironmentVariables.md#awssesaccesskeyid)

***

### awsSesEndpoint? {#awssesendpoint}

> `optional` **awsSesEndpoint?**: `string`

AWS SES endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsSesEndpoint`](IEngineServerEnvironmentVariables.md#awssesendpoint)

***

### awsMessagingPushNotificationApplications? {#awsmessagingpushnotificationapplications}

> `optional` **awsMessagingPushNotificationApplications?**: `string`

The applications for the push notifications reference a separate json with @json: prefix.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`awsMessagingPushNotificationApplications`](IEngineServerEnvironmentVariables.md#awsmessagingpushnotificationapplications)

***

### messagingEmailConnector? {#messagingemailconnector}

> `optional` **messagingEmailConnector?**: `string`

The type of messaging email connector: entity-storage, aws.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`messagingEmailConnector`](IEngineServerEnvironmentVariables.md#messagingemailconnector)

***

### messagingSmsConnector? {#messagingsmsconnector}

> `optional` **messagingSmsConnector?**: `string`

The type of messaging sms connector: entity-storage, aws.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`messagingSmsConnector`](IEngineServerEnvironmentVariables.md#messagingsmsconnector)

***

### messagingPushNotificationConnector? {#messagingpushnotificationconnector}

> `optional` **messagingPushNotificationConnector?**: `string`

The type of messaging push notification connector: entity-storage, aws.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`messagingPushNotificationConnector`](IEngineServerEnvironmentVariables.md#messagingpushnotificationconnector)

***

### telemetryConnector? {#telemetryconnector}

> `optional` **telemetryConnector?**: `string`

The type of telemetry connector: entity-storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`telemetryConnector`](IEngineServerEnvironmentVariables.md#telemetryconnector)

***

### openTelemetryMeterName? {#opentelemetrymetername}

> `optional` **openTelemetryMeterName?**: `string`

The name of the Open Telemetry meter to use, only required if using open-telemetry as telemetry connector, defaults to twin-node.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`openTelemetryMeterName`](IEngineServerEnvironmentVariables.md#opentelemetrymetername)

***

### openTelemetryMeterVersion? {#opentelemetrymeterversion}

> `optional` **openTelemetryMeterVersion?**: `string`

The version of the Open Telemetry metrics specification to use, only required if using open-telemetry as telemetry connector, defaults to 1.0.0.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`openTelemetryMeterVersion`](IEngineServerEnvironmentVariables.md#opentelemetrymeterversion)

***

### openTelemetryReader? {#opentelemetryreader}

> `optional` **openTelemetryReader?**: `string`

The type of Open Telemetry metric reader to use, only required if using open-telemetry as telemetry connector, values: prometheus.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`openTelemetryReader`](IEngineServerEnvironmentVariables.md#opentelemetryreader)

***

### openTelemetryPrometheusPort? {#opentelemetryprometheusport}

> `optional` **openTelemetryPrometheusPort?**: `string`

The port to use for the Open Telemetry Prometheus metrics server, only required if using open-telemetry as telemetry connector and prometheus as reader, defaults to 9464.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`openTelemetryPrometheusPort`](IEngineServerEnvironmentVariables.md#opentelemetryprometheusport)

***

### telemetryMetricsCollectorIntervalSeconds? {#telemetrymetricscollectorintervalseconds}

> `optional` **telemetryMetricsCollectorIntervalSeconds?**: `string`

Polling interval in seconds for the telemetry metrics collector. Defaults to 60.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`telemetryMetricsCollectorIntervalSeconds`](IEngineServerEnvironmentVariables.md#telemetrymetricscollectorintervalseconds)

***

### telemetryMetricsProducers? {#telemetrymetricsproducers}

> `optional` **telemetryMetricsProducers?**: `string`

The type of telemetry metrics producers, can be a comma separated list: system, process.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`telemetryMetricsProducers`](IEngineServerEnvironmentVariables.md#telemetrymetricsproducers)

***

### telemetryMetricsProducerMaxHistory? {#telemetrymetricsproducermaxhistory}

> `optional` **telemetryMetricsProducerMaxHistory?**: `string`

Maximum number of values retained per telemetry metric (count-based history cap). Defaults to 1440.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`telemetryMetricsProducerMaxHistory`](IEngineServerEnvironmentVariables.md#telemetrymetricsproducermaxhistory)

***

### faucetConnector? {#faucetconnector}

> `optional` **faucetConnector?**: `string`

The type of faucet connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`faucetConnector`](IEngineServerEnvironmentVariables.md#faucetconnector)

***

### walletConnector? {#walletconnector}

> `optional` **walletConnector?**: `string`

The type of wallet connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`walletConnector`](IEngineServerEnvironmentVariables.md#walletconnector)

***

### nftConnector? {#nftconnector}

> `optional` **nftConnector?**: `string`

The type of NFT connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`nftConnector`](IEngineServerEnvironmentVariables.md#nftconnector)

***

### nftPackageId? {#nftpackageid}

> `optional` **nftPackageId?**: `string`

The NFT deployed package id, for custom deployments.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`nftPackageId`](IEngineServerEnvironmentVariables.md#nftpackageid)

***

### notarizationConnector? {#notarizationconnector}

> `optional` **notarizationConnector?**: `string`

The type of notarization connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`notarizationConnector`](IEngineServerEnvironmentVariables.md#notarizationconnector)

***

### identityConnector? {#identityconnector}

> `optional` **identityConnector?**: `string`

The type of identity connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`identityConnector`](IEngineServerEnvironmentVariables.md#identityconnector)

***

### identityWalletAddressIndex? {#identitywalletaddressindex}

> `optional` **identityWalletAddressIndex?**: `string`

The index of the wallet address to use, defaults to 0.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`identityWalletAddressIndex`](IEngineServerEnvironmentVariables.md#identitywalletaddressindex)

***

### identityResolverConnector? {#identityresolverconnector}

> `optional` **identityResolverConnector?**: `string`

The type of identity resolver connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`identityResolverConnector`](IEngineServerEnvironmentVariables.md#identityresolverconnector)

***

### iotaFaucetEndpoint? {#iotafaucetendpoint}

> `optional` **iotaFaucetEndpoint?**: `string`

IOTA Faucet Endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaFaucetEndpoint`](IEngineServerEnvironmentVariables.md#iotafaucetendpoint)

***

### iotaNodeEndpoint? {#iotanodeendpoint}

> `optional` **iotaNodeEndpoint?**: `string`

IOTA Node Endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaNodeEndpoint`](IEngineServerEnvironmentVariables.md#iotanodeendpoint)

***

### iotaNetwork? {#iotanetwork}

> `optional` **iotaNetwork?**: `string`

IOTA network.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaNetwork`](IEngineServerEnvironmentVariables.md#iotanetwork)

***

### iotaCoinType? {#iotacointype}

> `optional` **iotaCoinType?**: `string`

IOTA coin type.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaCoinType`](IEngineServerEnvironmentVariables.md#iotacointype)

***

### iotaExplorerEndpoint? {#iotaexplorerendpoint}

> `optional` **iotaExplorerEndpoint?**: `string`

IOTA Explorer Endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaExplorerEndpoint`](IEngineServerEnvironmentVariables.md#iotaexplorerendpoint)

***

### iotaGasStationEndpoint? {#iotagasstationendpoint}

> `optional` **iotaGasStationEndpoint?**: `string`

IOTA Gas Station Endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaGasStationEndpoint`](IEngineServerEnvironmentVariables.md#iotagasstationendpoint)

***

### iotaGasStationAuthToken? {#iotagasstationauthtoken}

> `optional` **iotaGasStationAuthToken?**: `string`

IOTA Gas Station Authentication Token.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaGasStationAuthToken`](IEngineServerEnvironmentVariables.md#iotagasstationauthtoken)

***

### iotaIdentityPackageId? {#iotaidentitypackageid}

> `optional` **iotaIdentityPackageId?**: `string`

The IOTA Identity deployed package id, for custom deployments.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`iotaIdentityPackageId`](IEngineServerEnvironmentVariables.md#iotaidentitypackageid)

***

### universalResolverEndpoint? {#universalresolverendpoint}

> `optional` **universalResolverEndpoint?**: `string`

Universal Resolver Endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`universalResolverEndpoint`](IEngineServerEnvironmentVariables.md#universalresolverendpoint)

***

### identityProfileConnector? {#identityprofileconnector}

> `optional` **identityProfileConnector?**: `string`

The type of identity profile connector: entity-storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`identityProfileConnector`](IEngineServerEnvironmentVariables.md#identityprofileconnector)

***

### immutableProofVerificationMethodId? {#immutableproofverificationmethodid}

> `optional` **immutableProofVerificationMethodId?**: `string`

The identity verification method id to use with immutable proofs.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`immutableProofVerificationMethodId`](IEngineServerEnvironmentVariables.md#immutableproofverificationmethodid)

***

### attestationConnector? {#attestationconnector}

> `optional` **attestationConnector?**: `string`

The type of attestation connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`attestationConnector`](IEngineServerEnvironmentVariables.md#attestationconnector)

***

### attestationVerificationMethodId? {#attestationverificationmethodid}

> `optional` **attestationVerificationMethodId?**: `string`

The identity verification method id to use with attestation.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`attestationVerificationMethodId`](IEngineServerEnvironmentVariables.md#attestationverificationmethodid)

***

### dataProcessingEnabled? {#dataprocessingenabled}

> `optional` **dataProcessingEnabled?**: `string`

Is the data processing enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataProcessingEnabled`](IEngineServerEnvironmentVariables.md#dataprocessingenabled)

***

### dataConverterConnectors? {#dataconverterconnectors}

> `optional` **dataConverterConnectors?**: `string`

The type of the default data converters, can be a comma separated list: json, xml.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataConverterConnectors`](IEngineServerEnvironmentVariables.md#dataconverterconnectors)

***

### dataExtractorConnectors? {#dataextractorconnectors}

> `optional` **dataExtractorConnectors?**: `string`

The type of the default data extractor, can be a comma separated list: json-path.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataExtractorConnectors`](IEngineServerEnvironmentVariables.md#dataextractorconnectors)

***

### taskSchedulerEnabled? {#taskschedulerenabled}

> `optional` **taskSchedulerEnabled?**: `string`

Enable the task scheduler regardless of which other components are active, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`taskSchedulerEnabled`](IEngineServerEnvironmentVariables.md#taskschedulerenabled)

***

### auditableItemGraphEnabled? {#auditableitemgraphenabled}

> `optional` **auditableItemGraphEnabled?**: `string`

Is the auditable item graph enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`auditableItemGraphEnabled`](IEngineServerEnvironmentVariables.md#auditableitemgraphenabled)

***

### auditableItemStreamEnabled? {#auditableitemstreamenabled}

> `optional` **auditableItemStreamEnabled?**: `string`

Is the auditable item stream enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`auditableItemStreamEnabled`](IEngineServerEnvironmentVariables.md#auditableitemstreamenabled)

***

### documentManagementEnabled? {#documentmanagementenabled}

> `optional` **documentManagementEnabled?**: `string`

Is the document management enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`documentManagementEnabled`](IEngineServerEnvironmentVariables.md#documentmanagementenabled)

***

### federatedCatalogueEnabled? {#federatedcatalogueenabled}

> `optional` **federatedCatalogueEnabled?**: `string`

Enable the federated catalogue, defaults to false, automatically enabled if remote endpoint, filters or dataspace is enabled.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`federatedCatalogueEnabled`](IEngineServerEnvironmentVariables.md#federatedcatalogueenabled)

***

### federatedCatalogueFilters? {#federatedcataloguefilters}

> `optional` **federatedCatalogueFilters?**: `string`

Federated catalog filters, command separated list of filters to add.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`federatedCatalogueFilters`](IEngineServerEnvironmentVariables.md#federatedcataloguefilters)

***

### federatedCatalogueRemoteEndpoint? {#federatedcatalogueremoteendpoint}

> `optional` **federatedCatalogueRemoteEndpoint?**: `string`

Federated catalog remote endpoint, if set will use a REST client instead of local service.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`federatedCatalogueRemoteEndpoint`](IEngineServerEnvironmentVariables.md#federatedcatalogueremoteendpoint)

***

### trustGenerators? {#trustgenerators}

> `optional` **trustGenerators?**: `string`

The trust generators to add to the factory, comma separated list.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`trustGenerators`](IEngineServerEnvironmentVariables.md#trustgenerators)

***

### trustVerifiers? {#trustverifiers}

> `optional` **trustVerifiers?**: `string`

The trust verifiers to add to the factory, comma separated list.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`trustVerifiers`](IEngineServerEnvironmentVariables.md#trustverifiers)

***

### trustVerificationMethodId? {#trustverificationmethodid}

> `optional` **trustVerificationMethodId?**: `string`

The verification method to use for trust identities.
Defaults to trust-assertion.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`trustVerificationMethodId`](IEngineServerEnvironmentVariables.md#trustverificationmethodid)

***

### trustJwtTtlSeconds? {#trustjwtttlseconds}

> `optional` **trustJwtTtlSeconds?**: `string`

The trust time to live for generating JWTs.
Defaults to undefined for never expiring.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`trustJwtTtlSeconds`](IEngineServerEnvironmentVariables.md#trustjwtttlseconds)

***

### trustIdentitiesAllow? {#trustidentitiesallow}

> `optional` **trustIdentitiesAllow?**: `string`

The allow lists for the trust identity verifier, comma separated list of identities.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`trustIdentitiesAllow`](IEngineServerEnvironmentVariables.md#trustidentitiesallow)

***

### trustIdentitiesDeny? {#trustidentitiesdeny}

> `optional` **trustIdentitiesDeny?**: `string`

The deny lists for the trust identity verifier, comma separated list of identities.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`trustIdentitiesDeny`](IEngineServerEnvironmentVariables.md#trustidentitiesdeny)

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

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementCallbackPath`](IEngineServerEnvironmentVariables.md#rightsmanagementcallbackpath)

***

### rightsManagementPolicyInformationSources? {#rightsmanagementpolicyinformationsources}

> `optional` **rightsManagementPolicyInformationSources?**: `string`

The rights management policy information sources to add to the factory.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementPolicyInformationSources`](IEngineServerEnvironmentVariables.md#rightsmanagementpolicyinformationsources)

***

### rightsManagementPolicyNegotiators? {#rightsmanagementpolicynegotiators}

> `optional` **rightsManagementPolicyNegotiators?**: `string`

The rights management policy negotiators sources to add to the factory.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementPolicyNegotiators`](IEngineServerEnvironmentVariables.md#rightsmanagementpolicynegotiators)

***

### rightsManagementPolicyRequesters? {#rightsmanagementpolicyrequesters}

> `optional` **rightsManagementPolicyRequesters?**: `string`

The rights management policy requesters to add to the factory.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementPolicyRequesters`](IEngineServerEnvironmentVariables.md#rightsmanagementpolicyrequesters)

***

### rightsManagementPolicyExecutionActions? {#rightsmanagementpolicyexecutionactions}

> `optional` **rightsManagementPolicyExecutionActions?**: `string`

The rights management policy execution actions to add to the factory.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementPolicyExecutionActions`](IEngineServerEnvironmentVariables.md#rightsmanagementpolicyexecutionactions)

***

### rightsManagementPolicyEnforcementProcessors? {#rightsmanagementpolicyenforcementprocessors}

> `optional` **rightsManagementPolicyEnforcementProcessors?**: `string`

The rights management policy enforcement processors to add to the factory.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementPolicyEnforcementProcessors`](IEngineServerEnvironmentVariables.md#rightsmanagementpolicyenforcementprocessors)

***

### rightsManagementPolicyArbiters? {#rightsmanagementpolicyarbiters}

> `optional` **rightsManagementPolicyArbiters?**: `string`

The rights management policy arbiters to add to the factory.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementPolicyArbiters`](IEngineServerEnvironmentVariables.md#rightsmanagementpolicyarbiters)

***

### rightsManagementPolicyObligationEnforcers? {#rightsmanagementpolicyobligationenforcers}

> `optional` **rightsManagementPolicyObligationEnforcers?**: `string`

The rights management policy obligation enforcers to add to the factory.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementPolicyObligationEnforcers`](IEngineServerEnvironmentVariables.md#rightsmanagementpolicyobligationenforcers)

***

### dataspaceEnabled? {#dataspaceenabled}

> `optional` **dataspaceEnabled?**: `string`

Is the dataspace enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataspaceEnabled`](IEngineServerEnvironmentVariables.md#dataspaceenabled)

***

### dataspaceRetainActivityLogsFor? {#dataspaceretainactivitylogsfor}

> `optional` **dataspaceRetainActivityLogsFor?**: `string`

The length of time to retain the activity logs for in minutes, set to -1 to keep forever.

#### Default

```ts
10
```

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataspaceRetainActivityLogsFor`](IEngineServerEnvironmentVariables.md#dataspaceretainactivitylogsfor)

***

### dataspaceActivityLogsCleanupInterval? {#dataspaceactivitylogscleanupinterval}

> `optional` **dataspaceActivityLogsCleanupInterval?**: `string`

The interval for cleaning up the activity logs.

#### Default

```ts
60
```

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataspaceActivityLogsCleanupInterval`](IEngineServerEnvironmentVariables.md#dataspaceactivitylogscleanupinterval)

***

### dataspaceDataPlanePath? {#dataspacedataplanepath}

> `optional` **dataspaceDataPlanePath?**: `string`

The data plane path for PULL transfers (path only, not full URL).
Will be combined with public origin.
Required if PULL transfers should be supported.
Example: "dataspace/entities"

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataspaceDataPlanePath`](IEngineServerEnvironmentVariables.md#dataspacedataplanepath)

***

### healthEnabled? {#healthenabled}

> `optional` **healthEnabled?**: `string`

Are the health components enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`healthEnabled`](IEngineServerEnvironmentVariables.md#healthenabled)

***

### healthIntervalSeconds? {#healthintervalseconds}

> `optional` **healthIntervalSeconds?**: `string`

The interval in seconds for performing health checks, defaults to 60.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`healthIntervalSeconds`](IEngineServerEnvironmentVariables.md#healthintervalseconds)

***

### healthStartupIntervalSeconds? {#healthstartupintervalseconds}

> `optional` **healthStartupIntervalSeconds?**: `string`

The interval in seconds for performing health checks at startup, defaults to 2.
This allows components that take a long time to initialize to be healthy before the first health check is performed.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`healthStartupIntervalSeconds`](IEngineServerEnvironmentVariables.md#healthstartupintervalseconds)

***

### automationActionTypes? {#automationactiontypes}

> `optional` **automationActionTypes?**: `string`

The type of the automation action to create, comma separate for more than one connector.
values: fetch

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`automationActionTypes`](IEngineServerEnvironmentVariables.md#automationactiontypes)

***

### extensions? {#extensions}

> `optional` **extensions?**: `string`

A comma separated list of additional node extensions to load, the initialiseExtension method will be called for each extension.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`extensions`](IEngineServerEnvironmentVariables.md#extensions)

***

### port? {#port}

> `optional` **port?**: `string`

The port to serve the API from.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`port`](IEngineServerEnvironmentVariables.md#port)

***

### host? {#host}

> `optional` **host?**: `string`

The host to serve the API from.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`host`](IEngineServerEnvironmentVariables.md#host)

***

### corsOrigins? {#corsorigins}

> `optional` **corsOrigins?**: `string`

The CORS origins to allow, defaults to *.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`corsOrigins`](IEngineServerEnvironmentVariables.md#corsorigins)

***

### httpMethods? {#httpmethods}

> `optional` **httpMethods?**: `string`

The CORS methods to allow, defaults to GET, POST, PUT, DELETE, OPTIONS.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`httpMethods`](IEngineServerEnvironmentVariables.md#httpmethods)

***

### httpAllowedHeaders? {#httpallowedheaders}

> `optional` **httpAllowedHeaders?**: `string`

The CORS headers to allow.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`httpAllowedHeaders`](IEngineServerEnvironmentVariables.md#httpallowedheaders)

***

### httpExposedHeaders? {#httpexposedheaders}

> `optional` **httpExposedHeaders?**: `string`

The CORS headers to expose.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`httpExposedHeaders`](IEngineServerEnvironmentVariables.md#httpexposedheaders)

***

### publicOrigin? {#publicorigin}

> `optional` **publicOrigin?**: `string`

The public origin URL for the API e.g. https://api.example.com:1234

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`publicOrigin`](IEngineServerEnvironmentVariables.md#publicorigin)

***

### authAdminProcessorType? {#authadminprocessortype}

> `optional` **authAdminProcessorType?**: `string`

The type of auth admin processor to use on the API: entity-storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`authAdminProcessorType`](IEngineServerEnvironmentVariables.md#authadminprocessortype)

***

### authProcessorType? {#authprocessortype}

> `optional` **authProcessorType?**: `string`

The type of auth processor to use on the API: entity-storage.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`authProcessorType`](IEngineServerEnvironmentVariables.md#authprocessortype)

***

### authSigningKeyId? {#authsigningkeyid}

> `optional` **authSigningKeyId?**: `string`

The id of the key in the vault to use for signing in auth operations.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`authSigningKeyId`](IEngineServerEnvironmentVariables.md#authsigningkeyid)

***

### authApiKeyHeader? {#authapikeyheader}

> `optional` **authApiKeyHeader?**: `string`

The HTTP header name used to pass the API key on requests, defaults to x-api-key.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`authApiKeyHeader`](IEngineServerEnvironmentVariables.md#authapikeyheader)

***

### mimeTypeProcessors? {#mimetypeprocessors}

> `optional` **mimeTypeProcessors?**: `string`

Additional MIME type processors to include, comma separated.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`mimeTypeProcessors`](IEngineServerEnvironmentVariables.md#mimetypeprocessors)

***

### routeLoggingIncludeBody? {#routeloggingincludebody}

> `optional` **routeLoggingIncludeBody?**: `string`

Include the body in the REST logging output, useful for debugging.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`routeLoggingIncludeBody`](IEngineServerEnvironmentVariables.md#routeloggingincludebody)

***

### routeLoggingFullBase64? {#routeloggingfullbase64}

> `optional` **routeLoggingFullBase64?**: `string`

Include the full base 64 output in the REST logging output, useful for debugging.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`routeLoggingFullBase64`](IEngineServerEnvironmentVariables.md#routeloggingfullbase64)

***

### routeLoggingObfuscateProperties? {#routeloggingobfuscateproperties}

> `optional` **routeLoggingObfuscateProperties?**: `string`

List of properties to obfuscate in the REST logging output, comma separated.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`routeLoggingObfuscateProperties`](IEngineServerEnvironmentVariables.md#routeloggingobfuscateproperties)

***

### extensionsMaxSizeMb? {#extensionsmaxsizemb}

> `optional` **extensionsMaxSizeMb?**: `number`

Maximum size in MB for HTTPS extensions downloads.

#### Default

```ts
10
```

***

### extensionsClearCache? {#extensionsclearcache}

> `optional` **extensionsClearCache?**: `boolean`

Whether to clear the extensions cache on startup.

#### Default

```ts
false
```

***

### extensionsCacheDirectory? {#extensionscachedirectory}

> `optional` **extensionsCacheDirectory?**: `string`

Custom directory for extensions cache storage.

#### Default

```ts
".tmp"
```

***

### extensionsCacheTtlHours? {#extensionscachettlhours}

> `optional` **extensionsCacheTtlHours?**: `number`

TTL in hours for HTTPS extensions cache.

#### Default

```ts
24
```

***

### extensionsForceRefresh? {#extensionsforcerefresh}

> `optional` **extensionsForceRefresh?**: `boolean`

Force refresh of all cached extensions.

#### Default

```ts
false
```
