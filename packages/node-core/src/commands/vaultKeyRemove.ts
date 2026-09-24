// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { GeneralError, Guards, I18n } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did } from "@twin.org/identity-models";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "vault-key-remove";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionVaultKeyRemove(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.vault-key-remove.description"),
		example: I18n.formatMessage("node.cli.commands.vault-key-remove.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-remove.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-remove.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "key-id",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-remove.params.key-id.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.vault-key-remove.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => vaultKeyRemove(engineCore, envVars, params)
	};
}

/**
 * Command for removing a vault key.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID the vault key belongs to.
 * @param params.keyId The ID of the key to remove.
 * @returns A promise that resolves when the key has been removed from the vault.
 */
export async function vaultKeyRemove(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
		keyId?: string;
	}
): Promise<void> {
	Did.guard("vaultKeyRemove", "identity", params.identity);
	Guards.stringValue("vaultKeyRemove", "key-id", params.keyId);

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	const fullKeyId = `${params.identity}/${params.keyId}`;

	if (!(await vaultConnector.keyExists(fullKeyId))) {
		throw new GeneralError("vaultKeyRemove", "vaultKeyNotFound", { keyId: fullKeyId });
	}

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-remove.labels.removing"));
	await vaultConnector.removeKey(fullKeyId);
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.vault-key-remove.labels.removed"));

	CLIDisplay.break();
	CLIDisplay.done();
}
