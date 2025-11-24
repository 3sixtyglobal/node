// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, I18n, Is, RandomHelper, StringHelper, Urn } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import { IdentityConnectorType, WalletConnectorType } from "@twin.org/engine-types";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import {
	IdentityConnectorFactory,
	IdentityResolverConnectorFactory
} from "@twin.org/identity-models";
import { nameofKebabCase } from "@twin.org/nameof";
import { type IVaultConnector, VaultConnectorFactory } from "@twin.org/vault-models";
import type { WalletAddress } from "@twin.org/wallet-connector-entity-storage";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables.js";

/**
 * Generate an identity and fund it.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param configIdentity A identity from config to use.
 * @param configMnemonic A mnemonic from config to use.
 * @param controller The controller for the identity.
 * @param identityType The type of identity.
 * @param addWallet Whether to add a wallet for the identity.
 * @returns The identity that was generated.
 */
export async function createIdentity(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	configIdentity: string | undefined,
	configMnemonic: string | undefined,
	controller: string | undefined,
	identityType: "node" | "organization" | "user",
	addWallet: boolean
): Promise<string> {
	engineCore.logInfo(I18n.formatMessage("node.processingIdentity", { identityType }));

	// We have a chicken and egg problem in that we can't create the identity
	// to store the mnemonic in the vault without an identity. We use a temporary identity
	// and then replace it with the new identity later in the process.
	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	const workingIdentity =
		configIdentity ?? `bootstrap-temp-${Converter.bytesToHex(RandomHelper.generate(16))}`;
	const workingController = controller ?? workingIdentity;

	const mnemonicStored = await bootstrapMnemonic(
		engineCore,
		vaultConnector,
		workingIdentity,
		configMnemonic
	);

	const addresses = addWallet ? await generateWallet(engineCore, envVars, workingIdentity) : [];

	const finalIdentity = await generateIdentity(
		engineCore,
		envVars,
		workingController,
		workingIdentity,
		identityType
	);

	if (mnemonicStored) {
		engineCore.logInfo(
			I18n.formatMessage("node.finalMnemonic", { vaultKey: `${finalIdentity}/mnemonic` })
		);
	}

	await finaliseWallet(engineCore, envVars, finalIdentity, addresses);

	await finaliseMnemonic(vaultConnector, workingIdentity, finalIdentity);

	return finalIdentity;
}

/**
 * Generate a mnemonic for the node identity.
 * @param engineCore The engine core for the node.
 * @param vaultConnector The vault connector to use.
 * @param identity The identity of the node.
 * @param existingMnemonic An existing mnemonic to use.
 * @returns Whether the mnemonic was stored.
 */
