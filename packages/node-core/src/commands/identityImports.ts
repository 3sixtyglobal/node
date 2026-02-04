// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { GeneralError, Guards, I18n, Is } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did, IdentityResolverConnectorFactory } from "@twin.org/identity-models";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "identity-import";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionIdentityImport(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.identity-import.description"),
		example: I18n.formatMessage("node.cli.commands.identity-import.example"),
		requiresNodeIdentity: false,
		requiresTenantId: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-import.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-import.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "mnemonic",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-import.params.mnemonic.description"
				),
				extendedType: "24 words",
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.identity-import.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => identityImport(engineCore, envVars, params)
	};
}

/**
 * Command for importing an identity.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID of the identity to import.
 * @param params.mnemonic The mnemonic to use for the identity.
 */
export async function identityImport(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	params: {
		identity?: string;
		mnemonic?: string;
	}
): Promise<void> {
	Did.guard("identityImport", "identity", params.identity);
	Guards.stringValue("identityImport", "mnemonic", params.mnemonic);
	if (!Bip39.validateMnemonic(params.mnemonic)) {
		throw new GeneralError("identityImport", "invalidMnemonic");
	}

	const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
		"identityResolverConnector"
	);

	const identityResolverConnector = IdentityResolverConnectorFactory.get(
		defaultIdentityResolverConnectorType
	);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-import.labels.resolvingIdentity"));
	const identityDocument = await identityResolverConnector.resolveDocument(params.identity);

	if (Is.empty(identityDocument)) {
		throw new GeneralError("identityImport", "identityNotFound", {
			identity: params.identity
		});
	}

	const defaultVaultConnectorType = engineCore.getRegisteredInstanceType("vaultConnector");
	const vaultConnector = VaultConnectorFactory.get(defaultVaultConnectorType);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.identity-import.labels.storingMnemonic"));
	const mnemonicKey = `${params.identity}/mnemonic`;
	await vaultConnector.setSecret(mnemonicKey, params.mnemonic);

	CLIDisplay.break();
	CLIDisplay.done();
}
