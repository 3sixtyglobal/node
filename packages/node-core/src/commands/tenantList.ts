// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "tenant-list";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantList(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-list.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-list.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-list.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-list.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars) => tenantList(engineCore, envVars)
	};
}

/**
 * Command for listing all tenants.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @returns The list of tenants.
 */
export async function tenantList(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): Promise<{ id: string; apiKey: string; organizationId: string; label: string }[]> {
	const type = engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(type)) {
		throw new GeneralError("tenantList", "tenantAdminComponentNotRegistered");
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(type);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-list.labels.listing"));

	const result: { id: string; apiKey: string; organizationId: string; label: string }[] = [];
	let cursor: string | undefined;

	do {
		const page = await tenantAdminComponent.query(undefined, undefined, cursor);
		for (const tenant of page.tenants) {
			result.push({
				id: tenant.id,
				apiKey: tenant.apiKey,
				organizationId: tenant.organizationId ?? "",
				label: tenant.label ?? ""
			});
			CLIDisplay.break();
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list.labels.tenantId"),
				tenant.id
			);
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list.labels.apiKey"),
				tenant.apiKey,
				1
			);
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list.labels.organizationId"),
				tenant.organizationId ?? "",
				1
			);
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list.labels.label"),
				tenant.label ?? "",
				1
			);
		}
		cursor = page.cursor;
	} while (Is.stringValue(cursor));

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-list.labels.count"),
		result.length.toString()
	);

	CLIDisplay.done();

	return result;
}
