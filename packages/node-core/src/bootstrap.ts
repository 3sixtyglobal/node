// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { PasswordHelper, type AuthenticationUser } from "@twin.org/api-auth-entity-storage-service";
import { Coerce, Converter, I18n, Is, RandomHelper, StringHelper, Urn } from "@twin.org/core";
import { Bip39, PasswordGenerator } from "@twin.org/crypto";
import type { IEngineCore, IEngineCoreContext, IEngineState } from "@twin.org/engine-models";
import {
	AuthenticationComponentType,
	type IEngineServerConfig
} from "@twin.org/engine-server-types";
import { IdentityConnectorType, WalletConnectorType } from "@twin.org/engine-types";
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
import { nameof } from "@twin.org/nameof";
import { VaultConnectorFactory, VaultKeyType, type IVaultConnector } from "@twin.org/vault-models";
import type { WalletAddress } from "@twin.org/wallet-connector-entity-storage";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import type { Person, WithContext } from "schema-dts";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables";
import { NodeFeatures } from "./models/nodeFeatures";
import { getFeatures } from "./utils";

const DEFAULT_NODE_USERNAME = "admin@node";

/**
 * Bootstrap the application.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 */
export async function bootstrap(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
	envVars: INodeEnvironmentVariables
): Promise<void> {
	const features = getFeatures(envVars);

	await bootstrapNodeIdentity(engineCore, context, envVars, features);
	await bootstrapNodeUser(engineCore, context, envVars, features);
	await bootstrapAuth(engineCore, context, envVars, features);
	await bootstrapBlobEncryption(engineCore, context, envVars, features);

	await addVerificationMethod(
		engineCore,
		context,
		"attestation",
		envVars.attestationVerificationMethodId
	);

	await addVerificationMethod(
		engineCore,
		context,
		"immutable proof",
		envVars.immutableProofVerificationMethodId
	);

	if (Coerce.boolean(envVars.rightsManagementEnabled) ?? false) {
		await addVerificationMethod(
			engineCore,
			context,
			"rights management",
			envVars.rightsManagementVerificationMethodId
		);
	}

	await bootstrapSynchronisedStorage(engineCore, context, envVars, features);
}

/**
 * Bootstrap the node creating any necessary resources.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node. The features that are enabled on the node.
 */
export async function bootstrapNodeIdentity(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (features.includes(NodeFeatures.NodeIdentity)) {
		// When we bootstrap the node we need to generate an identity for it,
		// But we have a chicken and egg problem in that we can't create the identity
		// to store the mnemonic in the vault without an identity. We use a temporary identity
		// and then replace it with the new identity later in the process.
		const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
		const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

		const workingIdentity =
			envVars.identity ??
			context.state.nodeIdentity ??
			`bootstrap-temp-${Converter.bytesToHex(RandomHelper.generate(16))}`;

		await bootstrapMnemonic(engineCore, envVars, features, vaultConnector, workingIdentity);

		const addresses = await bootstrapWallet(engineCore, envVars, features, workingIdentity);

		const finalIdentity = await bootstrapIdentity(engineCore, envVars, features, workingIdentity);

		await finaliseWallet(engineCore, envVars, features, finalIdentity, addresses);

		await finaliseMnemonic(vaultConnector, workingIdentity, finalIdentity);

		context.state.nodeIdentity = finalIdentity;
		context.stateDirty = true;

		engineCore.logInfo(
			I18n.formatMessage("node.nodeIdentity", {
				identity: context.state.nodeIdentity
			})
		);
	}
}

/**
 * Bootstrap the identity for the node.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node. The features that are enabled on the node.
 * @param nodeIdentity The identity of the node.
 * @returns The addresses for the wallet.
 */
async function bootstrapIdentity(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[],
	nodeIdentity: string
): Promise<string> {
	const defaultIdentityConnectorType = engineCore.getRegisteredInstanceType("identityConnector");

	// Now create an identity for the node controlled by the address we just funded
	const identityConnector = IdentityConnectorFactory.get(defaultIdentityConnectorType);

	let identityDocument;

	try {
		const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
			"identityResolverConnector"
		);

		const identityResolverConnector = IdentityResolverConnectorFactory.get(
			defaultIdentityResolverConnectorType
		);
		identityDocument = await identityResolverConnector.resolveDocument(nodeIdentity);
		engineCore.logInfo(I18n.formatMessage("node.existingNodeIdentity", { identity: nodeIdentity }));
	} catch {}

	if (Is.empty(identityDocument)) {
		engineCore.logInfo(I18n.formatMessage("node.generatingNodeIdentity"));

		identityDocument = await identityConnector.createDocument(nodeIdentity);

		engineCore.logInfo(
			I18n.formatMessage("node.createdNodeIdentity", { identity: identityDocument.id })
		);
	}

	if (defaultIdentityConnectorType.startsWith(IdentityConnectorType.Iota)) {
		const didUrn = Urn.fromValidString(identityDocument.id);
		const didParts = didUrn.parts();
		const objectId = didParts[3];

		engineCore.logInfo(
			I18n.formatMessage("node.identityExplorer", {
				url: `${envVars.iotaExplorerEndpoint}object/${objectId}?network=${envVars.iotaNetwork}`
			})
		);
	}
	return identityDocument.id;
}