async function bootstrapMnemonic(
	engineCore: IEngineCore,
	vaultConnector: IVaultConnector,
	identity: string,
	existingMnemonic?: string
): Promise<boolean> {
	let mnemonic = existingMnemonic;
	let storeMnemonic = false;

	const mnemonicKey = `${identity}/mnemonic`;

	try {
		const storedMnemonic = await vaultConnector.getSecret<string>(mnemonicKey);
		if (Is.stringValue(storedMnemonic)) {
			storeMnemonic = storedMnemonic !== mnemonic && !Is.empty(mnemonic);
			mnemonic = storedMnemonic;
		} else {
			storeMnemonic = true;
		}
	} catch {
		storeMnemonic = true;
	}

	// If there is no mnemonic then we need to generate one
	if (Is.empty(mnemonic)) {
		mnemonic = Bip39.randomMnemonic();
		storeMnemonic = true;
	}

	// If there is no mnemonic stored in the vault then we need to store it
	if (storeMnemonic) {
		engineCore.logInfo(I18n.formatMessage("node.storingMnemonic"));
		await vaultConnector.setSecret(mnemonicKey, mnemonic);
	} else {
		engineCore.logInfo(I18n.formatMessage("node.existingMnemonic"));
	}

	return storeMnemonic;
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
 * Bootstrap the identity for the node.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param finalIdentity The identity of the node.
 * @param addresses The addresses for the wallet.
 */
async function finaliseWallet(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	finalIdentity: string,
	addresses: string[]
): Promise<void> {
	if (Is.arrayValue(addresses)) {
		const defaultWalletConnectorType = engineCore.getRegisteredInstanceType("walletConnector");

		// If we are using entity storage for wallet the identity associated with the
		// address will be wrong, so fix it
		if (defaultWalletConnectorType.startsWith(WalletConnectorType.EntityStorage)) {
			const walletAddress =
				EntityStorageConnectorFactory.get<IEntityStorageConnector<WalletAddress>>(
					nameofKebabCase<WalletAddress>()
				);
			const addr = await walletAddress.get(addresses[0]);
			if (!Is.empty(addr)) {
				addr.identity = finalIdentity;
				await walletAddress.set(addr);
			}
		}
	}
}

/**
 * Bootstrap the wallet for the node.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param identity The identity to create the wallet for.
 * @returns The addresses for the wallet.
 */
async function generateWallet(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	identity: string
): Promise<string[]> {
	const defaultWalletConnectorType = engineCore.getRegisteredInstanceType("walletConnector");

	const walletConnector = WalletConnectorFactory.get(defaultWalletConnectorType);
	const addresses = await walletConnector.getAddresses(identity, 0, 0, 5);

	const balance = await walletConnector.getBalance(identity, addresses[0]);
	if (balance === 0n) {
		let address0 = addresses[0];

		if (
			defaultWalletConnectorType.startsWith(WalletConnectorType.Iota) &&
			Is.stringValue(envVars.iotaExplorerEndpoint)
		) {
			address0 = `${StringHelper.trimTrailingSlashes(envVars.iotaExplorerEndpoint)}/address/${address0}?network=${envVars.iotaNetwork}`;
		}

		engineCore.logInfo(I18n.formatMessage("node.fundingWallet", { address: address0 }));

		// Add some funds to the wallet from the faucet
		await walletConnector.ensureBalance(identity, addresses[0], 1000000000n);
	} else {
		engineCore.logInfo(I18n.formatMessage("node.fundedWallet"));
	}
	return addresses;
}

/**
 * Bootstrap the identity for the node.
 * @param engineCore The engine core for the node.
 * @param envVars The environment variables for the node.
 * @param controller The controller for the identity.
 * @param identity The existing identity if there is one.
 * @param identityType The type of identity.
 * @returns The addresses for the wallet.
 */
async function generateIdentity(
	engineCore: IEngineCore,
	envVars: INodeEnvironmentVariables,
	controller: string,
	identity: string,
	identityType: "node" | "organization" | "user"
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
		identityDocument = await identityResolverConnector.resolveDocument(identity);
		engineCore.logInfo(I18n.formatMessage("node.existingIdentity", { identity }));
	} catch {}

	if (Is.empty(identityDocument)) {
		engineCore.logInfo(I18n.formatMessage("node.generatingIdentity", { identityType }));

		identityDocument = await identityConnector.createDocument(controller);

		engineCore.logInfo(
			I18n.formatMessage("node.createdIdentity", { identity: identityDocument.id })
		);
	}

	if (defaultIdentityConnectorType.startsWith(IdentityConnectorType.Iota)) {
		const didUrn = Urn.fromValidString(identityDocument.id);
		const didParts = didUrn.parts();
		const objectId = didParts[3];

		if (Is.stringValue(envVars.iotaExplorerEndpoint)) {
			engineCore.logInfo(
				I18n.formatMessage("node.identityExplorer", {
					url: `${StringHelper.trimTrailingSlashes(envVars.iotaExplorerEndpoint)}/object/${objectId}?network=${envVars.iotaNetwork}`
				})
			);
		}
	}
	return identityDocument.id;
}
