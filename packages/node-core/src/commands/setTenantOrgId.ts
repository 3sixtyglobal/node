// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did } from "@twin.org/identity-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "set-tenant-org-id";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionSetTenantOrgId(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.set-tenant-org-id.description"),
		example: I18n.formatMessage("node.cli.commands.set-tenant-org-id.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.set-tenant-org-id.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.set-tenant-org-id.params.tenant-id.description"
				),
				required: true
			},
			{
				key: "organization-id",
				type: "string",
				extendedType: "did",
				description: I18n.formatMessage(
					"node.cli.commands.set-tenant-org-id.params.organization-id.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.set-tenant-org-id.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => setTenantOrgId(engineCore, envVars, params)
	};
}

/**
 * Command for setting the organization ID on a tenant.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.tenantId The tenant ID to update.
 * @param params.organizationId The organization ID to set.
 * @returns A promise that resolves when the tenant organization ID has been stored.
 */
export async function setTenantOrgId(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		tenantId?: string;
		organizationId?: string;
	}
): Promise<void> {
	Guards.stringHexLength("setTenantOrgId", "tenant-id", params.tenantId, 32);

	Did.guard("setTenantOrgId", "organizationId", params.organizationId);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.set-tenant-org-id.labels.updating"));
	CLIDisplay.spinnerStart();

	await applyOrganizationIdToTenant(engineCore, params.tenantId, params.organizationId);

	CLIDisplay.spinnerStop();
	CLIDisplay.task(I18n.formatMessage("node.cli.commands.set-tenant-org-id.labels.stored"));

	CLIDisplay.done();
}

/**
 * Apply a new organization ID to a tenant.
 * @param engineCore The engine core used to look up the tenantAdminComponent.
 * @param tenantId The ID of the tenant to update.
 * @param newOrganizationId The new organization DID to set.
 * @param options Optional display and behaviour overrides.
 * @param options.sectionLabel When set, emits a CLI section header before and done marker after.
 * @param options.required When false, returns silently when the component is not registered (default true).
 * @returns A promise that resolves when the tenant record has been updated.
 * @throws GeneralError if the component is required but not registered.
 */
export async function applyOrganizationIdToTenant(
	engineCore: IEngineCore,
	tenantId: string,
	newOrganizationId: string,
	options?: { sectionLabel?: string; required?: boolean }
): Promise<void> {
	const type = engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(type)) {
		if (options?.required ?? true) {
			throw new GeneralError("applyOrganizationIdToTenant", "tenantAdminComponentNotRegistered");
		}
		return;
	}

	if (Is.stringValue(options?.sectionLabel)) {
		CLIDisplay.break();
		CLIDisplay.section(options.sectionLabel);
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(type);

	const tenant = await tenantAdminComponent.get(tenantId);
	await tenantAdminComponent.update({
		...tenant,
		organizationId: newOrganizationId
	});

	if (Is.stringValue(options?.sectionLabel)) {
		CLIDisplay.done();
	}
}
