// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { AccountData } from "@3sixty/api-auth-account-service";
import type { AuthenticationUser } from "@3sixty/api-auth-entity-storage-service";
import { AuthenticationAccountDataType } from "@3sixty/api-auth-models";
import type { IPlatformComponent } from "@3sixty/api-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { Coerce, ComponentFactory, GeneralError, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import { ComparisonOperator, LogicalOperator } from "@3sixty/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import { Did } from "@3sixty/identity-models";
import { nameofKebabCase } from "@3sixty/nameof";
import { getAccountAdminComponent, getAccountDataDid } from "../accountData.js";
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
): Promise<{ email: string; identity: string }[]> {
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

	const accountDataStorage =
		EntityStorageConnectorFactory.get<IEntityStorageConnector<AccountData>>(
			nameofKebabCase<AccountData>()
		);
	const authUserStorage =
		EntityStorageConnectorFactory.get<IEntityStorageConnector<AuthenticationUser>>(
			nameofKebabCase<AuthenticationUser>()
		);
	const accountAdminComponent = getAccountAdminComponent(engineCore);

	const result: { email: string; identity: string }[] = [];

	const platformComponentType = engineCore.getRegisteredInstanceType("platformComponent");
	const platformComponent = ComponentFactory.get<IPlatformComponent>(platformComponentType);

	await platformComponent.execute(async () => {
		const accountIds = new Set<string>();
		let cursor: string | undefined;
		do {
			const page = await accountDataStorage.query(
				{
					conditions: [
						{
							property: "type",
							value: AuthenticationAccountDataType.Organization,
							comparison: ComparisonOperator.Equals
						},
						{
							property: "organization",
							value: effectiveOrgDid,
							comparison: ComparisonOperator.Equals
						}
					],
					logicalOperator: LogicalOperator.And
				},
				undefined,
				["accountId"],
				cursor
			);
			for (const item of page.entities) {
				if (Is.stringValue(item.accountId)) {
					accountIds.add(item.accountId);
				}
			}
			cursor = page.cursor;
		} while (Is.stringValue(cursor));

		for (const accountId of accountIds) {
			const user = await authUserStorage.get(accountId);
			if (Is.stringValue(user?.email)) {
				const identity =
					(await getAccountDataDid(
						accountAdminComponent,
						accountId,
						AuthenticationAccountDataType.Identity
					)) ?? "";
				result.push({ email: user.email, identity });
				CLIDisplay.break();
				CLIDisplay.value(
					I18n.formatMessage("node.cli.commands.org-users-list.labels.email"),
					user.email
				);
				CLIDisplay.value(
					I18n.formatMessage("node.cli.commands.org-users-list.labels.identity"),
					identity,
					1
				);
			}
		}
	});

	CLIDisplay.break();
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.org-users-list.labels.count"),
		result.length.toString()
	);

	CLIDisplay.done();

	return result;
}
