// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuthenticationAdminComponent } from "@3sixty/api-auth-entity-storage-models";
import {
	AuthenticationAccountDataType,
	AuthenticationAccountHelper
} from "@3sixty/api-auth-models";
import type { IAuthorizationComponent } from "@3sixty/authorization-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { Coerce, ComponentFactory, EnvHelper, GeneralError, Guards, I18n, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import { Did } from "@3sixty/identity-models";
import type { Person, WithContext } from "schema-dts";
import {
	getAccountAdminComponent,
	getAccountDataDid,
	joinOrganization,
	setAccountData
} from "../accountData.js";
import { AUTHORIZATION_MODEL_ID, DEFAULT_USER_ROLE } from "../defaults.js";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import { normaliseEmail } from "../utils.js";

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
				key: "roles",
				type: "string",
				description: I18n.formatMessage("node.cli.commands.user-update.params.roles.description"),
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
 * @param params.roles The roles for the user.
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
		roles?: string;
		givenName?: string;
		familyName?: string;
	}
): Promise<
	| {
			accountId: string;
			did: string;
			organizationDid: string;
			email: string;
			roles: string[];
			givenName: string;
			familyName: string;
	  }
	| undefined
> {
	const paramsEmail = Is.stringValue(params.email) ? normaliseEmail(params.email) : params.email;
	const paramsUserIdentity = params.userIdentity;
	const paramsOrganizationIdentity = params.organizationIdentity;
	const authorizationModelId = envVars.authorizationModelId ?? AUTHORIZATION_MODEL_ID;

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

	const accountAdminComponent = getAccountAdminComponent(engineCore);

	const defaultAuthenticationAdminComponentType = engineCore.getRegisteredInstanceType(
		"authenticationAdminComponent"
	);
	const authenticationAdminComponent = ComponentFactory.get<IAuthenticationAdminComponent>(
		defaultAuthenticationAdminComponentType
	);
	const defaultAuthorizationComponentType =
		engineCore.getRegisteredInstanceType("authorizationComponent");
	const authorizationComponent = ComponentFactory.get<IAuthorizationComponent>(
		defaultAuthorizationComponentType
	);

	const currentContextIds = (await ContextIdStore.getContextIds()) ?? {};
	const returnJson = await ContextIdStore.run(
		{ ...currentContextIds, [ContextIdKeys.Tenant]: params.tenantId },
		async () => {
			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.updating"));

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.storingUser"));

			const account = await authenticationAdminComponent.get(paramsEmail);

			if (Is.stringValue(paramsUserIdentity)) {
				await setAccountData(
					accountAdminComponent,
					account.accountId,
					AuthenticationAccountDataType.Identity,
					AuthenticationAccountHelper.createIdentityData(paramsUserIdentity)
				);
			}
			if (Is.stringValue(paramsOrganizationIdentity)) {
				// The user joins the organization directly, with a membership credential issued to its identity.
				await joinOrganization(engineCore, envVars, account.accountId, paramsOrganizationIdentity);
			}

			const identity =
				paramsUserIdentity ??
				(await getAccountDataDid(
					accountAdminComponent,
					account.accountId,
					AuthenticationAccountDataType.Identity
				));
			if (!Is.stringValue(identity)) {
				throw new GeneralError("userUpdate", "identityNotFound", { email: paramsEmail });
			}
			const organization =
				paramsOrganizationIdentity ??
				(await getAccountDataDid(
					accountAdminComponent,
					account.accountId,
					AuthenticationAccountDataType.Organization
				));

			// Roles are held by the account id.
			let currentRoles = await authorizationComponent.getRolesForSubject(
				authorizationModelId,
				account.accountId
			);

			if (Is.stringValue(params.roles)) {
				const roles = EnvHelper.commaSeparatedListToArray<string>(params.roles);
				if (roles.length === 0) {
					roles.push(DEFAULT_USER_ROLE);
				}

				const rolesToAdd = roles.filter(role => !currentRoles.includes(role));
				const rolesToRemove = currentRoles.filter(role => !roles.includes(role));

				for (const role of rolesToAdd) {
					await authorizationComponent.addRoleForSubject(
						authorizationModelId,
						account.accountId,
						role
					);
				}
				for (const role of rolesToRemove) {
					await authorizationComponent.removeRoleForSubject(
						authorizationModelId,
						account.accountId,
						role
					);
				}

				currentRoles = roles;
			}

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
			await setAccountData(
				accountAdminComponent,
				account.accountId,
				AuthenticationAccountDataType.PublicProfile,
				publicProfile
			);
			await setAccountData(
				accountAdminComponent,
				account.accountId,
				AuthenticationAccountDataType.PrivateProfile,
				privateProfile
			);

			CLIDisplay.task(I18n.formatMessage("node.cli.commands.user-update.labels.userUpdated"));

			CLIDisplay.break();

			const json = {
				accountId: account.accountId,
				did: identity,
				organizationDid: organization ?? "",
				email: paramsEmail,
				roles: currentRoles,
				givenName: params.givenName ?? "",
				familyName: params.familyName ?? ""
			};

			CLIDisplay.done();

			return json;
		}
	);

	return returnJson;
}
