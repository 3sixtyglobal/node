// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import {
	type AccountData,
	AvatarAccountDataVerifier,
	IdentityAccountDataVerifier,
	LogoAccountDataVerifier,
	type Organization,
	OrganizationAccountDataVerifier,
	OrganizationHelper,
	OrganizationMembershipHelper,
	PublicDataAccountDataVerifier,
	VerifiableCredentialAccountDataVerifier
} from "@3sixty/api-auth-account-service";
import {
	AccountDataValidationFactory,
	AuthenticationAccountDataType,
	AuthenticationAccountHelper,
	type IAuthenticationAccountAdminComponent,
	type IAuthenticationAccountData
} from "@3sixty/api-auth-models";
import {
	type IPlatformComponent,
	type ITenantAdminComponent,
	TenantEventType
} from "@3sixty/api-models";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { Coerce, ComponentFactory, Is } from "@3sixty/core";
import type { IEngineCore } from "@3sixty/engine-models";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { IIdentityComponent } from "@3sixty/identity-models";
import { nameofKebabCase } from "@3sixty/nameof";
import { TRUST_VERIFICATION_METHOD_ID } from "./defaults.js";
import type { IEnvironmentVariables } from "./models/IEnvironmentVariables.js";

/**
 * Add an account to an organization directly, without a request, issuing the membership credential
 * signed with the trust verification method of the organization and storing the organization, as
 * the default, and the credential as account data.
 * @param engineCore The engine core.
 * @param envVars The environment variables.
 * @param accountId The account id.
 * @param organization The DID of the organization.
 * @returns A promise that resolves when the account is in the organization.
 */
export async function joinOrganization(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	accountId: string,
	organization: string
): Promise<void> {
	await OrganizationMembershipHelper.join(
		EntityStorageConnectorFactory.get<IEntityStorageConnector<AccountData>>(
			nameofKebabCase<AccountData>()
		),
		EntityStorageConnectorFactory.get<IEntityStorageConnector<Organization>>("organization"),
		ComponentFactory.get<IIdentityComponent>(
			engineCore.getRegisteredInstanceType("identityComponent")
		),
		envVars.trustVerificationMethodId ?? TRUST_VERIFICATION_METHOD_ID,
		accountId,
		organization,
		true
	);
}

/**
 * Register the organization of the node, or of every tenant and each tenant created or changed
 * later, so accounts can join it. Registering is skipped when the organization storage is not
 * configured, and a registered organization is not added again.
 * @param engineCore The running engine core.
 * @param envVars The environment variables.
 * @returns A promise that resolves when the organizations have been registered.
 */
