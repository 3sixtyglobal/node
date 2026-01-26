// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { I18n, Is, NotFoundError } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did, IdentityResolverConnectorFactory } from "@twin.org/identity-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "node-set-identity";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionNodeSetIdentity(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.node-set-identity.description"),
		example: I18n.formatMessage("node.cli.commands.node-set-identity.example"),
		requiresNodeIdentity: false,
		requiresTenantId: false,
		params: [
			{
				key: "identity",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-set-identity.params.identity.description"
				),
				extendedType: "did",
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-set-identity.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => nodeSetIdentity(engineCore, envVars, params)
	};
}

/**
 * Command for setting a node identity.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.identity The DID to set for the node.
 */
export async function nodeSetIdentity(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	params: {
		identity?: string;
	}
): Promise<void> {
	Did.guard("nodeSetIdentity", "identity", params.identity);

	CLIDisplay.task(
		I18n.formatMessage("node.cli.commands.node-set-identity.labels.resolvingIdentity")
	);
	const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
		"identityResolverConnector"
	);

	const identityResolverConnector = IdentityResolverConnectorFactory.get(
		defaultIdentityResolverConnectorType
	);

	const identityDocument = await identityResolverConnector.resolveDocument(params.identity);
	if (Is.empty(identityDocument)) {
		throw new NotFoundError("nodeSetIdentity", "identityNotFound", params.identity);
	}

	const state = engineCore.getState();
	state.nodeId = params.identity;
	engineCore.setStateDirty();

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.node-set-identity.labels.stored"));

	CLIDisplay.done();
}
