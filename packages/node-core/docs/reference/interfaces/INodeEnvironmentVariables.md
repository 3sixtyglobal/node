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

### nodeIdentityEnabled? {#nodeidentityenabled}

> `optional` **nodeIdentityEnabled?**: `string`

Does the node have a unique ID, defaults to true.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`nodeIdentityEnabled`](IEngineServerEnvironmentVariables.md#nodeidentityenabled)

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

### gcpFirestoreApiEndpoint? {#gcpfirestoreapiendpoint}

> `optional` **gcpFirestoreApiEndpoint?**: `string`

GCP Firestore endpoint.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`gcpFirestoreApiEndpoint`](IEngineServerEnvironmentVariables.md#gcpfirestoreapiendpoint)

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

### blobStorageConnectorPublic? {#blobstorageconnectorpublic}

> `optional` **blobStorageConnectorPublic?**: `string`

Blog storage connector which has public access.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`blobStorageConnectorPublic`](IEngineServerEnvironmentVariables.md#blobstorageconnectorpublic)

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

### verifiableStorageConnector? {#verifiablestorageconnector}

> `optional` **verifiableStorageConnector?**: `string`

The type of verifiable storage connector: entity-storage, iota.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`verifiableStorageConnector`](IEngineServerEnvironmentVariables.md#verifiablestorageconnector)

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

### synchronisedStorageEnabled? {#synchronisedstorageenabled}

> `optional` **synchronisedStorageEnabled?**: `string`

Is the synchronised storage enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageEnabled`](IEngineServerEnvironmentVariables.md#synchronisedstorageenabled)

***

### synchronisedStorageTrustedUrl? {#synchronisedstoragetrustedurl}

> `optional` **synchronisedStorageTrustedUrl?**: `string`

Url which points to the api for a trusted synchronised storage node, not required if this is a trusted node.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageTrustedUrl`](IEngineServerEnvironmentVariables.md#synchronisedstoragetrustedurl)

***

### synchronisedStorageVerifiableStorageKeyId? {#synchronisedstorageverifiablestoragekeyid}

> `optional` **synchronisedStorageVerifiableStorageKeyId?**: `string`

The key for the smart contract which contains the verifiable storage pointer store for synchronised storage.
This only required if using a custom verifiable storage item, otherwise it will default to the network name.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageVerifiableStorageKeyId`](IEngineServerEnvironmentVariables.md#synchronisedstorageverifiablestoragekeyid)

***

### synchronisedStorageBlobStorageEncryptionKeyId? {#synchronisedstorageblobstorageencryptionkeyid}

> `optional` **synchronisedStorageBlobStorageEncryptionKeyId?**: `string`

The key from the vault which is used to encrypt the synchronised storage blobs.
Only required for trusted nodes, as regular nodes will request from the trusted nodes.
Defaults to synchronised-storage-blob-encryption

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageBlobStorageEncryptionKeyId`](IEngineServerEnvironmentVariables.md#synchronisedstorageblobstorageencryptionkeyid)

***

### synchronisedStorageBlobStorageKey? {#synchronisedstorageblobstoragekey}

> `optional` **synchronisedStorageBlobStorageKey?**: `string`

The key used for blob encryption, should be ChaCha20Poly1305 encoded as base64.
Only required for trusted nodes, as regular nodes will not write encrypted data.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageBlobStorageKey`](IEngineServerEnvironmentVariables.md#synchronisedstorageblobstoragekey)

***

### synchronisedStorageEntityUpdateIntervalMinutes? {#synchronisedstorageentityupdateintervalminutes}

> `optional` **synchronisedStorageEntityUpdateIntervalMinutes?**: `string`

How often to check for entity updates in minutes.

#### Default

```ts
5
```

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageEntityUpdateIntervalMinutes`](IEngineServerEnvironmentVariables.md#synchronisedstorageentityupdateintervalminutes)

***

### synchronisedStorageConsolidationIntervalMinutes? {#synchronisedstorageconsolidationintervalminutes}

> `optional` **synchronisedStorageConsolidationIntervalMinutes?**: `string`

Interval to perform consolidation of changesets, only used if this is a trusted node.

#### Default

```ts
60
```

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageConsolidationIntervalMinutes`](IEngineServerEnvironmentVariables.md#synchronisedstorageconsolidationintervalminutes)

***

### synchronisedStorageConsolidationBatchSize? {#synchronisedstorageconsolidationbatchsize}

> `optional` **synchronisedStorageConsolidationBatchSize?**: `string`

The number of entities to process in a single consolidation batch, only used if this is a trusted node.

#### Default

```ts
1000
```

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageConsolidationBatchSize`](IEngineServerEnvironmentVariables.md#synchronisedstorageconsolidationbatchsize)

***

### synchronisedStorageMaxConsolidations? {#synchronisedstoragemaxconsolidations}

> `optional` **synchronisedStorageMaxConsolidations?**: `string`

The maximum number of consolidations to keep in storage, only used if this is a trusted node.

#### Default

```ts
5
```

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`synchronisedStorageMaxConsolidations`](IEngineServerEnvironmentVariables.md#synchronisedstoragemaxconsolidations)

***

### federatedCatalogueEnabled? {#federatedcatalogueenabled}

> `optional` **federatedCatalogueEnabled?**: `string`

Is the federated catalogue enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`federatedCatalogueEnabled`](IEngineServerEnvironmentVariables.md#federatedcatalogueenabled)

***

### federatedCatalogueFilters? {#federatedcataloguefilters}

> `optional` **federatedCatalogueFilters?**: `string`

Federated catalog filters, command separated list of filters to add.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`federatedCatalogueFilters`](IEngineServerEnvironmentVariables.md#federatedcataloguefilters)

***

### trustEnabled? {#trustenabled}

> `optional` **trustEnabled?**: `string`

Is the trust management enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`trustEnabled`](IEngineServerEnvironmentVariables.md#trustenabled)

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

### rightsManagementEnabled? {#rightsmanagementenabled}

> `optional` **rightsManagementEnabled?**: `string`

Is the rights management enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`rightsManagementEnabled`](IEngineServerEnvironmentVariables.md#rightsmanagementenabled)

***

### rightsManagementCallbackPath? {#rightsmanagementcallbackpath}

> `optional` **rightsManagementCallbackPath?**: `string`

What is the callback path for rights management negotiations, will be combined with hosting public url e.g. /callback.

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

### backgroundTasksEnabled? {#backgroundtasksenabled}

> `optional` **backgroundTasksEnabled?**: `string`

Are background tasks enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`backgroundTasksEnabled`](IEngineServerEnvironmentVariables.md#backgroundtasksenabled)

***

### taskSchedulerEnabled? {#taskschedulerenabled}

> `optional` **taskSchedulerEnabled?**: `string`

Is the task scheduler enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`taskSchedulerEnabled`](IEngineServerEnvironmentVariables.md#taskschedulerenabled)

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

### dataspaceActivityLogsCleanUpInterval? {#dataspaceactivitylogscleanupinterval}

> `optional` **dataspaceActivityLogsCleanUpInterval?**: `string`

The interval for cleaning up the activity logs.

#### Default

```ts
60
```

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataspaceActivityLogsCleanUpInterval`](IEngineServerEnvironmentVariables.md#dataspaceactivitylogscleanupinterval)

***

### dataspaceDataPlanePath? {#dataspacedataplanepath}

> `optional` **dataspaceDataPlanePath?**: `string`

The data plane path for PULL transfers (path only, not full URL).
Will be combined with public origin from hosting component.
Required if PULL transfers should be supported.
Example: "dataspace/entities"

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`dataspaceDataPlanePath`](IEngineServerEnvironmentVariables.md#dataspacedataplanepath)

***

### automationEnabled? {#automationenabled}

> `optional` **automationEnabled?**: `string`

Are the automation components enabled, defaults to false.

#### Inherited from

[`IEngineServerEnvironmentVariables`](IEngineServerEnvironmentVariables.md).[`automationEnabled`](IEngineServerEnvironmentVariables.md#automationenabled)

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
