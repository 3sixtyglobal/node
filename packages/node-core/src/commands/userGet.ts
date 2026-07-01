// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IAuthenticationAdminComponent,
	IAuthenticationUser
} from "@twin.org/api-auth-entity-storage-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "user-get";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionUserGet(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.user-get.description"),
		example: I18n.formatMessage("node.cli.commands.user-get.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.user-get.params.env-prefix.description"),
				required: false
			},
			{
				key: "email",
				type: "string",
				extendedType: "email",
				description: I18n.formatMessage("node.cli.commands.user-get.params.email.description")
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage("node.cli.commands.user-get.params.tenant-id.description"),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.user-get.params.load-env.description"),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => userGet(engineCore, envVars, params)
	};
}

/**
 * Command for retrieving a single user by email address.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.email The email address of the user to retrieve.
 * @param params.tenantId The tenant ID (multi-tenant mode only).
 * @returns The user record.
 */
export async function userGet(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		email?: string;
		tenantId?: string;
	}
): Promise<IAuthenticationUser> {
	Guards.email("userGet", "email", params.email);
	if (Is.stringValue(params.tenantId)) {
		Guards.stringHexLength("userGet", "tenant-id", params.tenantId, 32);
	} else if (Coerce.boolean(envVars.tenantEnabled) ?? false) {
		throw new GeneralError("userGet", "tenantIdRequired");
	}

	const defaultAuthenticationAdminComponentType = engineCore.getRegisteredInstanceType(
		"authenticationAdminComponent"
	);
	const authenticationAdminComponent = ComponentFactory.get<IAuthenticationAdminComponent>(
		defaultAuthenticationAdminComponentType
	);

	CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-get.labels.retrieving"));

	const currentContextIds = (await ContextIdStore.getContextIds()) ?? {};
	const user = await ContextIdStore.run(
		{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
		async () => authenticationAdminComponent.get(params.email ?? "")
	);

	CLIDisplay.break();
	CLIDisplay.value(I18n.formatMessage("node.cli.commands.user-get.labels.email"), user.email);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.user-get.labels.identity"),
		user.userIdentity ?? "",
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.user-get.labels.organization"),
		user.organizationIdentity ?? "",
		1
	);
	CLIDisplay.value(
		I18n.formatMessage("node.cli.commands.user-get.labels.scope"),
		(user.scope ?? []).join(", "),
		1
	);
	CLIDisplay.break();

	CLIDisplay.done();

	return user;
}