export async function registerPartitionOrganizations(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): Promise<void> {
	const organizationStorage =
		EntityStorageConnectorFactory.getIfExists<IEntityStorageConnector<Organization>>(
			"organization"
		);
	if (Is.empty(organizationStorage)) {
		return;
	}

	const nodeContextIds = engineCore.getContextIds() ?? {};
	if (!(Coerce.boolean(envVars.tenantEnabled) ?? false)) {
		const organization = nodeContextIds[ContextIdKeys.Organization];
		if (Is.stringValue(organization)) {
			await ContextIdStore.run(nodeContextIds, async () => {
				await OrganizationHelper.register(organizationStorage, organization);
			});
		}
		return;
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(
		engineCore.getRegisteredInstanceType("tenantAdminComponent")
	);
	const platformComponent = ComponentFactory.get<IPlatformComponent>(
		engineCore.getRegisteredInstanceType("platformComponent")
	);

	let cursor: string | undefined;
	do {
		const page = await ContextIdStore.run(nodeContextIds, async () =>
			tenantAdminComponent.query(undefined, ["id", "organizationId"], cursor)
		);
		for (const tenant of page.tenants) {
			if (Is.stringValue(tenant.organizationId)) {
				const organization = tenant.organizationId;
				await ContextIdStore.run(
					{ ...nodeContextIds, [ContextIdKeys.Tenant]: tenant.id },
					async () => {
						await OrganizationHelper.register(organizationStorage, organization);
					}
				);
			}
		}
		cursor = page.cursor;
	} while (Is.stringValue(cursor));

	// The organization of a tenant can be set when it is created or changed later.
	platformComponent.registerTenantEventCallback(
		"registerPartitionOrganizations",
		async (tenantId, eventType) => {
			if (eventType === TenantEventType.Created || eventType === TenantEventType.Updated) {
				const tenant = await ContextIdStore.run(nodeContextIds, async () =>
					tenantAdminComponent.get(tenantId)
				);
				if (Is.stringValue(tenant.organizationId)) {
					const organization = tenant.organizationId;
					await ContextIdStore.run(
						{ ...nodeContextIds, [ContextIdKeys.Tenant]: tenantId },
						async () => {
							await OrganizationHelper.register(organizationStorage, organization);
						}
					);
				}
			}
		}
	);
}

/**
 * Get the component that manages the data of any account.
 * @param engineCore The engine core.
 * @returns The account admin component.
 */
export function getAccountAdminComponent(
	engineCore: IEngineCore
): IAuthenticationAccountAdminComponent {
	return ComponentFactory.get<IAuthenticationAccountAdminComponent>(
		engineCore.getRegisteredInstanceType("authenticationAccountAdminComponent")
	);
}

/**
 * Get the item of a type to use for an account, the default item, otherwise the earliest created.
 * @param accountAdmin The account admin component.
 * @param accountId The account id.
 * @param type The type of the item.
 * @returns The item, or undefined when the account has none of the type.
 */
export async function getAccountDataItem(
	accountAdmin: IAuthenticationAccountAdminComponent,
	accountId: string,
	type: string
): Promise<IAuthenticationAccountData | undefined> {
	const items: IAuthenticationAccountData[] = [];
	let cursor: string | undefined;
	do {
		const page = await accountAdmin.query(accountId, type, cursor);
		items.push(...page.entities);
		cursor = page.cursor;
	} while (Is.stringValue(cursor));

	return (
		items.find(item => item.isDefault) ??
		items.sort((a, b) => a.dateCreated.localeCompare(b.dateCreated))[0]
	);
}

/**
 * Get the DID held by the identity or organization item of an account.
 * @param accountAdmin The account admin component.
 * @param accountId The account id.
 * @param type The type of the item, identity or organization.
 * @returns The DID, or undefined when the account has none of the type.
 */
export async function getAccountDataDid(
	accountAdmin: IAuthenticationAccountAdminComponent,
	accountId: string,
	type:
		| typeof AuthenticationAccountDataType.Identity
		| typeof AuthenticationAccountDataType.Organization
): Promise<string | undefined> {
	const item = await getAccountDataItem(accountAdmin, accountId, type);
	return type === AuthenticationAccountDataType.Identity
		? AuthenticationAccountHelper.getIdentity(item?.data)
		: AuthenticationAccountHelper.getOrganization(item?.data);
}

/**
 * Set the value of a type for an account, replacing the item in use or storing a new default item.
 * An identity cannot be changed in place, so its item is removed and a new one stored.
 * @param accountAdmin The account admin component.
 * @param accountId The account id.
 * @param type The type of the item.
 * @param data The value of the item.
 * @returns A promise that resolves when the value has been stored.
 */
export async function setAccountData(
	accountAdmin: IAuthenticationAccountAdminComponent,
	accountId: string,
	type: string,
	data: unknown
): Promise<void> {
	const item = await getAccountDataItem(accountAdmin, accountId, type);
	if (Is.object(item) && type === AuthenticationAccountDataType.Identity) {
		if (
			AuthenticationAccountHelper.getIdentity(item.data) ===
			AuthenticationAccountHelper.getIdentity(data)
		) {
			return;
		}
		await accountAdmin.remove(item.id);
		await accountAdmin.create(accountId, type, data, true);
	} else if (Is.object(item)) {
		await accountAdmin.update(item.id, data, true);
	} else {
		await accountAdmin.create(accountId, type, data, true);
	}
}

/**
 * Register the verifiers of the account data types with a meaning to the node, so every item of
 * those types is checked before it is stored, and a type with no verifier only has to be a JSON
 * object. An extension can register a verifier of its own for another type, or replace one of these.
 */
export function registerAccountDataVerifiers(): void {
	AccountDataValidationFactory.register(
		AuthenticationAccountDataType.Identity,
		() => new IdentityAccountDataVerifier()
	);
	AccountDataValidationFactory.register(
		AuthenticationAccountDataType.Organization,
		() => new OrganizationAccountDataVerifier()
	);
	AccountDataValidationFactory.register(
		AuthenticationAccountDataType.VerifiableCredential,
		() => new VerifiableCredentialAccountDataVerifier()
	);
	AccountDataValidationFactory.register(
		AuthenticationAccountDataType.PublicData,
		() => new PublicDataAccountDataVerifier()
	);
	AccountDataValidationFactory.register(
		AuthenticationAccountDataType.Logo,
		() => new LogoAccountDataVerifier()
	);
	AccountDataValidationFactory.register(
		AuthenticationAccountDataType.Avatar,
		() => new AvatarAccountDataVerifier()
	);
}
