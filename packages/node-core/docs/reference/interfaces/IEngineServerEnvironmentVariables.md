# Interface: IEngineServerEnvironmentVariables

The engine server environment variables.

## Extends

- [`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md)

## Extended by

- [`INodeEnvironmentVariables`](INodeEnvironmentVariables.md)

## Properties

### debug? {#debug}

> `optional` **debug?**: `string`

Start the engine in debug mode.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`debug`](IEngineEnvironmentVariables.md#debug)

***

### silent? {#silent}

> `optional` **silent?**: `string`

Start the engine in silent mode.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`silent`](IEngineEnvironmentVariables.md#silent)

***

### storageFileRoot? {#storagefileroot}

> `optional` **storageFileRoot?**: `string`

The root directory for storing items like state file.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`storageFileRoot`](IEngineEnvironmentVariables.md#storagefileroot)

***

### stateFilename? {#statefilename}

> `optional` **stateFilename?**: `string`

The name of the state file.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`stateFilename`](IEngineEnvironmentVariables.md#statefilename)

***

### nodeIdentityEnabled? {#nodeidentityenabled}

> `optional` **nodeIdentityEnabled?**: `string`

Does the node have a unique ID, defaults to true.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`nodeIdentityEnabled`](IEngineEnvironmentVariables.md#nodeidentityenabled)

***

### tenantEnabled? {#tenantenabled}

> `optional` **tenantEnabled?**: `string`

Is multi-tenant support enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`tenantEnabled`](IEngineEnvironmentVariables.md#tenantenabled)

***

### entityStorageConnectorType? {#entitystorageconnectortype}

> `optional` **entityStorageConnectorType?**: `string`

The type of the entity storage to create, comma separate for more than one connector.
values: file, memory, aws-dynamodb, azure-cosmosdb, gcp-firestoredb, scylladb, mysql, mongodb, postgresql

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`entityStorageConnectorType`](IEngineEnvironmentVariables.md#entitystorageconnectortype)

***

### entityStorageConnectorDefault? {#entitystorageconnectordefault}

> `optional` **entityStorageConnectorDefault?**: `string`

The default entity storage connector to use, defaults to the first one in the list.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`entityStorageConnectorDefault`](IEngineEnvironmentVariables.md#entitystorageconnectordefault)

***

### entityStorageTablePrefix? {#entitystoragetableprefix}

> `optional` **entityStorageTablePrefix?**: `string`

A prefix for all the table in entity-storage, can be empty.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`entityStorageTablePrefix`](IEngineEnvironmentVariables.md#entitystoragetableprefix)

***

### awsDynamodbAuthMode? {#awsdynamodbauthmode}

> `optional` **awsDynamodbAuthMode?**: `string`

AWS DynamoDB auth mode, either credentials or pod.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsDynamodbAuthMode`](IEngineEnvironmentVariables.md#awsdynamodbauthmode)

***

### awsDynamodbAccessKeyId? {#awsdynamodbaccesskeyid}

> `optional` **awsDynamodbAccessKeyId?**: `string`

AWS Dynamo DB access key id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsDynamodbAccessKeyId`](IEngineEnvironmentVariables.md#awsdynamodbaccesskeyid)

***

### awsDynamodbEndpoint? {#awsdynamodbendpoint}

> `optional` **awsDynamodbEndpoint?**: `string`

AWS Dynamo DB Endpoint if running local instance.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsDynamodbEndpoint`](IEngineEnvironmentVariables.md#awsdynamodbendpoint)

***

### awsDynamodbRegion? {#awsdynamodbregion}

> `optional` **awsDynamodbRegion?**: `string`

AWS Dynamo DB region.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsDynamodbRegion`](IEngineEnvironmentVariables.md#awsdynamodbregion)

***

### awsDynamodbSecretAccessKey? {#awsdynamodbsecretaccesskey}

> `optional` **awsDynamodbSecretAccessKey?**: `string`

AWS Dynamo DB secret access key.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsDynamodbSecretAccessKey`](IEngineEnvironmentVariables.md#awsdynamodbsecretaccesskey)

***

### awsDynamodbConnectionTimeoutMs? {#awsdynamodbconnectiontimeoutms}

> `optional` **awsDynamodbConnectionTimeoutMs?**: `string`

AWS Dynamo DB connection timeout.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsDynamodbConnectionTimeoutMs`](IEngineEnvironmentVariables.md#awsdynamodbconnectiontimeoutms)

***

### azureCosmosdbKey? {#azurecosmosdbkey}

> `optional` **azureCosmosdbKey?**: `string`

Azure Cosmos DB key.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureCosmosdbKey`](IEngineEnvironmentVariables.md#azurecosmosdbkey)

***

### azureCosmosdbContainerId? {#azurecosmosdbcontainerid}

> `optional` **azureCosmosdbContainerId?**: `string`

Azure Cosmos DB container id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureCosmosdbContainerId`](IEngineEnvironmentVariables.md#azurecosmosdbcontainerid)

***

### azureCosmosdbDatabaseId? {#azurecosmosdbdatabaseid}

> `optional` **azureCosmosdbDatabaseId?**: `string`

Azure Cosmos DB database id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureCosmosdbDatabaseId`](IEngineEnvironmentVariables.md#azurecosmosdbdatabaseid)

***

### azureCosmosdbEndpoint? {#azurecosmosdbendpoint}

> `optional` **azureCosmosdbEndpoint?**: `string`

Azure Cosmos DB endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureCosmosdbEndpoint`](IEngineEnvironmentVariables.md#azurecosmosdbendpoint)

***

### gcpFirestoreCollectionName? {#gcpfirestorecollectionname}

> `optional` **gcpFirestoreCollectionName?**: `string`

GCP Firestore collection name.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpFirestoreCollectionName`](IEngineEnvironmentVariables.md#gcpfirestorecollectionname)

***

### gcpFirestoreCredentials? {#gcpfirestorecredentials}

> `optional` **gcpFirestoreCredentials?**: `string`

GCP Firestore credentials.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpFirestoreCredentials`](IEngineEnvironmentVariables.md#gcpfirestorecredentials)

***

### gcpFirestoreDatabaseId? {#gcpfirestoredatabaseid}

> `optional` **gcpFirestoreDatabaseId?**: `string`

GCP Firestore database id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpFirestoreDatabaseId`](IEngineEnvironmentVariables.md#gcpfirestoredatabaseid)

***

### gcpFirestoreApiEndpoint? {#gcpfirestoreapiendpoint}

> `optional` **gcpFirestoreApiEndpoint?**: `string`

GCP Firestore endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpFirestoreApiEndpoint`](IEngineEnvironmentVariables.md#gcpfirestoreapiendpoint)

***

### gcpFirestoreProjectId? {#gcpfirestoreprojectid}

> `optional` **gcpFirestoreProjectId?**: `string`

GCP Firestore project id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpFirestoreProjectId`](IEngineEnvironmentVariables.md#gcpfirestoreprojectid)

***

### scylladbHosts? {#scylladbhosts}

> `optional` **scylladbHosts?**: `string`

ScyllaDB hosts as comma separated string.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`scylladbHosts`](IEngineEnvironmentVariables.md#scylladbhosts)

***

### scylladbKeyspace? {#scylladbkeyspace}

> `optional` **scylladbKeyspace?**: `string`

ScyllaDB keyspace.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`scylladbKeyspace`](IEngineEnvironmentVariables.md#scylladbkeyspace)

***

### scylladbLocalDataCenter? {#scylladblocaldatacenter}

> `optional` **scylladbLocalDataCenter?**: `string`

ScyllaDB local data center.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`scylladbLocalDataCenter`](IEngineEnvironmentVariables.md#scylladblocaldatacenter)

***

### scylladbPort? {#scylladbport}

> `optional` **scylladbPort?**: `string`

ScyllaDB port.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`scylladbPort`](IEngineEnvironmentVariables.md#scylladbport)

***

### mySqlHost? {#mysqlhost}

> `optional` **mySqlHost?**: `string`

MySQL host.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mySqlHost`](IEngineEnvironmentVariables.md#mysqlhost)

***

### mySqlPort? {#mysqlport}

> `optional` **mySqlPort?**: `number`

MySQL port.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mySqlPort`](IEngineEnvironmentVariables.md#mysqlport)

***

### mySqlUser? {#mysqluser}

> `optional` **mySqlUser?**: `string`

MySQL username.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mySqlUser`](IEngineEnvironmentVariables.md#mysqluser)

***

### mySqlPassword? {#mysqlpassword}

> `optional` **mySqlPassword?**: `string`

MySQL password.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mySqlPassword`](IEngineEnvironmentVariables.md#mysqlpassword)

***

### mySqlDatabase? {#mysqldatabase}

> `optional` **mySqlDatabase?**: `string`

MySQL Database.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mySqlDatabase`](IEngineEnvironmentVariables.md#mysqldatabase)

***

### mongoDbHost? {#mongodbhost}

> `optional` **mongoDbHost?**: `string`

MongoDB host.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mongoDbHost`](IEngineEnvironmentVariables.md#mongodbhost)

***

### mongoDbPort? {#mongodbport}

> `optional` **mongoDbPort?**: `number`

MongoDB port.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mongoDbPort`](IEngineEnvironmentVariables.md#mongodbport)

***

### mongoDbUser? {#mongodbuser}

> `optional` **mongoDbUser?**: `string`

MongoDB username.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mongoDbUser`](IEngineEnvironmentVariables.md#mongodbuser)

***

### mongoDbPassword? {#mongodbpassword}

> `optional` **mongoDbPassword?**: `string`

MongoDB password.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mongoDbPassword`](IEngineEnvironmentVariables.md#mongodbpassword)

***

### mongoDbDatabase? {#mongodbdatabase}

> `optional` **mongoDbDatabase?**: `string`

MongoDB Database.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`mongoDbDatabase`](IEngineEnvironmentVariables.md#mongodbdatabase)

***

### postgreSqlHost? {#postgresqlhost}

> `optional` **postgreSqlHost?**: `string`

PostgreSQl host.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`postgreSqlHost`](IEngineEnvironmentVariables.md#postgresqlhost)

***

### postgreSqlPort? {#postgresqlport}

> `optional` **postgreSqlPort?**: `number`

PostgreSQl port.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`postgreSqlPort`](IEngineEnvironmentVariables.md#postgresqlport)

***

### postgreSqlUser? {#postgresqluser}

> `optional` **postgreSqlUser?**: `string`

PostgreSQl username.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`postgreSqlUser`](IEngineEnvironmentVariables.md#postgresqluser)

***

### postgreSqlPassword? {#postgresqlpassword}

> `optional` **postgreSqlPassword?**: `string`

PostgreSQl password.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`postgreSqlPassword`](IEngineEnvironmentVariables.md#postgresqlpassword)

***

### postgreSqlDatabase? {#postgresqldatabase}

> `optional` **postgreSqlDatabase?**: `string`

PostgreSQl Database.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`postgreSqlDatabase`](IEngineEnvironmentVariables.md#postgresqldatabase)

***

### ipfsBearerToken? {#ipfsbearertoken}

> `optional` **ipfsBearerToken?**: `string`

The security token for accessing IPFS API.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`ipfsBearerToken`](IEngineEnvironmentVariables.md#ipfsbearertoken)

***

### ipfsApiUrl? {#ipfsapiurl}

> `optional` **ipfsApiUrl?**: `string`

The url for accessing IPFS API.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`ipfsApiUrl`](IEngineEnvironmentVariables.md#ipfsapiurl)

***

### blobStorageConnectorType? {#blobstorageconnectortype}

> `optional` **blobStorageConnectorType?**: `string`

The type of the entity storage to create, comma separate for more than one connector.
values: memory, file, ipfs, aws-s3, azure-storage, gcp-storage.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`blobStorageConnectorType`](IEngineEnvironmentVariables.md#blobstorageconnectortype)

***

### blobStorageConnectorDefault? {#blobstorageconnectordefault}

> `optional` **blobStorageConnectorDefault?**: `string`

The default blob storage connector to use, defaults to the first one in the list.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`blobStorageConnectorDefault`](IEngineEnvironmentVariables.md#blobstorageconnectordefault)

***

### blobStorageConnectorPublic? {#blobstorageconnectorpublic}

> `optional` **blobStorageConnectorPublic?**: `string`

Blog storage connector which has public access.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`blobStorageConnectorPublic`](IEngineEnvironmentVariables.md#blobstorageconnectorpublic)

***

### blobStorageEnableEncryption? {#blobstorageenableencryption}

> `optional` **blobStorageEnableEncryption?**: `string`

Enable encryption for the blob storage.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`blobStorageEnableEncryption`](IEngineEnvironmentVariables.md#blobstorageenableencryption)

***

### blobStorageEncryptionKeyId? {#blobstorageencryptionkeyid}

> `optional` **blobStorageEncryptionKeyId?**: `string`

The id of the encryption key for the blob storage.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`blobStorageEncryptionKeyId`](IEngineEnvironmentVariables.md#blobstorageencryptionkeyid)

***

### blobStoragePrefix? {#blobstorageprefix}

> `optional` **blobStoragePrefix?**: `string`

A prefix for all the blobs in blob-storage, can be empty.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`blobStoragePrefix`](IEngineEnvironmentVariables.md#blobstorageprefix)

***

### awsS3Region? {#awss3region}

> `optional` **awsS3Region?**: `string`

AWS S3 region.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsS3Region`](IEngineEnvironmentVariables.md#awss3region)

***

### awsS3BucketName? {#awss3bucketname}

> `optional` **awsS3BucketName?**: `string`

AWS S3 bucket name.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsS3BucketName`](IEngineEnvironmentVariables.md#awss3bucketname)

***

### awsS3AuthMode? {#awss3authmode}

> `optional` **awsS3AuthMode?**: `string`

AWS S3 auth mode, either credentials or pod, defaults to credentials.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsS3AuthMode`](IEngineEnvironmentVariables.md#awss3authmode)

***

### awsS3AccessKeyId? {#awss3accesskeyid}

> `optional` **awsS3AccessKeyId?**: `string`

AWS S3 access key id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsS3AccessKeyId`](IEngineEnvironmentVariables.md#awss3accesskeyid)

***

### awsS3SecretAccessKey? {#awss3secretaccesskey}

> `optional` **awsS3SecretAccessKey?**: `string`

AWS S3 secret access key.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsS3SecretAccessKey`](IEngineEnvironmentVariables.md#awss3secretaccesskey)

***

### awsS3Endpoint? {#awss3endpoint}

> `optional` **awsS3Endpoint?**: `string`

AWS S3 endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsS3Endpoint`](IEngineEnvironmentVariables.md#awss3endpoint)

***

### azureStorageAccountKey? {#azurestorageaccountkey}

> `optional` **azureStorageAccountKey?**: `string`

Azure Storage account key.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureStorageAccountKey`](IEngineEnvironmentVariables.md#azurestorageaccountkey)

***

### azureStorageAccountName? {#azurestorageaccountname}

> `optional` **azureStorageAccountName?**: `string`

Azure Storage account name.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureStorageAccountName`](IEngineEnvironmentVariables.md#azurestorageaccountname)

***

### azureStorageContainerName? {#azurestoragecontainername}

> `optional` **azureStorageContainerName?**: `string`

Azure Storage container.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureStorageContainerName`](IEngineEnvironmentVariables.md#azurestoragecontainername)

***

### azureStorageEndpoint? {#azurestorageendpoint}

> `optional` **azureStorageEndpoint?**: `string`

Azure Storage endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`azureStorageEndpoint`](IEngineEnvironmentVariables.md#azurestorageendpoint)

***

### gcpStorageBucketName? {#gcpstoragebucketname}

> `optional` **gcpStorageBucketName?**: `string`

GCP Storage bucket.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpStorageBucketName`](IEngineEnvironmentVariables.md#gcpstoragebucketname)

***

### gcpStorageCredentials? {#gcpstoragecredentials}

> `optional` **gcpStorageCredentials?**: `string`

GCP Storage credentials.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpStorageCredentials`](IEngineEnvironmentVariables.md#gcpstoragecredentials)

***

### gcpStorageEndpoint? {#gcpstorageendpoint}

> `optional` **gcpStorageEndpoint?**: `string`

GCP Storage endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpStorageEndpoint`](IEngineEnvironmentVariables.md#gcpstorageendpoint)

***

### gcpStorageProjectId? {#gcpstorageprojectid}

> `optional` **gcpStorageProjectId?**: `string`

GCP Storage project id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`gcpStorageProjectId`](IEngineEnvironmentVariables.md#gcpstorageprojectid)

***

### vaultConnector? {#vaultconnector}

> `optional` **vaultConnector?**: `string`

The type of the default vault connector: entity-storage, hashicorp.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`vaultConnector`](IEngineEnvironmentVariables.md#vaultconnector)

***

### vaultPrefix? {#vaultprefix}

> `optional` **vaultPrefix?**: `string`

Prefix to prepend to entries in the vault.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`vaultPrefix`](IEngineEnvironmentVariables.md#vaultprefix)

***

### hashicorpVaultToken? {#hashicorpvaulttoken}

> `optional` **hashicorpVaultToken?**: `string`

Hashicorp Vault token.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`hashicorpVaultToken`](IEngineEnvironmentVariables.md#hashicorpvaulttoken)

***

### hashicorpVaultEndpoint? {#hashicorpvaultendpoint}

> `optional` **hashicorpVaultEndpoint?**: `string`

Hashicorp Vault endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`hashicorpVaultEndpoint`](IEngineEnvironmentVariables.md#hashicorpvaultendpoint)

***

### loggingConnector? {#loggingconnector}

> `optional` **loggingConnector?**: `string`

The type of logging task connector, can be a comma separated list: console, entity-storage.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`loggingConnector`](IEngineEnvironmentVariables.md#loggingconnector)

***

### eventBusConnector? {#eventbusconnector}

> `optional` **eventBusConnector?**: `string`

The type of event bus connector: local.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`eventBusConnector`](IEngineEnvironmentVariables.md#eventbusconnector)

***

### eventBusComponent? {#eventbuscomponent}

> `optional` **eventBusComponent?**: `string`

The type of event bus component: service.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`eventBusComponent`](IEngineEnvironmentVariables.md#eventbuscomponent)

***

### messagingEnabled? {#messagingenabled}

> `optional` **messagingEnabled?**: `string`

Are the messaging components enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`messagingEnabled`](IEngineEnvironmentVariables.md#messagingenabled)

***

### awsSesRegion? {#awssesregion}

> `optional` **awsSesRegion?**: `string`

AWS SES region.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsSesRegion`](IEngineEnvironmentVariables.md#awssesregion)

***

### awsSesAuthMode? {#awssesauthmode}

> `optional` **awsSesAuthMode?**: `string`

AWS SES auth mode, either credentials or pod, defaults to credentials.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsSesAuthMode`](IEngineEnvironmentVariables.md#awssesauthmode)

***

### awsSesSecretAccessKey? {#awssessecretaccesskey}

> `optional` **awsSesSecretAccessKey?**: `string`

AWS SES secret access key.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsSesSecretAccessKey`](IEngineEnvironmentVariables.md#awssessecretaccesskey)

***

### awsSesAccessKeyId? {#awssesaccesskeyid}

> `optional` **awsSesAccessKeyId?**: `string`

AWS SES access key id.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsSesAccessKeyId`](IEngineEnvironmentVariables.md#awssesaccesskeyid)

***

### awsSesEndpoint? {#awssesendpoint}

> `optional` **awsSesEndpoint?**: `string`

AWS SES endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsSesEndpoint`](IEngineEnvironmentVariables.md#awssesendpoint)

***

### awsMessagingPushNotificationApplications? {#awsmessagingpushnotificationapplications}

> `optional` **awsMessagingPushNotificationApplications?**: `string`

The applications for the push notifications reference a separate json with @json: prefix.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`awsMessagingPushNotificationApplications`](IEngineEnvironmentVariables.md#awsmessagingpushnotificationapplications)

***

### messagingEmailConnector? {#messagingemailconnector}

> `optional` **messagingEmailConnector?**: `string`

The type of messaging email connector: entity-storage, aws.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`messagingEmailConnector`](IEngineEnvironmentVariables.md#messagingemailconnector)

***

### messagingSmsConnector? {#messagingsmsconnector}

> `optional` **messagingSmsConnector?**: `string`

The type of messaging sms connector: entity-storage, aws.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`messagingSmsConnector`](IEngineEnvironmentVariables.md#messagingsmsconnector)

***

### messagingPushNotificationConnector? {#messagingpushnotificationconnector}

> `optional` **messagingPushNotificationConnector?**: `string`

The type of messaging push notification connector: entity-storage, aws.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`messagingPushNotificationConnector`](IEngineEnvironmentVariables.md#messagingpushnotificationconnector)

***

### telemetryConnector? {#telemetryconnector}

> `optional` **telemetryConnector?**: `string`

The type of telemetry connector: entity-storage.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`telemetryConnector`](IEngineEnvironmentVariables.md#telemetryconnector)

***

### faucetConnector? {#faucetconnector}

> `optional` **faucetConnector?**: `string`

The type of faucet connector: entity-storage, iota.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`faucetConnector`](IEngineEnvironmentVariables.md#faucetconnector)

***

### walletConnector? {#walletconnector}

> `optional` **walletConnector?**: `string`

The type of wallet connector: entity-storage, iota.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`walletConnector`](IEngineEnvironmentVariables.md#walletconnector)

***

### nftConnector? {#nftconnector}

> `optional` **nftConnector?**: `string`

The type of NFT connector: entity-storage, iota.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`nftConnector`](IEngineEnvironmentVariables.md#nftconnector)

***

### identityConnector? {#identityconnector}

> `optional` **identityConnector?**: `string`

The type of identity connector: entity-storage, iota.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`identityConnector`](IEngineEnvironmentVariables.md#identityconnector)

***

### identityWalletAddressIndex? {#identitywalletaddressindex}

> `optional` **identityWalletAddressIndex?**: `string`

The index of the wallet address to use, defaults to 0.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`identityWalletAddressIndex`](IEngineEnvironmentVariables.md#identitywalletaddressindex)

***

### identityResolverConnector? {#identityresolverconnector}

> `optional` **identityResolverConnector?**: `string`

The type of identity resolver connector: entity-storage, iota.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`identityResolverConnector`](IEngineEnvironmentVariables.md#identityresolverconnector)

***

### verifiableStorageConnector? {#verifiablestorageconnector}

> `optional` **verifiableStorageConnector?**: `string`

The type of verifiable storage connector: entity-storage, iota.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`verifiableStorageConnector`](IEngineEnvironmentVariables.md#verifiablestorageconnector)

***

### iotaFaucetEndpoint? {#iotafaucetendpoint}

> `optional` **iotaFaucetEndpoint?**: `string`

IOTA Faucet Endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`iotaFaucetEndpoint`](IEngineEnvironmentVariables.md#iotafaucetendpoint)

***

### iotaNodeEndpoint? {#iotanodeendpoint}

> `optional` **iotaNodeEndpoint?**: `string`

IOTA Node Endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`iotaNodeEndpoint`](IEngineEnvironmentVariables.md#iotanodeendpoint)

***

### iotaNetwork? {#iotanetwork}

> `optional` **iotaNetwork?**: `string`

IOTA network.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`iotaNetwork`](IEngineEnvironmentVariables.md#iotanetwork)

***

### iotaCoinType? {#iotacointype}

> `optional` **iotaCoinType?**: `string`

IOTA coin type.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`iotaCoinType`](IEngineEnvironmentVariables.md#iotacointype)

***

### iotaExplorerEndpoint? {#iotaexplorerendpoint}

> `optional` **iotaExplorerEndpoint?**: `string`

IOTA Explorer Endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`iotaExplorerEndpoint`](IEngineEnvironmentVariables.md#iotaexplorerendpoint)

***

### iotaGasStationEndpoint? {#iotagasstationendpoint}

> `optional` **iotaGasStationEndpoint?**: `string`

IOTA Gas Station Endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`iotaGasStationEndpoint`](IEngineEnvironmentVariables.md#iotagasstationendpoint)

***

### iotaGasStationAuthToken? {#iotagasstationauthtoken}

> `optional` **iotaGasStationAuthToken?**: `string`

IOTA Gas Station Authentication Token.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`iotaGasStationAuthToken`](IEngineEnvironmentVariables.md#iotagasstationauthtoken)

***

### universalResolverEndpoint? {#universalresolverendpoint}

> `optional` **universalResolverEndpoint?**: `string`

Universal Resolver Endpoint.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`universalResolverEndpoint`](IEngineEnvironmentVariables.md#universalresolverendpoint)

***

### identityProfileConnector? {#identityprofileconnector}

> `optional` **identityProfileConnector?**: `string`

The type of identity profile connector: entity-storage.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`identityProfileConnector`](IEngineEnvironmentVariables.md#identityprofileconnector)

***

### immutableProofVerificationMethodId? {#immutableproofverificationmethodid}

> `optional` **immutableProofVerificationMethodId?**: `string`

The identity verification method id to use with immutable proofs.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`immutableProofVerificationMethodId`](IEngineEnvironmentVariables.md#immutableproofverificationmethodid)

***

### attestationConnector? {#attestationconnector}

> `optional` **attestationConnector?**: `string`

The type of attestation connector: entity-storage, iota.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`attestationConnector`](IEngineEnvironmentVariables.md#attestationconnector)

***

### attestationVerificationMethodId? {#attestationverificationmethodid}

> `optional` **attestationVerificationMethodId?**: `string`

The identity verification method id to use with attestation.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`attestationVerificationMethodId`](IEngineEnvironmentVariables.md#attestationverificationmethodid)

***

### dataProcessingEnabled? {#dataprocessingenabled}

> `optional` **dataProcessingEnabled?**: `string`

Is the data processing enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`dataProcessingEnabled`](IEngineEnvironmentVariables.md#dataprocessingenabled)

***

### dataConverterConnectors? {#dataconverterconnectors}

> `optional` **dataConverterConnectors?**: `string`

The type of the default data converters, can be a comma separated list: json, xml.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`dataConverterConnectors`](IEngineEnvironmentVariables.md#dataconverterconnectors)

***

### dataExtractorConnectors? {#dataextractorconnectors}

> `optional` **dataExtractorConnectors?**: `string`

The type of the default data extractor, can be a comma separated list: json-path.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`dataExtractorConnectors`](IEngineEnvironmentVariables.md#dataextractorconnectors)

***

### auditableItemGraphEnabled? {#auditableitemgraphenabled}

> `optional` **auditableItemGraphEnabled?**: `string`

Is the auditable item graph enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`auditableItemGraphEnabled`](IEngineEnvironmentVariables.md#auditableitemgraphenabled)

***

### auditableItemStreamEnabled? {#auditableitemstreamenabled}

> `optional` **auditableItemStreamEnabled?**: `string`

Is the auditable item stream enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`auditableItemStreamEnabled`](IEngineEnvironmentVariables.md#auditableitemstreamenabled)

***

### documentManagementEnabled? {#documentmanagementenabled}

> `optional` **documentManagementEnabled?**: `string`

Is the document management enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`documentManagementEnabled`](IEngineEnvironmentVariables.md#documentmanagementenabled)

***

### synchronisedStorageEnabled? {#synchronisedstorageenabled}

> `optional` **synchronisedStorageEnabled?**: `string`

Is the synchronised storage enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageEnabled`](IEngineEnvironmentVariables.md#synchronisedstorageenabled)

***

### synchronisedStorageTrustedUrl? {#synchronisedstoragetrustedurl}

> `optional` **synchronisedStorageTrustedUrl?**: `string`

Url which points to the api for a trusted synchronised storage node, not required if this is a trusted node.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageTrustedUrl`](IEngineEnvironmentVariables.md#synchronisedstoragetrustedurl)

***

### synchronisedStorageVerifiableStorageKeyId? {#synchronisedstorageverifiablestoragekeyid}

> `optional` **synchronisedStorageVerifiableStorageKeyId?**: `string`

The key for the smart contract which contains the verifiable storage pointer store for synchronised storage.
This only required if using a custom verifiable storage item, otherwise it will default to the network name.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageVerifiableStorageKeyId`](IEngineEnvironmentVariables.md#synchronisedstorageverifiablestoragekeyid)

***

### synchronisedStorageBlobStorageEncryptionKeyId? {#synchronisedstorageblobstorageencryptionkeyid}

> `optional` **synchronisedStorageBlobStorageEncryptionKeyId?**: `string`

The key from the vault which is used to encrypt the synchronised storage blobs.
Only required for trusted nodes, as regular nodes will request from the trusted nodes.
Defaults to synchronised-storage-blob-encryption

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageBlobStorageEncryptionKeyId`](IEngineEnvironmentVariables.md#synchronisedstorageblobstorageencryptionkeyid)

***

### synchronisedStorageBlobStorageKey? {#synchronisedstorageblobstoragekey}

> `optional` **synchronisedStorageBlobStorageKey?**: `string`

The key used for blob encryption, should be ChaCha20Poly1305 encoded as base64.
Only required for trusted nodes, as regular nodes will not write encrypted data.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageBlobStorageKey`](IEngineEnvironmentVariables.md#synchronisedstorageblobstoragekey)

***

### synchronisedStorageEntityUpdateIntervalMinutes? {#synchronisedstorageentityupdateintervalminutes}

> `optional` **synchronisedStorageEntityUpdateIntervalMinutes?**: `string`

How often to check for entity updates in minutes.

#### Default

```ts
5
```

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageEntityUpdateIntervalMinutes`](IEngineEnvironmentVariables.md#synchronisedstorageentityupdateintervalminutes)

***

### synchronisedStorageConsolidationIntervalMinutes? {#synchronisedstorageconsolidationintervalminutes}

> `optional` **synchronisedStorageConsolidationIntervalMinutes?**: `string`

Interval to perform consolidation of changesets, only used if this is a trusted node.

#### Default

```ts
60
```

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageConsolidationIntervalMinutes`](IEngineEnvironmentVariables.md#synchronisedstorageconsolidationintervalminutes)

***

### synchronisedStorageConsolidationBatchSize? {#synchronisedstorageconsolidationbatchsize}

> `optional` **synchronisedStorageConsolidationBatchSize?**: `string`

The number of entities to process in a single consolidation batch, only used if this is a trusted node.

#### Default

```ts
1000
```

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageConsolidationBatchSize`](IEngineEnvironmentVariables.md#synchronisedstorageconsolidationbatchsize)

***

### synchronisedStorageMaxConsolidations? {#synchronisedstoragemaxconsolidations}

> `optional` **synchronisedStorageMaxConsolidations?**: `string`

The maximum number of consolidations to keep in storage, only used if this is a trusted node.

#### Default

```ts
5
```

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`synchronisedStorageMaxConsolidations`](IEngineEnvironmentVariables.md#synchronisedstoragemaxconsolidations)

***

### federatedCatalogueEnabled? {#federatedcatalogueenabled}

> `optional` **federatedCatalogueEnabled?**: `string`

Is the federated catalogue enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`federatedCatalogueEnabled`](IEngineEnvironmentVariables.md#federatedcatalogueenabled)

***

### federatedCatalogueFilters? {#federatedcataloguefilters}

> `optional` **federatedCatalogueFilters?**: `string`

Federated catalog filters, command separated list of filters to add.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`federatedCatalogueFilters`](IEngineEnvironmentVariables.md#federatedcataloguefilters)

***

### trustEnabled? {#trustenabled}

> `optional` **trustEnabled?**: `string`

Is the trust management enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`trustEnabled`](IEngineEnvironmentVariables.md#trustenabled)

***

### trustGenerators? {#trustgenerators}

> `optional` **trustGenerators?**: `string`

The trust generators to add to the factory, comma separated list.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`trustGenerators`](IEngineEnvironmentVariables.md#trustgenerators)

***

### trustVerifiers? {#trustverifiers}

> `optional` **trustVerifiers?**: `string`

The trust verifiers to add to the factory, comma separated list.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`trustVerifiers`](IEngineEnvironmentVariables.md#trustverifiers)

***

### trustVerificationMethodId? {#trustverificationmethodid}

> `optional` **trustVerificationMethodId?**: `string`

The verification method to use for trust identities.
Defaults to trust-assertion.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`trustVerificationMethodId`](IEngineEnvironmentVariables.md#trustverificationmethodid)

***

### trustJwtTtlSeconds? {#trustjwtttlseconds}

> `optional` **trustJwtTtlSeconds?**: `string`

The trust time to live for generating JWTs.
Defaults to undefined for never expiring.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`trustJwtTtlSeconds`](IEngineEnvironmentVariables.md#trustjwtttlseconds)

***

### rightsManagementEnabled? {#rightsmanagementenabled}

> `optional` **rightsManagementEnabled?**: `string`

Is the rights management enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementEnabled`](IEngineEnvironmentVariables.md#rightsmanagementenabled)

***

### rightsManagementCallbackPath? {#rightsmanagementcallbackpath}

> `optional` **rightsManagementCallbackPath?**: `string`

What is the callback path for rights management negotiations, will be combined with hosting public url e.g. /callback.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementCallbackPath`](IEngineEnvironmentVariables.md#rightsmanagementcallbackpath)

***

### rightsManagementPolicyInformationSources? {#rightsmanagementpolicyinformationsources}

> `optional` **rightsManagementPolicyInformationSources?**: `string`

The rights management policy information sources to add to the factory.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementPolicyInformationSources`](IEngineEnvironmentVariables.md#rightsmanagementpolicyinformationsources)

***

### rightsManagementPolicyNegotiators? {#rightsmanagementpolicynegotiators}

> `optional` **rightsManagementPolicyNegotiators?**: `string`

The rights management policy negotiators sources to add to the factory.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementPolicyNegotiators`](IEngineEnvironmentVariables.md#rightsmanagementpolicynegotiators)

***

### rightsManagementPolicyRequesters? {#rightsmanagementpolicyrequesters}

> `optional` **rightsManagementPolicyRequesters?**: `string`

The rights management policy requesters to add to the factory.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementPolicyRequesters`](IEngineEnvironmentVariables.md#rightsmanagementpolicyrequesters)

***

### rightsManagementPolicyExecutionActions? {#rightsmanagementpolicyexecutionactions}

> `optional` **rightsManagementPolicyExecutionActions?**: `string`

The rights management policy execution actions to add to the factory.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementPolicyExecutionActions`](IEngineEnvironmentVariables.md#rightsmanagementpolicyexecutionactions)

***

### rightsManagementPolicyEnforcementProcessors? {#rightsmanagementpolicyenforcementprocessors}

> `optional` **rightsManagementPolicyEnforcementProcessors?**: `string`

The rights management policy enforcement processors to add to the factory.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementPolicyEnforcementProcessors`](IEngineEnvironmentVariables.md#rightsmanagementpolicyenforcementprocessors)

***

### rightsManagementPolicyArbiters? {#rightsmanagementpolicyarbiters}

> `optional` **rightsManagementPolicyArbiters?**: `string`

The rights management policy arbiters to add to the factory.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementPolicyArbiters`](IEngineEnvironmentVariables.md#rightsmanagementpolicyarbiters)

***

### rightsManagementPolicyObligationEnforcers? {#rightsmanagementpolicyobligationenforcers}

> `optional` **rightsManagementPolicyObligationEnforcers?**: `string`

The rights management policy obligation enforcers to add to the factory.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`rightsManagementPolicyObligationEnforcers`](IEngineEnvironmentVariables.md#rightsmanagementpolicyobligationenforcers)

***

### backgroundTasksEnabled? {#backgroundtasksenabled}

> `optional` **backgroundTasksEnabled?**: `string`

Are background tasks enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`backgroundTasksEnabled`](IEngineEnvironmentVariables.md#backgroundtasksenabled)

***

### taskSchedulerEnabled? {#taskschedulerenabled}

> `optional` **taskSchedulerEnabled?**: `string`

Is the task scheduler enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`taskSchedulerEnabled`](IEngineEnvironmentVariables.md#taskschedulerenabled)

***

### dataspaceEnabled? {#dataspaceenabled}

> `optional` **dataspaceEnabled?**: `string`

Is the dataspace enabled, defaults to false.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`dataspaceEnabled`](IEngineEnvironmentVariables.md#dataspaceenabled)

***

### dataspaceRetainActivityLogsFor? {#dataspaceretainactivitylogsfor}

> `optional` **dataspaceRetainActivityLogsFor?**: `string`

The length of time to retain the activity logs for in minutes, set to -1 to keep forever.

#### Default

```ts
10
```

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`dataspaceRetainActivityLogsFor`](IEngineEnvironmentVariables.md#dataspaceretainactivitylogsfor)

***

### dataspaceActivityLogsCleanUpInterval? {#dataspaceactivitylogscleanupinterval}

> `optional` **dataspaceActivityLogsCleanUpInterval?**: `string`

The interval for cleaning up the activity logs.

#### Default

```ts
60
```

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`dataspaceActivityLogsCleanUpInterval`](IEngineEnvironmentVariables.md#dataspaceactivitylogscleanupinterval)

***

### dataspaceDataPlanePath? {#dataspacedataplanepath}

> `optional` **dataspaceDataPlanePath?**: `string`

The data plane path for PULL transfers (path only, not full URL).
Will be combined with public origin from hosting component.
Required if PULL transfers should be supported.
Example: "dataspace/entities"

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`dataspaceDataPlanePath`](IEngineEnvironmentVariables.md#dataspacedataplanepath)

***

### extensions? {#extensions}

> `optional` **extensions?**: `string`

A comma separated list of additional node extensions to load, the initialiseExtension method will be called for each extension.

#### Inherited from

[`IEngineEnvironmentVariables`](IEngineEnvironmentVariables.md).[`extensions`](IEngineEnvironmentVariables.md#extensions)

***

### port? {#port}

> `optional` **port?**: `string`

The port to serve the API from.

***

### host? {#host}

> `optional` **host?**: `string`

The host to serve the API from.

***

### corsOrigins? {#corsorigins}

> `optional` **corsOrigins?**: `string`

The CORS origins to allow, defaults to *.

***

### httpMethods? {#httpmethods}

> `optional` **httpMethods?**: `string`

The CORS methods to allow, defaults to GET, POST, PUT, DELETE, OPTIONS.

***

### httpAllowedHeaders? {#httpallowedheaders}

> `optional` **httpAllowedHeaders?**: `string`

The CORS headers to allow.

***

### httpExposedHeaders? {#httpexposedheaders}

> `optional` **httpExposedHeaders?**: `string`

The CORS headers to expose.

***

### publicOrigin? {#publicorigin}

> `optional` **publicOrigin?**: `string`

The public origin URL for the API e.g. https://api.example.com:1234

***

### authAdminProcessorType? {#authadminprocessortype}

> `optional` **authAdminProcessorType?**: `string`

The type of auth admin processor to use on the API: entity-storage.

***

### authProcessorType? {#authprocessortype}

> `optional` **authProcessorType?**: `string`

The type of auth processor to use on the API: entity-storage.

***

### authSigningKeyId? {#authsigningkeyid}

> `optional` **authSigningKeyId?**: `string`

The id of the key in the vault to use for signing in auth operations.

***

### mimeTypeProcessors? {#mimetypeprocessors}

> `optional` **mimeTypeProcessors?**: `string`

Additional MIME type processors to include, comma separated.

***

### routeLoggingIncludeBody? {#routeloggingincludebody}

> `optional` **routeLoggingIncludeBody?**: `string`

Include the body in the REST logging output, useful for debugging.

***

### routeLoggingFullBase64? {#routeloggingfullbase64}

> `optional` **routeLoggingFullBase64?**: `string`

Include the full base 64 output in the REST logging output, useful for debugging.

***

### routeLoggingObfuscateProperties? {#routeloggingobfuscateproperties}

> `optional` **routeLoggingObfuscateProperties?**: `string`

List of properties to obfuscate in the REST logging output, comma separated.
