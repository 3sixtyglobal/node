// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IAuthenticationAdminComponent,
	IAuthenticationUser
} from "@twin.org/api-auth-entity-storage-models";
import { ScopeHelper } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { Did, IdentityProfileConnectorFactory } from "@twin.org/identity-models";
import type { Person, WithContext } from "schema-dts";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

const COMMAND_NAME = "user-update";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionUserUpdate(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.user-update.description"),
		example: I18n.formatMessage("node.cli.commands.user-update.example"),
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "user-identity",
				type: "string",
				extendedType: "DID",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.user-identity.description"
				),
				required: false
			},
			{
				key: "organization-identity",
				type: "string",
				extendedType: "DID",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.organization-identity.description"
				),
				required: false
			},
			{
				key: "tenant-id",
				type: "string",
				extendedType: "hex(32)",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.tenant-id.description"
				),
				required: false
			},
			{
				key: "email",
				type: "string",
				extendedType: "email",
				description: I18n.formatMessage("node.cli.commands.user-update.params.email.description")
			},
			{
				key: "scope",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.user-update.params.scope.description"),
				required: false
			},
			{
				key: "given-name",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.given-name.description"
				),
				required: false
			},
			{
				key: "family-name",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.family-name.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.user-update.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => userUpdate(engineCore, envVars, params)
	};
}

/**
 * Command for updating a user.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @param params.userIdentity The DID for the user.
 * @param params.organizationIdentity The organization DID for the user.
 * @param params.tenantId The tenant ID for the user.
 * @param params.email The email for the user.
 * @param params.scope The scope for the user.
 * @param params.givenName The given name for the user.
 * @param params.familyName The family name for the user.
 * @returns The updated user details or undefined if skipped.
 */
export async function userUpdate(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	params: {
		userIdentity?: string;
		organizationIdentity?: string;
		tenantId?: string;
		email?: string;
		scope?: string;
		givenName?: string;
		familyName?: string;
	}
): Promise<
	| {
			did: string;
			organizationDid: string;
			email: string;
			scope: string[];
			givenName: string;
			familyName: string;
	  }
	| undefined
> {
	const paramsEmail = params.email;
	const paramsUserIdentity = params.userIdentity;
	const paramsOrganizationIdentity = params.organizationIdentity;

	Guards.email("userUpdate", "email", paramsEmail);
	if (Is.stringValue(paramsUserIdentity)) {
		Did.guard("userUpdate", "user-identity", paramsUserIdentity);
	}
	if (Is.stringValue(paramsOrganizationIdentity)) {
		Did.guard("userUpdate", "organization-identity", paramsOrganizationIdentity);
	}
	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	if (Is.stringValue(params.tenantId)) {
		if (!tenantEnabled) {
			throw new GeneralError("userUpdate", "tenantIdNotAllowed");
		}
		Guards.stringHexLength("userUpdate", "tenant-id", params.tenantId, 32);
	} else if (tenantEnabled) {
		throw new GeneralError("userUpdate", "tenantIdRequired");
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
	const returnJson = await ContextIdStore.run(
		{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
		async () => {
			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.updating"));

			const user: Partial<IAuthenticationUser> = {
				email: paramsEmail,
				userIdentity: paramsUserIdentity,
				organizationIdentity: paramsOrganizationIdentity,
				scope: ScopeHelper.toArray(params.scope)
			};

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.storingUser"));

			const existingUser = await authenticationAdminComponent.get(paramsEmail);
			await authenticationAdminComponent.update(user);

			const name = `${params.givenName ?? ""} ${params.familyName ?? ""}`.trim();
			const publicProfile: WithContext<Person> = {
				"@context": "https://schema.org",
				"@type": "Person",
				name: name.length > 0 ? name : undefined
			};
			const privateProfile: WithContext<Person> = {
				"@context": "https://schema.org",
				"@type": "Person",
				givenName: params.givenName,
				familyName: params.familyName,
				email: paramsEmail
			};

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.storingProfile"));
			await identityProfileConnector.update(
				existingUser.userIdentity,
				publicProfile,
				privateProfile
			);

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.userUpdated"));

			CLIDisplay.break();

			const json = {
				did: params.userIdentity ?? existingUser.userIdentity,
				organizationDid: params.organizationIdentity ?? existingUser.organizationIdentity,
				email: paramsEmail,
				scope: Is.stringValue(params.scope)
					? ScopeHelper.toArray(params.scope)
					: existingUser.scope,
				givenName: params.givenName ?? "",
				familyName: params.familyName ?? ""
			};

			CLIDisplay.done();

			return json;
		}
	);

	return returnJson;
}
