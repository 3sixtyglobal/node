// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { I18n, Is, NotFoundError } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did, IdentityResolverConnectorFactory } from "@twin.org/identity-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "node-identity-set";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionNodeIdentitySet(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		aliases: ["node-set-identity"],
		description: I18n.formatMessage("node.cli.commands.node-identity-set.description"),
		example: I18n.formatMessage("node.cli.commands.node-identity-set.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-identity-set.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-identity-set.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-identity-set.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => nodeIdentitySet(engineCore, envVars, params)
	};
}

/**
 * Command for setting a node identity.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID to set for the node.
 * @returns A promise that resolves when the node identity has been persisted.
 */
export async function nodeIdentitySet(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		identity?: string;
	}
): Promise<void> {
	Did.guard("nodeIdentitySet", "identity", params.identity);

	CLIDisplay.task(
		I18n.formatMessage("node.cli.commands.node-identity-set.labels.resolvingIdentity")
	);
	const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
		"identityResolverConnector"
	);

	const identityResolverConnector = IdentityResolverConnectorFactory.get(
		defaultIdentityResolverConnectorType
	);

	const identityDocument = await identityResolverConnector.resolveDocument(params.identity);
	if (Is.empty(identityDocument)) {
		throw new NotFoundError("nodeIdentitySet", "identityNotFound", params.identity);
	}

	const state = engineCore.getState();

	if (state.nodeId === params.identity) {
		CLIDisplay.task(I18n.formatMessage("node.cli.commands.node-identity-set.labels.skipping"));
		return;
	}

	state.nodeId = params.identity;
	engineCore.setStateDirty();

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.node-identity-set.labels.stored"));

	CLIDisplay.done();
}
