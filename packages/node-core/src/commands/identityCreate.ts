// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Coerce, GeneralError, I18n, Is, RandomHelper, StringHelper } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import { IdentityConnectorType, WalletConnectorType } from "@twin.org/engine-types";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import {
	Did,
	IdentityConnectorFactory,
	IdentityResolverConnectorFactory
} from "@twin.org/identity-models";
import { nameofKebabCase } from "@twin.org/nameof";
import { type IVaultConnector, VaultConnectorFactory } from "@twin.org/vault-models";
import type { WalletAddress } from "@twin.org/wallet-connector-entity-storage";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "identity-create";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityCreate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.identity-create.description"),
		example: I18n.formatMessage("node.cli.commands.identity-create.example"),
		requiresNodeIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "mnemonic",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.mnemonic.description"
				),
				extendedType: "24 words",
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.identity.description"
				),
				extendedType: "did",
				required: false
			},
			{
				key: "controller",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.controller.description"
				),
				extendedType: "did",
				required: false
			},
			{
				key: "fund-wallet",
				type: "boolean",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.fund-wallet.description"
				),
				required: false,
				defaultValue: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.load-env.description"
				),
				required: false
			},
			{
				key: "output-json",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.output-json.description"
				),
				required: false
			},
			{
				key: "output-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.output-env.description"
				),
				required: false
			},
			{
				key: "output-env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-create.params.output-env-prefix.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => identityCreate(engineCore, envVars, params)
	};
}

/**
 * Command for creating an identity.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.mnemonic The mnemonic to use for the identity.
 * @param params.identity The DID of the identity to create.
 * @param params.controller The controller DID for the identity.
 * @param params.fundWallet Whether to fund the wallet associated with the identity from a faucet.
 * @param params.outputJson The output .json file to store the command output.
 * @param params.outputEnv The output .env file to store the command output.
 * @param params.outputEnvPrefix The prefix to use for variables in the output .env file.
 * @returns The identity details.
 */
export async function identityCreate(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	params: {
		mnemonic?: string;
		identity?: string;
		controller?: string;
		fundWallet?: boolean;
		outputJson?: string;
		outputEnv?: string;
		outputEnvPrefix?: string;
	}
): Promise<{ mnemonic: string; did: string; walletAddress?: string }> {
	let workingIdentity = params?.identity;
	let tempIdentity;
	if (!Is.stringValue(workingIdentity)) {
		tempIdentity = `did:temp:${RandomHelper.generateUuidV7()}`;
		workingIdentity = tempIdentity;
	}
	let mnemonicStored = false;

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	try {
		const mnemonicResult = await mnemonicCreate(vaultConnector, workingIdentity, params.mnemonic);
		mnemonicStored = mnemonicResult.stored;

		const fundWallet = params.fundWallet ?? false;
		let walletAddress;
		if (fundWallet) {
			walletAddress = await generateWallet(
				engineCore,
				workingIdentity,
				Coerce.integer(envVars.identityWalletAddressIndex) ?? 0
			);
		}

		const workingController = params?.controller ?? workingIdentity;
		workingIdentity = await identityGenerate(engineCore, workingController, workingIdentity);

		if (Is.stringValue(tempIdentity)) {
			// If we were using a temporary identity store the mnemonic using
			// the final identity
			await mnemonicFinalise(vaultConnector, tempIdentity, workingIdentity);

			await walletFinalise(engineCore, workingIdentity, walletAddress);
		}

		CLIDisplay.break();

		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.identity-create.labels.mnemonic"),
			mnemonicResult.mnemonic
		);
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.identity-create.labels.did"),
			workingIdentity
		);
		if (
			Is.stringValue(envVars.iotaExplorerEndpoint) &&
			envVars.identityConnector === IdentityConnectorType.Iota
		) {
			const idParts = Did.parse(workingIdentity);
			if (Is.stringValue(walletAddress)) {
				CLIDisplay.value(
					I18n.formatMessage("node.cli.commands.identity-create.labels.walletAddress"),
					`${StringHelper.trimTrailingSlashes(envVars.iotaExplorerEndpoint)}/address/${walletAddress}?network=${idParts.network ?? envVars.iotaNetwork}`
				);
			}
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.identity-create.labels.explorer"),
				`${StringHelper.trimTrailingSlashes(envVars.iotaExplorerEndpoint)}/object/${idParts.id}?network=${idParts.network ?? envVars.iotaNetwork}`
			);
		}
		CLIDisplay.break();

		const json = { mnemonic: mnemonicResult.mnemonic, did: workingIdentity, walletAddress };
		if (Is.stringValue(params.outputJson)) {
			await CLIUtils.writeJsonFile(
				params.outputJson,
				{ mnemonic: mnemonicResult.mnemonic, did: workingIdentity, walletAddress },
				false
			);
		}

		if (Is.stringValue(params.outputEnv)) {
			const output = [
				`${params.outputEnvPrefix}MNEMONIC="${mnemonicResult.mnemonic}"`,
				`${params.outputEnvPrefix}DID="${workingIdentity}"`
			];
			if (Is.stringValue(walletAddress)) {
				output.push(`${params.outputEnvPrefix}WALLET_ADDRESS="${walletAddress}"`);
			}
			await CLIUtils.writeEnvFile(params.outputEnv, output, false);
		}

		CLIDisplay.done();

		return json;
	} finally {
		// Always remove temporary identity mnemonic if created
		if (Is.stringValue(tempIdentity) && mnemonicStored) {
			await mnemonicRemove(vaultConnector, tempIdentity);
		}
	}
}

