// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { Coerce, GeneralError, I18n } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did } from "@twin.org/identity-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "node-org-id-set";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionNodeOrgIdSet(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		aliases: ["set-node-org-id"],
		description: I18n.formatMessage("node.cli.commands.node-org-id-set.description"),
		example: I18n.formatMessage("node.cli.commands.node-org-id-set.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-org-id-set.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "organization-id",
				type: "string",
				extendedType: "did",
				description: I18n.formatMessage(
					"node.cli.commands.node-org-id-set.params.organization-id.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.node-org-id-set.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => nodeOrgIdSet(engineCore, envVars, params)
	};
}

/**
 * Command for setting the node organization ID.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.organizationId The organization ID to set.
 * @returns A promise that resolves when the node organization ID has been persisted.
 * @throws GeneralError if called while multi-tenant mode is enabled.
 */
export async function nodeOrgIdSet(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		organizationId?: string;
	}
): Promise<void> {
	if (Coerce.boolean(envVars.tenantEnabled) ?? false) {
		throw new GeneralError("nodeOrgIdSet", "notAvailableInMultiTenantMode");
	}

	Did.guard("nodeOrgIdSet", "organizationId", params.organizationId);

	const state = engineCore.getState();
	state.nodeOrganizationId = params.organizationId;
	engineCore.setStateDirty();

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.node-org-id-set.labels.stored"));

	CLIDisplay.done();
}
