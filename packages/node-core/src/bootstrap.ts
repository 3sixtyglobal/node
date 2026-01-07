// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { PasswordHelper, type AuthenticationUser } from "@twin.org/api-auth-entity-storage-service";
import { TenantIdHelper, type ITenantAdminComponent } from "@twin.org/api-tenant-processor";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, Converter, I18n, Is, RandomHelper } from "@twin.org/core";
import { PasswordGenerator } from "@twin.org/crypto";
import type { IEngineCore, IEngineCoreContext } from "@twin.org/engine-models";
import {
	AuthenticationComponentType,
	type IEngineServerConfig
} from "@twin.org/engine-server-types";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import {
	DocumentHelper,
	IdentityConnectorFactory,
	IdentityProfileConnectorFactory,
	IdentityResolverConnectorFactory
} from "@twin.org/identity-models";
import { nameofKebabCase } from "@twin.org/nameof";
import { VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import type { Person, WithContext } from "schema-dts";
import {
	ATTESTATION_VERIFICATION_METHOD_ID,
	AUTH_SIGNING_KEY_ID,
	BLOB_STORAGE_ENCRYPTION_KEY_ID,
	IMMUTABLE_PROOF_VERIFICATION_METHOD_ID,
	SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID,
	VC_AUTHENTICATION_VERIFICATION_METHOD_ID
} from "./defaults.js";
import { createIdentity } from "./identity.js";
import type { INodeEngineState } from "./models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables.js";
import { NodeFeatures } from "./models/nodeFeatures.js";
import { getFeatures } from "./utils.js";

const DEFAULT_NODE_ADMIN_USERNAME = "admin@node";

/**
 * Bootstrap the application.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 */
export async function bootstrap(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables
): Promise<void> {
	const features = getFeatures(envVars);

	await bootstrapNodeId(engineCore, context, envVars, features);

	await ContextIdStore.run(engineCore.getContextIds() ?? {}, async () => {
		await bootstrapTenantId(engineCore, context, envVars, features);

		await bootstrapNodeAdminUser(engineCore, context, envVars, features);
		await bootstrapAuth(engineCore, context, envVars, features);
		await bootstrapBlobEncryption(engineCore, context, envVars, features);

		const defaultAttestationConnectorType =
			engineCore.getRegisteredInstanceTypeOptional("attestationConnector");
		if (
			!Is.empty(defaultAttestationConnectorType) &&
			Is.stringValue(context.state.nodeOrganizationId)
		) {
			await addVerificationMethod(
				engineCore,
				context,
				context.state.nodeOrganizationId,
				"attestation",
				envVars.attestationVerificationMethodId ?? ATTESTATION_VERIFICATION_METHOD_ID
			);
		}

		const defaultImmutableProofComponentType =
			engineCore.getRegisteredInstanceTypeOptional("immutableProofComponent");

		if (
			!Is.empty(defaultImmutableProofComponentType) &&
			Is.stringValue(context.state.nodeOrganizationId)
		) {
			await addVerificationMethod(
				engineCore,
				context,
				context.state.nodeOrganizationId,
				"immutable proof",
				envVars.immutableProofVerificationMethodId ?? IMMUTABLE_PROOF_VERIFICATION_METHOD_ID
			);
		}

		if (
			(Coerce.boolean(envVars.vcAuthenticationEnabled) ?? false) &&
			Is.stringValue(context.state.nodeId)
		) {
			await addVerificationMethod(
				engineCore,
				context,
				context.state.nodeId,
				"verifiable credential authentication",
				envVars.vcAuthenticationVerificationMethodId ?? VC_AUTHENTICATION_VERIFICATION_METHOD_ID
			);
		}

		await bootstrapSynchronisedStorage(engineCore, context, envVars, features);
	});
}

/**
 * Bootstrap the node creating any necessary resources.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node. The features that are enabled on the node.
 */
export async function bootstrapNodeId(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (features.includes(NodeFeatures.NodeId)) {
		const existingNodeId = envVars.nodeIdentity ?? context.state.nodeId;

		const nodeId = await createIdentity(
			engineCore,
			envVars,
			existingNodeId,
			envVars.nodeMnemonic,
			existingNodeId,
			"node",
			features.includes(NodeFeatures.NodeWallet)
		);

		if (nodeId !== context.state.nodeId) {
			context.stateDirty = true;
		}
		context.state.nodeId = nodeId;

		engineCore.logInfo(
			I18n.formatMessage("node.nodeId", {
				identity: nodeId
			})
		);

		engineCore.addContextId(ContextIdKeys.Node, context.state.nodeId);
	}
}

/**
 * Bootstrap the node creating any necessary resources.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node. The features that are enabled on the node.
 */
export async function bootstrapTenantId(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	// If tenants are enabled we need to add a context id for the node
	// so that services such a logging have a default tenant context id
	// this will get overwritten by any incoming API requests with the tenant context id
	if (Coerce.boolean(envVars.tenantEnabled) ?? false) {
		const configuredTenantId = envVars.tenantId ?? context.state.nodeTenantId;

		let exists = false;

		const tenantAdminServiceComponentType =
			engineCore.getRegisteredInstanceType("tenantAdminComponent");

		const tenantAdminService = ComponentFactory.get<ITenantAdminComponent>(
			tenantAdminServiceComponentType
		);

		let finalTenantId;
		if (Is.stringValue(configuredTenantId)) {
			try {
				const tenant = await tenantAdminService.get(configuredTenantId);
				if (!Is.empty(tenant)) {
					engineCore.logInfo(
						I18n.formatMessage("node.existingTenantId", {
							tenantId: configuredTenantId
						})
					);
					exists = true;
					finalTenantId = configuredTenantId;
				}
			} catch {}
		}

		if (!exists) {
			const apiKey = envVars.tenantApiKey ?? TenantIdHelper.generateApiKey();
			finalTenantId = configuredTenantId ?? TenantIdHelper.generateTenantId();

			await tenantAdminService.set({
				id: finalTenantId,
				apiKey,
				dateCreated: new Date(Date.now()).toISOString(),
				label: "node-tenant"
			});

			engineCore.logInfo(
				I18n.formatMessage("node.createdTenantId", {
					tenantId: finalTenantId,
					apiKey
				})
			);
		}

		if (Is.stringValue(finalTenantId)) {
			if (finalTenantId !== context.state.nodeTenantId) {
				context.state.nodeTenantId = finalTenantId;
				context.stateDirty = true;
			}

			engineCore.addContextId(ContextIdKeys.Tenant, context.state.nodeTenantId);
		}
	}
}

/**
 * Bootstrap the user.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 */
export async function bootstrapNodeAdminUser(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (features.includes(NodeFeatures.NodeAdminUser)) {
		context.state.nodeOrganizationId =
			envVars.organizationIdentity ?? context.state.nodeOrganizationId;
		context.state.nodeAdminUserId = envVars.adminUserIdentity ?? context.state.nodeAdminUserId;

		const defaultAuthenticationComponentType =
			engineCore.getRegisteredInstanceType("authenticationComponent");
		if (
			defaultAuthenticationComponentType.startsWith(AuthenticationComponentType.EntityStorage) &&
			Is.stringValue(context.state.nodeId)
		) {
			const authUserEntityStorage =
				EntityStorageConnectorFactory.get<IEntityStorageConnector<AuthenticationUser>>(
					nameofKebabCase<AuthenticationUser>()
				);

			const existingOrganizationId =
				envVars.organizationIdentity ?? context.state.nodeOrganizationId;

			const orgId = await createIdentity(
				engineCore,
				envVars,
				existingOrganizationId,
				envVars.organizationMnemonic,
				existingOrganizationId,
				"organization",
				features.includes(NodeFeatures.NodeWallet)
			);
			if (context.state.nodeOrganizationId !== orgId) {
				context.state.nodeOrganizationId = orgId;
				context.stateDirty = true;
			}

			const userId = await createIdentity(
				engineCore,
				envVars,
				context.state.nodeAdminUserId,
				envVars.adminUserMnemonic,
				context.state.nodeOrganizationId,
				"user",
				false
			);
			if (context.state.nodeAdminUserId !== userId) {
				context.state.nodeAdminUserId = userId;
				context.stateDirty = true;
			}

			const adminEmail = envVars.adminUserName ?? DEFAULT_NODE_ADMIN_USERNAME;

			let nodeAdminUser = await authUserEntityStorage.get(adminEmail);

			// If the node admin user doesn't exist, create it
			if (Is.empty(nodeAdminUser)) {
				engineCore.logInfo(I18n.formatMessage("node.creatingUser", { email: adminEmail }));

				const generatedPassword = envVars.adminUserPassword ?? PasswordGenerator.generate(16);
				const passwordBytes = Converter.utf8ToBytes(generatedPassword);
				const saltBytes = RandomHelper.generate(16);
				const hashedPassword = await PasswordHelper.hashPassword(passwordBytes, saltBytes);

				nodeAdminUser = {
					email: adminEmail,
					password: hashedPassword,
					salt: Converter.bytesToBase64(saltBytes),
					identity: context.state.nodeAdminUserId,
					organization: context.state.nodeOrganizationId
				};

				engineCore.logInfo(I18n.formatMessage("node.nodeAdminUserEmail", { email: adminEmail }));

				const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
				const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);
				const vaultKey = `${context.state.nodeAdminUserId}/admin-password`;
				await vaultConnector.setSecret<string>(vaultKey, generatedPassword);

				engineCore.logInfo(I18n.formatMessage("node.nodeAdminUserPassword", { vaultKey }));

				await authUserEntityStorage.set(nodeAdminUser);
			} else {
				engineCore.logInfo(I18n.formatMessage("node.existingUser", { email: adminEmail }));

				// The user already exists, so double check the other details match
				let needsUpdate = false;

				if (nodeAdminUser.identity !== context.state.nodeAdminUserId) {
					nodeAdminUser.identity = context.state.nodeAdminUserId;
					needsUpdate = true;
				}

				if (Is.stringValue(envVars.adminUserPassword)) {
					const passwordBytes = Converter.utf8ToBytes(envVars.adminUserPassword);
					const saltBytes = Converter.base64ToBytes(nodeAdminUser.salt);
					const hashedPassword = await PasswordHelper.hashPassword(passwordBytes, saltBytes);

					if (nodeAdminUser.password !== hashedPassword) {
						nodeAdminUser.password = hashedPassword;
						needsUpdate = true;
					}
				}

				if (needsUpdate) {
					await authUserEntityStorage.set(nodeAdminUser);
				}
			}

			// We have create a node user, now we need to create a profile for the user
			const defaultIdentityProfileConnectorType = engineCore.getRegisteredInstanceType(
				"identityProfileConnector"
			);
			const identityProfileConnector = IdentityProfileConnectorFactory.get(
				defaultIdentityProfileConnectorType
			);

			if (identityProfileConnector) {
				// Add the organization context id when creating the profile
				// so that it is partitioned under the organization
				const contextIds = (await ContextIdStore.getContextIds()) ?? {};
				contextIds[ContextIdKeys.Organization] = context.state.nodeOrganizationId;
				await ContextIdStore.run(contextIds, async () => {
					let userProfile;
					if (Is.stringValue(nodeAdminUser.identity)) {
						try {
							userProfile = await identityProfileConnector.get(nodeAdminUser.identity);
						} catch {}
					}
					if (Is.empty(userProfile)) {
						engineCore.logInfo(
							I18n.formatMessage("node.creatingUserProfile", {
								identity: nodeAdminUser.identity
							})
						);

						const publicProfile: WithContext<Person> = {
							"@context": "https://schema.org",
							"@type": "Person",
							name: "Node Administrator"
						};
						const privateProfile: WithContext<Person> = {
							"@context": "https://schema.org",
							"@type": "Person",
							givenName: "Node",
							familyName: "Administrator",
							email: adminEmail
						};
						await identityProfileConnector.create(
							nodeAdminUser.identity,
							publicProfile,
							privateProfile
						);
					} else {
						engineCore.logInfo(
							I18n.formatMessage("node.existingUserProfile", {
								identity: nodeAdminUser.identity
							})
						);
					}
				});
			}
		}
	}
}