/**
 * Handle the mnemonic generation or retrieval.
 * @param vaultConnector The vault connector.
 * @param identity The working identity.
 * @param providedMnemonic The mnemonic provided by the user.
 * @returns The mnemonic and the flag to determine if the mnemonic was stored.
 */
async function mnemonicCreate(
	vaultConnector: IVaultConnector,
	identity: string,
	providedMnemonic?: string
): Promise<{
	stored: boolean;
	mnemonic: string;
}> {
	if (Is.stringValue(providedMnemonic) && !Bip39.validateMnemonic(providedMnemonic)) {
		throw new GeneralError("identityCreate", "invalidMnemonic");
	}
	let mnemonic = providedMnemonic;
	let storeMnemonic;

	CLIDisplay.section(
		I18n.formatMessage("node.cli.commands.identity-create.labels.processingMnemonic")
	);

	const mnemonicKey = `${identity}/mnemonic`;

	try {
		CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-create.labels.readingMnemonic"));
		const storedMnemonic = await vaultConnector.getSecret<string>(mnemonicKey);
		if (Is.stringValue(storedMnemonic)) {
			CLIDisplay.task(
				I18n.formatMessage("node.cli.commands.identity-create.labels.existingMnemonic")
			);
			storeMnemonic = storedMnemonic !== mnemonic && !Is.empty(mnemonic);
			mnemonic = storedMnemonic;
		} else {
			CLIDisplay.task(
				I18n.formatMessage("node.cli.commands.identity-create.labels.noExistingMnemonic")
			);
			storeMnemonic = true;
		}
	} catch {
		CLIDisplay.task(
			I18n.formatMessage("node.cli.commands.identity-create.labels.noExistingMnemonic")
		);
		storeMnemonic = true;
	}

	// If there is no mnemonic then we need to generate one
	if (Is.empty(mnemonic)) {
		CLIDisplay.task(
			I18n.formatMessage("node.cli.commands.identity-create.labels.generatingMnemonic")
		);
		mnemonic = Bip39.randomMnemonic();
		storeMnemonic = true;
	}

	// If there is no mnemonic stored in the vault then we need to store it
	if (storeMnemonic) {
		CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-create.labels.storingMnemonic"));
		await vaultConnector.setSecret(mnemonicKey, mnemonic);
	}
	CLIDisplay.break();

	return {
		stored: storeMnemonic,
		mnemonic
	};
}

/**
 * Finalise the mnemonic for the node identity.
 * @param vaultConnector The vault connector to use.
 * @param tempIdentity The identity of the node.
 * @param identity The final identity for the node.
 */
async function mnemonicFinalise(
	vaultConnector: IVaultConnector,
	tempIdentity: string,
	identity: string
): Promise<void> {
	// Now that we have an identity we can remove the temporary one
	// and store the mnemonic with the new identity
	if (tempIdentity !== identity) {
		const mnemonic = await vaultConnector.getSecret(`${tempIdentity}/mnemonic`);
		await vaultConnector.setSecret(`${identity}/mnemonic`, mnemonic);

		try {
			// not all accounts have account entries in the vault, so wrap this in a try catch
			const accountChunk = await vaultConnector.getSecret(`${tempIdentity}/account/0/0/0`);
			await vaultConnector.setSecret(`${identity}/account/0/0/0`, accountChunk);
		} catch {}
	}
}

/**
 * Remove the mnemonic.
 * @param vaultConnector The vault connector.
 * @param identity The working identity.
 * @returns Nothing.
 */
