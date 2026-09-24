// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuthenticationAdminComponent } from "@twin.org/api-auth-entity-storage-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import {
	BaseError,
	Coerce,
	ComponentFactory,
	GeneralError,
	Guards,
	I18n,
	Is,
	NotFoundError
} from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { IdentityProfileConnectorFactory } from "@twin.org/identity-models";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

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
	const paramsEmail = params.email;
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

	const defaultIdentityProfileConnectorType = engineCore.getRegisteredInstanceType(
		"identityProfileConnector"
	);
	const identityProfileConnector = IdentityProfileConnectorFactory.get(
		defaultIdentityProfileConnectorType
	);

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

			const existingUser = await authenticationAdminComponent.get(paramsEmail);
			await authenticationAdminComponent.remove(paramsEmail);

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-remove.labels.removingProfile"));
			try {
				await identityProfileConnector.remove(existingUser.userIdentity);
			} catch (error) {
				// Users created outside the CLI may not have a profile, which is not a failure
				if (!BaseError.someErrorName(error, NotFoundError.CLASS_NAME)) {
					throw error;
				}
				CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-remove.labels.noProfile"));
			}

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-remove.labels.userRemoved"));
		}
	);

	CLIDisplay.break();
	CLIDisplay.done();
}