/**
 * Bootstrap the immutable proof verification methods.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 */
export async function bootstrapImmutableProofMethod(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {}

/**
 * Bootstrap the keys for blob encryption.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 */
export async function bootstrapBlobEncryption(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (
		(Coerce.boolean(envVars.blobStorageEnableEncryption) ?? false) &&
		Is.stringValue(context.state.nodeOrganizationId)
	) {
		// Create a new key for encrypting blobs
		const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
		const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

		const keyName = `${context.state.nodeOrganizationId}/${envVars.blobStorageEncryptionKeyId ?? BLOB_STORAGE_ENCRYPTION_KEY_ID}`;

		let existingKey;

		try {
			existingKey = await vaultConnector.getKey(keyName);
		} catch {}

		if (Is.empty(existingKey)) {
			if (Is.stringBase64(envVars.blobStorageSymmetricEncryptionKey)) {
				engineCore.logInfo(I18n.formatMessage("node.addingBlobEncryptionKey", { keyName }));
				await vaultConnector.addKey(
					keyName,
					VaultKeyType.ChaCha20Poly1305,
					Converter.base64ToBytes(envVars.blobStorageSymmetricEncryptionKey)
				);
			} else {
				engineCore.logInfo(I18n.formatMessage("node.creatingBlobEncryptionKey", { keyName }));
				const key = await vaultConnector.createKey(keyName, VaultKeyType.ChaCha20Poly1305);
				engineCore.logInfo(
					I18n.formatMessage("node.createdBlobEncryptionKey", {
						keyName,
						keyValue: Converter.bytesToBase64(key)
					})
				);
			}
		} else {
			engineCore.logInfo(I18n.formatMessage("node.existingBlobEncryptionKey", { keyName }));
		}
	}
}

/**
 * Bootstrap the JWT signing key.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 */
export async function bootstrapAuth(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	const defaultAuthenticationComponentType =
		engineCore.getRegisteredInstanceTypeOptional("authenticationComponent");
	if (
		Is.stringValue(defaultAuthenticationComponentType) &&
		defaultAuthenticationComponentType.startsWith(AuthenticationComponentType.EntityStorage) &&
		Is.stringValue(context.state.nodeId)
	) {
		// Create a new JWT signing key and a user login for the node
		const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
		const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

		const keyName = `${context.state.nodeId}/${envVars.authSigningKeyId ?? AUTH_SIGNING_KEY_ID}`;

		let existingKey;
		try {
			existingKey = await vaultConnector.getKey(keyName);
		} catch {}

		if (Is.empty(existingKey)) {
			engineCore.logInfo(I18n.formatMessage("node.creatingAuthKey", { keyName }));
			await vaultConnector.createKey(keyName, VaultKeyType.Ed25519);
		} else {
			engineCore.logInfo(I18n.formatMessage("node.existingAuthKey", { keyName }));
		}
	}
}

/**
 * Bootstrap the synchronised storage blob encryption and verification methods.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 */
export async function bootstrapSynchronisedStorage(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (Coerce.boolean(envVars.synchronisedStorageEnabled) ?? false) {
		// If this is a trusted node we need to add the blob encryption key pair
		if (Is.stringBase64(envVars.synchronisedStorageBlobStorageKey)) {
			const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
			const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

			const keyName =
				envVars.synchronisedStorageBlobStorageEncryptionKeyId ??
				SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID;
			let existingKey;

			try {
				existingKey = await vaultConnector.getKey(keyName);
			} catch {}

			if (Is.empty(existingKey)) {
				engineCore.logInfo(
					I18n.formatMessage("node.addingSynchronisedStorageBlobEncryptionKey", { keyName })
				);
				await vaultConnector.addKey(
					keyName,
					VaultKeyType.ChaCha20Poly1305,
					Converter.base64ToBytes(envVars.synchronisedStorageBlobStorageKey)
				);
			} else {
				engineCore.logInfo(
					I18n.formatMessage("node.existingSynchronisedStorageBlobEncryptionKey", { keyName })
				);
			}
		}
	}
}

/**
 * Add a verification method if it doesn't exist.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param identity The identity to add the verification method to.
 * @param verificationMethodTitle The verification method title.
 * @param verificationMethodId The verification method ID.
 */
async function addVerificationMethod(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, INodeEngineState>,
	identity: string,
	verificationMethodTitle: string,
	verificationMethodId: string | undefined
): Promise<void> {
	if (
		Is.stringValue(identity) &&
		Is.arrayValue(context.config.types.identityConnector) &&
		Is.stringValue(verificationMethodId)
	) {
		const defaultIdentityConnectorType = engineCore.getRegisteredInstanceType("identityConnector");
		const identityConnector = IdentityConnectorFactory.get(defaultIdentityConnectorType);

		const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
			"identityResolverConnector"
		);
		const identityResolverConnector = IdentityResolverConnectorFactory.get(
			defaultIdentityResolverConnectorType
		);

		const identityDocument = await identityResolverConnector.resolveDocument(identity);

		const fullMethodId = `${identityDocument.id}#${verificationMethodId}`;

		let exists = false;
		try {
			DocumentHelper.getVerificationMethod(identityDocument, fullMethodId, "assertionMethod");
			exists = true;
		} catch {}

		if (!exists) {
			engineCore.logInfo(
				I18n.formatMessage("node.addingVerificationMethod", {
					title: verificationMethodTitle,
					methodId: fullMethodId
				})
			);
			await identityConnector.addVerificationMethod(
				identity,
				identity,
				"assertionMethod",
				verificationMethodId
			);
		} else {
			engineCore.logInfo(
				I18n.formatMessage("node.existingVerificationMethod", {
					title: verificationMethodTitle,
					methodId: fullMethodId
				})
			);
		}
	}
}
