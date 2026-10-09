// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { AuthenticationUser } from "@3sixty/api-auth-entity-storage-service";
import type { IPlatformComponent } from "@3sixty/api-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { Coerce, ComponentFactory, GeneralError, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import { ComparisonOperator } from "@3sixty/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import { Did } from "@3sixty/identity-models";
import { nameofKebabCase } from "@3sixty/nameof";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "org-users-list";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionOrgUsersList(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.org-users-list.description"),
		example: I18n.formatMessage("node.cli.commands.org-users-list.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.org-users-list.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "org-did",
				type: "string",
				extendedType: "did",
				description: I18n.formatMessage(
					"node.cli.commands.org-users-list.params.org-did.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.org-users-list.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => orgUsersList(engineCore, envVars, params)
	};
}

/**
 * Command for listing all users belonging to a given organization DID.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.orgDid The organization DID to filter by. Defaults to the node organization ID in single-tenant mode.
 * @returns The list of users for the organization.
 */
export async function orgUsersList(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {
		orgDid?: string;
	}
): Promise<{ email: string; identity: string; scope: string }[]> {
	const isMultiTenant = Coerce.boolean(envVars.tenantEnabled) ?? false;
	let effectiveOrgDid: string | undefined = params.orgDid;
	if (!Is.stringValue(effectiveOrgDid) && !isMultiTenant) {
		effectiveOrgDid = engineCore.getState().nodeOrganizationId;
	}

	if (!Is.stringValue(effectiveOrgDid)) {
		throw new GeneralError("orgUsersList", "orgDidRequired");
	}

	Did.guard("orgUsersList", "org-did", effectiveOrgDid);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.org-users-list.labels.listing"));

	const authUserStorage =
		EntityStorageConnectorFactory.get<IEntityStorageConnector<AuthenticationUser>>(
			nameofKebabCase<AuthenticationUser>()
		);

	const result: { email: string; identity: string; scope: string }[] = [];

	const platformComponentType = engineCore.getRegisteredInstanceType("platformComponent");
	const platformComponent = ComponentFactory.get<IPlatformComponent>(platformComponentType);

	await platformComponent.execute(async () => {
		let cursor: string | undefined;
		do {
			const page = await authUserStorage.query(
				{
					property: "organization",
					value: effectiveOrgDid,
					comparison: ComparisonOperator.Equals
				},
				undefined,
				["email", "identity", "organization", "scope"],
				cursor
			);
			for (const user of page.entities) {
				if (Is.stringValue(user.email)) {
					result.push({
						email: user.email,
						identity: user.identity ?? "",
						scope: user.scope ?? ""
					});
					CLIDisplay.break();
					CLIDisplay.value(
						I18n.formatMessage("node.cli.commands.org-users-list.labels.email"),
						user.email
					);
					CLIDisplay.value(
						I18n.formatMessage("node.cli.commands.org-users-list.labels.identity"),
						user.identity ?? "",
						1
					);
					CLIDisplay.value(
						I18n.formatMessage("node.cli.commands.org-users-list.labels.scope"),
						user.scope ?? "",
						1
					);
				}
			}
			cursor = page.cursor;
		} while (Is.stringValue(cursor));
	});

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.org-users-list.labels.count"),
		result.length.toString()
	);

	CLIDisplay.done();

	return result;
}