async function mnemonicRemove(vaultConnector: IVaultConnector, identity: string): Promise<void> {
	try {
		await vaultConnector.removeSecret(`${identity}/mnemonic`);
	} catch {}

	try {
		await vaultConnector.removeSecret(`${identity}/account/0/0/0`);
	} catch {}
}

/**
 * Generate an identity.
 * @param engineCore The engine core for the node.
 * @param controller The controller for the identity.
 * @param providedIdentity The existing identity if there is one.
 * @returns The addresses for the wallet.
 */
async function identityGenerate(
	engineCore: IEngineCore,
	controller: string,
	providedIdentity?: string
): Promise<string> {
	CLIDisplay.section(
		I18n.formatMessage("node.cli.commands.identity-create.labels.processingIdentity")
	);

	const defaultIdentityConnectorType = engineCore.getRegisteredInstanceType("identityConnector");
	const identityConnector = IdentityConnectorFactory.get(defaultIdentityConnectorType);

	let identityDocument;

	try {
		if (Is.stringValue(providedIdentity)) {
			CLIDisplay.task(
				I18n.formatMessage("node.cli.commands.identity-create.labels.resolvingIdentity")
			);
			const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
				"identityResolverConnector"
			);

			const identityResolverConnector = IdentityResolverConnectorFactory.get(
				defaultIdentityResolverConnectorType
			);
			identityDocument = await identityResolverConnector.resolveDocument(providedIdentity);
			if (Is.objectValue(identityDocument)) {
				CLIDisplay.task(
					I18n.formatMessage("node.cli.commands.identity-create.labels.existingIdentity")
				);
			}
		}
	} catch {}

	if (Is.empty(identityDocument)) {
		CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-create.labels.noIdentityFound"));

		CLIDisplay.task(
			I18n.formatMessage("node.cli.commands.identity-create.labels.creatingIdentity")
		);

		CLIDisplay.spinnerStart();
		identityDocument = await identityConnector.createDocument(controller);
		CLIDisplay.spinnerStop();

		CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-create.labels.createdIdentity"));
	}

	return identityDocument.id;
}

/**
 * Bootstrap the wallet for the node.
 * @param engineCore The engine core for the node.
 * @param identity The identity to create the wallet for.
 * @param walletAddressIndex The index of the wallet address to use.
 * @returns The addresses for the wallet.
 */
async function generateWallet(
	engineCore: IEngineCore,
	identity: string,
	walletAddressIndex: number
): Promise<string> {
	CLIDisplay.section(I18n.formatMessage("node.cli.commands.identity-create.labels.fundingWallet"));
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.identity-create.labels.addressIndex"),
		walletAddressIndex.toString()
	);

	const defaultWalletConnectorType = engineCore.getRegisteredInstanceType("walletConnector");

	const walletConnector = WalletConnectorFactory.get(defaultWalletConnectorType);
	const addresses = await walletConnector.getAddresses(identity, 0, walletAddressIndex, 5);

	if (defaultWalletConnectorType.startsWith(WalletConnectorType.Iota)) {
		CLIDisplay.task(
			I18n.formatMessage("node.cli.commands.identity-create.labels.addingTokens", {
				address: addresses[0]
			})
		);
		CLIDisplay.break();

		CLIDisplay.spinnerStart();

		// Add some funds to the wallet from the faucet
		await walletConnector.ensureBalance(identity, addresses[0], 1000000000n);

		CLIDisplay.spinnerStop();
	}

	return addresses[0];
}

/**
 * Bootstrap the identity for the node.
 * @param engineCore The engine core for the node.
 * @param identity The identity of the node.
 * @param address The address for the wallet.
 */
async function walletFinalise(
	engineCore: IEngineCore,
	identity: string,
	address?: string
): Promise<void> {
	if (Is.stringValue(address)) {
		const defaultWalletConnectorType = engineCore.getRegisteredInstanceType("walletConnector");

		// If we are using entity storage for wallet the identity associated with the
		// address will be wrong, so fix it
		if (defaultWalletConnectorType.startsWith(WalletConnectorType.EntityStorage)) {
			const walletAddress =
				EntityStorageConnectorFactory.get<IEntityStorageConnector<WalletAddress>>(
					nameofKebabCase<WalletAddress>()
				);
			const addr = await walletAddress.get(address);
			if (!Is.empty(addr)) {
				addr.identity = identity;
				await walletAddress.set(addr);
			}
		}
	}
}
