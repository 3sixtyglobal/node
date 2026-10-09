// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@3sixty/cli-core";
import { GeneralError, I18n, Is } from "@3sixty/core";
import { AccountHelper } from "@3sixty/dlt-account";
import type { IEngineCore } from "@3sixty/engine-models";
import { Did, IdentityConnectorFactory } from "@3sixty/identity-models";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "identity-remove";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityRemove(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.identity-remove.description"),
		example: I18n.formatMessage("node.cli.commands.identity-remove.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-remove.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-remove.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "controller",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-remove.params.controller.description"
				),
				extendedType: "did",
				required: false
			},
			{
				key: "remove-keys",
				type: "boolean",
				description: I18n.formatMessage(
					"node.cli.commands.identity-remove.params.remove-keys.description"
				),
				required: false,
				defaultValue: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-remove.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => identityRemove(engineCore, envVars, params)
	};
}

/**
 * Command for removing an identity.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID of the identity to remove.
 * @param params.controller The controller DID for the identity, defaults to the identity itself.
 * @param params.removeKeys Also remove the keys and mnemonic held in the vault for the identity.
 * @returns A promise that resolves when the identity has been removed.
 */
export async function identityRemove(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
		controller?: string;
		removeKeys?: boolean;
	}
): Promise<void> {
	Did.guard("identityRemove", "identity", params.identity);
	if (Is.stringValue(params.controller)) {
		Did.guard("identityRemove", "controller", params.controller);
	}

	const state = engineCore.getState();
	if (params.identity === state.nodeId) {
		throw new GeneralError("identityRemove", "nodeIdentityNotRemovable");
	}
	if (params.identity === state.nodeOrganizationId) {
		throw new GeneralError("identityRemove", "nodeOrganizationIdentityNotRemovable");
	}

	const removeKeys = params.removeKeys ?? false;

	const defaultIdentityConnectorType = engineCore.getRegisteredInstanceType("identityConnector");
	const identityConnector = IdentityConnectorFactory.get(defaultIdentityConnectorType);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-remove.labels.removingIdentity"));
	CLIDisplay.spinnerStart();

	await identityConnector.removeDocument(params.controller ?? params.identity, params.identity, {
		removeKeys,
		removeDocumentKey: removeKeys
	});

	CLIDisplay.spinnerStop();

	if (removeKeys) {
		CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-remove.labels.removingKeys"));

		const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
		const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);
		await AccountHelper.removeAccountKeys(undefined, vaultConnector, params.identity);
	}

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-remove.labels.removedIdentity"));

	CLIDisplay.break();
	CLIDisplay.done();
}