/**
 * Bootstrap the wallet for the node.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 * @param nodeIdentity The identity of the node.
 * @returns The addresses for the wallet.
 */
async function bootstrapWallet(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[],
	nodeIdentity: string
): Promise<string[]> {
	if (features.includes(NodeFeatures.NodeWallet)) {
		const defaultWalletConnectorType = engineCore.getRegisteredInstanceType("walletConnector");

		const walletConnector = WalletConnectorFactory.get(defaultWalletConnectorType);
		const addresses = await walletConnector.getAddresses(nodeIdentity, 0, 0, 5);

		const balance = await walletConnector.getBalance(nodeIdentity, addresses[0]);
		if (balance === 0n) {
			let address0 = addresses[0];

			if (defaultWalletConnectorType.startsWith(WalletConnectorType.Iota)) {
				address0 = `${envVars.iotaExplorerEndpoint}address/${address0}?network=${envVars.iotaNetwork}`;
			}

			engineCore.logInfo(I18n.formatMessage("node.fundingWallet", { address: address0 }));

			// Add some funds to the wallet from the faucet
			await walletConnector.ensureBalance(nodeIdentity, addresses[0], 1000000000n);
		} else {
			engineCore.logInfo(I18n.formatMessage("node.fundedWallet"));
		}
		return addresses;
	}
	return [];
}

/**
 * Bootstrap the identity for the node.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 * @param finalIdentity The identity of the node.
 * @param addresses The addresses for the wallet.
 */
async function finaliseWallet(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[],
	finalIdentity: string,
	addresses: string[]
): Promise<void> {
	if (features.includes(NodeFeatures.NodeWallet)) {
		const defaultWalletConnectorType = engineCore.getRegisteredInstanceType("walletConnector");

		// If we are using entity storage for wallet the identity associated with the
		// address will be wrong, so fix it
		if (defaultWalletConnectorType.startsWith(WalletConnectorType.EntityStorage)) {
			const walletAddress = EntityStorageConnectorFactory.get<
				IEntityStorageConnector<WalletAddress>
			>(StringHelper.kebabCase(nameof<WalletAddress>()));
			const addr = await walletAddress.get(addresses[0]);
			if (!Is.empty(addr)) {
				addr.identity = finalIdentity;
				await walletAddress.set(addr);
			}
		}
	}
}

/**
 * Generate a mnemonic for the node identity.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 * @param vaultConnector The vault connector to use.
 * @param nodeIdentity The identity of the node.
 */
async function bootstrapMnemonic(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[],
	vaultConnector: IVaultConnector,
	nodeIdentity: string
): Promise<void> {
	let mnemonic = envVars.mnemonic;
	let storeMnemonic = false;

	try {
		const storedMnemonic = await vaultConnector.getSecret<string>(`${nodeIdentity}/mnemonic`);
		storeMnemonic = storedMnemonic !== mnemonic;
		mnemonic = storedMnemonic;
	} catch {
		storeMnemonic = true;
	}

	// If there is no mnemonic then we need to generate one
	if (Is.empty(mnemonic)) {
		mnemonic = Bip39.randomMnemonic();
		storeMnemonic = true;
		engineCore.logInfo(I18n.formatMessage("node.generatingMnemonic", { mnemonic }));
	}

	// If there is no mnemonic stored in the vault then we need to store it
	if (storeMnemonic) {
		engineCore.logInfo(I18n.formatMessage("node.storingMnemonic"));
		await vaultConnector.setSecret(`${nodeIdentity}/mnemonic`, mnemonic);
	} else {
		engineCore.logInfo(I18n.formatMessage("node.existingMnemonic"));
	}
}

/**
 * Finalise the mnemonic for the node identity.
 * @param vaultConnector The vault connector to use.
 * @param workingIdentity The identity of the node.
 * @param finalIdentity The final identity for the node.
 */
async function finaliseMnemonic(
	vaultConnector: IVaultConnector,
	workingIdentity: string,
	finalIdentity: string
): Promise<void> {
	// Now that we have an identity we can remove the temporary one
	// and store the mnemonic with the new identity
	if (workingIdentity.startsWith("bootstrap-temp-") && workingIdentity !== finalIdentity) {
		const mnemonic = await vaultConnector.getSecret(`${workingIdentity}/mnemonic`);
		await vaultConnector.setSecret(`${finalIdentity}/mnemonic`, mnemonic);
		await vaultConnector.removeSecret(`${workingIdentity}/mnemonic`);
	}
}

/**
 * Bootstrap the user.
 * @param engineCore The engine core for the node.
 * @param context The context for the node.
 * @param envVars The environment variables for the node.
 * @param features The features that are enabled on the node.
 */
