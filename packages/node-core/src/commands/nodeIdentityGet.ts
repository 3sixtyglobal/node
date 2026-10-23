// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@3sixty/cli-core";
import { GeneralError, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import { IdentityResolverConnectorFactory } from "@3sixty/identity-models";
import type { IDidDocument } from "@3sixty/standards-w3c-did";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "node-identity-get";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionNodeIdentityGet(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.node-identity-get.description"),
		example: I18n.formatMessage("node.cli.commands.node-identity-get.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-identity-get.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-identity-get.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars) => nodeIdentityGet(engineCore, envVars)
	};
}

/**
 * Command for retrieving the identity currently assigned to the node.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @returns The node identity document.
 */
export async function nodeIdentityGet(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables
): Promise<IDidDocument> {
	const state = engineCore.getState();

	if (!Is.stringValue(state.nodeId)) {
		throw new GeneralError("nodeIdentityGet", "nodeIdentityNotSet");
	}

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.node-identity-get.labels.resolving"));

	const defaultIdentityResolverConnectorType = engineCore.getRegisteredInstanceType(
		"identityResolverConnector"
	);

	const identityResolverConnector = IdentityResolverConnectorFactory.get(
		defaultIdentityResolverConnectorType
	);

	const identityDocument = await identityResolverConnector.resolveDocument(state.nodeId);

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.node-identity-get.labels.did"),
		identityDocument.id
	);

	if (Is.arrayValue(identityDocument.verificationMethod)) {
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.node-identity-get.labels.verificationMethods"),
			identityDocument.verificationMethod.length.toString(),
			1
		);
		for (const method of identityDocument.verificationMethod) {
			if (Is.stringValue(method)) {
				CLIDisplay.value(method, "", 2);
			} else {
				const m = method;
				CLIDisplay.value(Is.stringValue(m.id) ? m.id : "", Is.stringValue(m.type) ? m.type : "", 2);
			}
		}
	}

	CLIDisplay.break();

	CLIDisplay.done();

	return identityDocument;
}
