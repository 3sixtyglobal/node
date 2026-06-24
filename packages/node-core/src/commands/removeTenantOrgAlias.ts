// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did } from "@twin.org/identity-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "remove-tenant-org-alias";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionRemoveTenantOrgAlias(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.remove-tenant-org-alias.description"),
		example: I18n.formatMessage("node.cli.commands.remove-tenant-org-alias.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.remove-tenant-org-alias.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.remove-tenant-org-alias.params.tenant-id.description"
				),
				required: true
			},
			{
				key: "alias",
				type: "string",
				extendedType: "did",
				description: I18n.formatMessage(
					"node.cli.commands.remove-tenant-org-alias.params.alias.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.remove-tenant-org-alias.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => removeTenantOrgAlias(engineCore, envVars, params)
	};
}

/**
 * Command for removing an alias from the tenant organization ID legacy list.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.tenantId The tenant ID to update.
 * @param params.alias The alias to remove from the legacy list.
 * @returns A promise that resolves when the alias has been removed.
 * @throws GeneralError if the tenant admin component is not registered, or the alias is not found.
 */
export async function removeTenantOrgAlias(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		tenantId?: string;
		alias?: string;
	}
): Promise<void> {
	const defaultTenantAdminComponentType =
		engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(defaultTenantAdminComponentType)) {
		throw new GeneralError("removeTenantOrgAlias", "tenantAdminComponentNotRegistered");
	}

	Guards.stringHexLength("removeTenantOrgAlias", "tenant-id", params.tenantId, 32);

	Did.guard("removeTenantOrgAlias", "alias", params.alias);

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(
		defaultTenantAdminComponentType
	);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.remove-tenant-org-alias.labels.reading"));

	const tenant = await tenantAdminComponent.get(params.tenantId);
	const legacy = [...(tenant.organizationIdLegacy ?? [])];
	const index = legacy.indexOf(params.alias);

	if (index < 0) {
		throw new GeneralError("removeTenantOrgAlias", "aliasNotFound", { alias: params.alias });
	}

	legacy.splice(index, 1);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.remove-tenant-org-alias.labels.updating"));
	CLIDisplay.spinnerStart();

	await tenantAdminComponent.update({
		...tenant,
		organizationIdLegacy: legacy
	});

	CLIDisplay.spinnerStop();
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.remove-tenant-org-alias.labels.removed"));

	CLIDisplay.done();
}
