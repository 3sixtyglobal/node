// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { Converter, Guards, HexHelper, I18n, Is } from "@twin.org/core";
import { Ed25519 } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did } from "@twin.org/identity-models";
import { VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "vault-key-import";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionVaultKeyImport(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.vault-key-import.description"),
		example: I18n.formatMessage("node.cli.commands.vault-key-import.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-import.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-import.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "key-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-import.params.key-id.description"
				),
				required: true
			},
			{
				key: "key-type",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-import.params.key-type.description"
				),
				options: ["Ed25519", "Secp256k1", "ChaCha20Poly1305"],
				defaultValue: "Ed25519",
				required: false
			},
			{
				key: "private-key-hex",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-import.params.private-key-hex.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-import.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => vaultKeyImport(engineCore, envVars, params)
	};
}

/**
 * Command for importing a vault key.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID to import the vault key for.
 * @param params.keyId The ID of the key to import.
 * @param params.keyType The type of key to import.
 * @param params.privateKeyHex The private key in hexadecimal format.
 * @returns A promise that resolves when the key has been imported into the vault.
 */
export async function vaultKeyImport(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
		keyType?: string;
		keyId?: string;
		privateKeyHex?: string;
	}
): Promise<void> {
	Did.guard("vaultKeyImport", "identity", params.identity);
	Guards.stringValue("vaultKeyImport", "key-id", params.keyId);
	Guards.arrayOneOf("vaultKeyImport", "key-type", params.keyType, [
		"Ed25519",
		"Secp256k1",
		"ChaCha20Poly1305"
	]);
	Guards.stringHex("vaultKeyImport", "private-key-hex", params.privateKeyHex, true);

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	const fullKeyId = `${params.identity}/${params.keyId}`;

	let existingKey;
	try {
		existingKey = await vaultConnector.getKey(fullKeyId);
		if (Is.notEmpty(existingKey)) {
			await vaultConnector.removeKey(fullKeyId);
		}
	} catch {}

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-import.labels.importing"));
	CLIDisplay.spinnerStart();

	const privateKeyBytes = Converter.hexToBytes(HexHelper.stripPrefix(params.privateKeyHex));
	const publicKeyBytes =
		params.keyType === "Ed25519" ? Ed25519.publicKeyFromPrivateKey(privateKeyBytes) : undefined;

	await vaultConnector.addKey(
		fullKeyId,
		VaultKeyType[params.keyType as keyof typeof VaultKeyType],
		privateKeyBytes,
		publicKeyBytes
	);

	CLIDisplay.spinnerStop();
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-import.labels.imported"));

	CLIDisplay.break();
	CLIDisplay.done();
}