export async function bootstrapNodeUser(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (features.includes(NodeFeatures.NodeUser)) {
		const defaultAuthenticationComponentType =
			engineCore.getRegisteredInstanceType("authenticationComponent");
		if (
			defaultAuthenticationComponentType.startsWith(AuthenticationComponentType.EntityStorage) &&
			Is.stringValue(context.state.nodeIdentity)
		) {
			const authUserEntityStorage = EntityStorageConnectorFactory.get<
				IEntityStorageConnector<AuthenticationUser>
			>(StringHelper.kebabCase(nameof<AuthenticationUser>()));

			const email = envVars.username ?? DEFAULT_NODE_USERNAME;

			let nodeAdminUser = await authUserEntityStorage.get(email);

			if (Is.empty(nodeAdminUser)) {
				engineCore.logInfo(I18n.formatMessage("node.creatingNodeUser", { email }));

				const generatedPassword = envVars.password ?? PasswordGenerator.generate(16);
				const passwordBytes = Converter.utf8ToBytes(generatedPassword);
				const saltBytes = RandomHelper.generate(16);
				const hashedPassword = await PasswordHelper.hashPassword(passwordBytes, saltBytes);

				nodeAdminUser = {
					email,
					password: hashedPassword,
					salt: Converter.bytesToBase64(saltBytes),
					identity: context.state.nodeIdentity
				};

				engineCore.logInfo(
					I18n.formatMessage("node.nodeAdminUserEmail", { email: nodeAdminUser.email })
				);
				engineCore.logInfo(
					I18n.formatMessage("node.nodeAdminUserPassword", { password: generatedPassword })
				);

				await authUserEntityStorage.set(nodeAdminUser);
			} else {
				engineCore.logInfo(I18n.formatMessage("node.existingNodeUser", { email }));

				// The user already exists, so double check the other details match
				let needsUpdate = false;

				if (nodeAdminUser.identity !== context.state.nodeIdentity) {
					nodeAdminUser.identity = context.state.nodeIdentity;
					needsUpdate = true;
				}

				if (Is.stringValue(envVars.password)) {
					const passwordBytes = Converter.utf8ToBytes(envVars.password);
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
			const defaultIdentityConnectorType =
				engineCore.getRegisteredInstanceType("identityConnector");
			const identityProfileConnector = IdentityProfileConnectorFactory.get(
				defaultIdentityConnectorType
			);

			if (identityProfileConnector) {
				let userProfile;
				try {
					userProfile = await identityProfileConnector.get(context.state.nodeIdentity);
				} catch {}
				if (Is.empty(userProfile)) {
					engineCore.logInfo(
						I18n.formatMessage("node.creatingUserProfile", { identity: context.state.nodeIdentity })
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
						email
					};
					await identityProfileConnector.create(
						context.state.nodeIdentity,
						publicProfile,
						privateProfile
					);
				} else {
					engineCore.logInfo(
						I18n.formatMessage("node.existingUserProfile", { identity: context.state.nodeIdentity })
					);
				}
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
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
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
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (
		(Coerce.boolean(envVars.blobStorageEnableEncryption) ?? false) &&
		Is.stringValue(context.state.nodeIdentity)
	) {
		// Create a new key for encrypting blobs
		const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
		const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

		const keyName = `${context.state.nodeIdentity}/${envVars.blobStorageEncryptionKeyId}`;

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
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	const defaultAuthenticationComponentType =
		engineCore.getRegisteredInstanceTypeOptional("authenticationComponent");
	if (
		Is.stringValue(defaultAuthenticationComponentType) &&
		defaultAuthenticationComponentType.startsWith(AuthenticationComponentType.EntityStorage) &&
		Is.stringValue(context.state.nodeIdentity)
	) {
		// Create a new JWT signing key and a user login for the node
		const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
		const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

		const keyName = `${context.state.nodeIdentity}/${envVars.authSigningKeyId}`;

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
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
	envVars: INodeEnvironmentVariables,
	features: NodeFeatures[]
): Promise<void> {
	if (Coerce.boolean(envVars.synchronisedStorageEnabled) ?? false) {
		// Add the verification method to the identity if it doesn't exist
		await addVerificationMethod(
			engineCore,
			context,
			"synchronised storage",
			envVars.synchronisedStorageVerificationMethodId
		);

		// If this is a trusted node we need to add the blob encryption key pair
		if (
			Is.stringValue(envVars.synchronisedStorageBlobStorageEncryptionKeyId) &&
			Is.stringBase64(envVars.synchronisedStorageBlobStorageKey)
		) {
			const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
			const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

			const keyName = envVars.synchronisedStorageBlobStorageEncryptionKeyId;
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
 * @param verificationMethodTitle The verification method title.
 * @param verificationMethodId The verification method ID.
 */
async function addVerificationMethod(
	engineCore: IEngineCore,
	context: IEngineCoreContext<IEngineServerConfig, IEngineState>,
	verificationMethodTitle: string,
	verificationMethodId: string | undefined
): Promise<void> {
	if (
		Is.stringValue(context.state.nodeIdentity) &&
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

		const identityDocument = await identityResolverConnector.resolveDocument(
			context.state.nodeIdentity
		);

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
				context.state.nodeIdentity,
				context.state.nodeIdentity,
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
