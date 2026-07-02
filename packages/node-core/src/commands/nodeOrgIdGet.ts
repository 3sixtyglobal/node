// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { Coerce, GeneralError, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "node-org-id-get";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionNodeOrgIdGet(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.node-org-id-get.description"),
		example: I18n.formatMessage("node.cli.commands.node-org-id-get.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-org-id-get.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-org-id-get.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars) => nodeOrgIdGet(engineCore, envVars)
	};
}

/**
 * Command for retrieving the organization ID currently assigned to the node.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @returns The node organization DID.
 */
export async function nodeOrgIdGet(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables
): Promise<string> {
	if (Coerce.boolean(envVars.tenantEnabled) ?? false) {
		throw new GeneralError("nodeOrgIdGet", "notAvailableInMultiTenantMode");
	}

	const state = engineCore.getState();

	if (!Is.stringValue(state.nodeOrganizationId)) {
		throw new GeneralError("nodeOrgIdGet", "nodeOrganizationIdNotSet");
	}

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.node-org-id-get.labels.organizationId"),
		state.nodeOrganizationId
	);
	CLIDisplay.break();

	CLIDisplay.done();

	return state.nodeOrganizationId;
}
