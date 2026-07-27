// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent, ITenant } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ComponentFactory, GeneralError, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { ComparisonOperator } from "@twin.org/entity";
import { Did } from "@twin.org/identity-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "tenant-list-by-org";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionTenantListByOrg(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.tenant-list-by-org.description"),
		example: I18n.formatMessage("node.cli.commands.tenant-list-by-org.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-list-by-org.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "org-id",
				type: "string",
				extendedType: "did",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-list-by-org.params.org-id.description"
				),
				required: true
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.tenant-list-by-org.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => tenantListByOrg(engineCore, envVars, params)
	};
}

/**
 * Command for listing all tenants associated with an organization DID.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.orgId The organization DID to filter by.
 * @returns The matching tenants.
 */
export async function tenantListByOrg(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		orgId?: string;
	}
): Promise<ITenant[]> {
	Did.guard("tenantListByOrg", "org-id", params.orgId);

	const type = engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(type)) {
		throw new GeneralError("tenantListByOrg", "tenantAdminComponentNotRegistered");
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(type);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.tenant-list-by-org.labels.listing"));

	const result: ITenant[] = [];
	let cursor: string | undefined;

	do {
		const page = await tenantAdminComponent.query(
			{
				property: "organizationId",
				value: params.orgId,
				comparison: ComparisonOperator.Equals
			},
			undefined,
			cursor
		);
		for (const tenant of page.tenants) {
			result.push(tenant);
			CLIDisplay.break();
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list-by-org.labels.tenantId"),
				tenant.id
			);
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list-by-org.labels.apiKey"),
				tenant.apiKey,
				1
			);
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list-by-org.labels.organizationId"),
				tenant.organizationId ?? "",
				1
			);
			CLIDisplay.value(
				I18n.formatMessage("node.cli.commands.tenant-list-by-org.labels.label"),
				tenant.label ?? "",
				1
			);
		}
		cursor = page.cursor;
	} while (Is.stringValue(cursor));

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.tenant-list-by-org.labels.count"),
		result.length.toString()
	);

	CLIDisplay.done();

	return result;
}
