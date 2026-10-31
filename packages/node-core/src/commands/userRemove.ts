// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuthenticationAdminComponent } from "@3sixty/api-auth-entity-storage-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { Coerce, ComponentFactory, GeneralError, Guards, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import { normaliseEmail } from "../utils.js";

const COMMAND_NAME = "user-remove";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionUserRemove(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.user-remove.description"),
		example: I18n.formatMessage("node.cli.commands.user-remove.example"),
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-remove.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "email",
				type: "string",
				extendedType: "email",
				description: I18n.formatMessage("node.cli.commands.user-remove.params.email.description")
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.user-remove.params.tenant-id.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-remove.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => userRemove(engineCore, envVars, params)
	};
}

/**
 * Command for removing a user and their identity profile.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.email The email address of the user to remove.
 * @param params.tenantId The tenant ID for the user (multi-tenant mode only).
 * @returns A promise that resolves when the user has been removed.
 */
export async function userRemove(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		email?: string;
		tenantId?: string;
	}
): Promise<void> {
	const paramsEmail = Is.stringValue(params.email) ? normaliseEmail(params.email) : params.email;
	Guards.email("userRemove", "email", paramsEmail);
	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	if (Is.stringValue(params.tenantId)) {
		if (!tenantEnabled) {
			throw new GeneralError("userRemove", "tenantIdNotAllowed");
		}
		Guards.stringHexLength("userRemove", "tenant-id", params.tenantId, 32);
	} else if (tenantEnabled) {
		throw new GeneralError("userRemove", "tenantIdRequired");
	}

	const defaultAuthenticationAdminComponentType = engineCore.getRegisteredInstanceType(
		"authenticationAdminComponent"
	);
	const authenticationAdminComponent = ComponentFactory.get<IAuthenticationAdminComponent>(
		defaultAuthenticationAdminComponentType
	);

	const currentContextIds = (await ContextIdStore.getContextIds()) ?? {};
	await ContextIdStore.run(
		{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
		async () => {
			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-remove.labels.removingUser"));

			// Removing the user also removes the data stored for its account.
			await authenticationAdminComponent.remove(paramsEmail);

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-remove.labels.userRemoved"));
		}
	);

	CLIDisplay.break();
	CLIDisplay.done();
}
