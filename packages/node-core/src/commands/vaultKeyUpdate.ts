// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@3sixty/cli-core";
import { Converter, GeneralError, Guards, HexHelper, I18n } from "@3sixty/core";
import { Ed25519 } from "@3sixty/crypto";
import type { IEngineCore } from "@3sixty/engine-models";
import { Did } from "@3sixty/identity-models";
import { VaultConnectorFactory, VaultKeyType } from "@3sixty/vault-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "vault-key-update";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionVaultKeyUpdate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.vault-key-update.description"),
		example: I18n.formatMessage("node.cli.commands.vault-key-update.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-update.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-update.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "key-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-update.params.key-id.description"
				),
				required: true
			},
			{
				key: "private-key-hex",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-update.params.private-key-hex.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-update.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => vaultKeyUpdate(engineCore, envVars, params)
	};
}

/**
 * Command for replacing the key material of an existing vault key, keeping its type.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID the vault key belongs to.
 * @param params.keyId The ID of the key to update.
 * @param params.privateKeyHex The replacement private key in hexadecimal format.
 * @returns A promise that resolves when the key material has been replaced.
 */
export async function vaultKeyUpdate(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
		keyId?: string;
		privateKeyHex?: string;
	}
): Promise<void> {
	Did.guard("vaultKeyUpdate", "identity", params.identity);
	Guards.stringValue("vaultKeyUpdate", "key-id", params.keyId);
	Guards.stringHex("vaultKeyUpdate", "private-key-hex", params.privateKeyHex, true);

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	const fullKeyId = `${params.identity}/${params.keyId}`;

	if (!(await vaultConnector.keyExists(fullKeyId))) {
		throw new GeneralError("vaultKeyUpdate", "vaultKeyNotFound", { keyId: fullKeyId });
	}

	const keyType = await vaultConnector.getKeyType(fullKeyId);

	const privateKeyBytes = Converter.hexToBytes(HexHelper.stripPrefix(params.privateKeyHex));
	const publicKeyBytes =
		keyType === VaultKeyType.Ed25519 ? Ed25519.publicKeyFromPrivateKey(privateKeyBytes) : undefined;

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-update.labels.updating"));
	CLIDisplay.spinnerStart();

	// The vault has no in-place update, so replace the key under the same name and type
	await vaultConnector.removeKey(fullKeyId);
	await vaultConnector.addKey(fullKeyId, keyType, privateKeyBytes, publicKeyBytes);

	CLIDisplay.spinnerStop();
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-update.labels.updated"));

	CLIDisplay.break();
	CLIDisplay.done();
}
