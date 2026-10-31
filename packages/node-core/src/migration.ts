// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import {
	type AccountData,
	AccountDataHelper,
	type Organization,
	OrganizationHelper,
	OrganizationMembershipHelper
} from "@3sixty/api-auth-account-service";
import type {
	AuthenticationUser,
	AuthenticationUserV0,
	AuthenticationUserV1
} from "@3sixty/api-auth-entity-storage-service";
import {
	AuthenticationAccountDataType,
	AuthenticationAccountHelper
} from "@3sixty/api-auth-models";
import type { ITenantAdminComponent } from "@3sixty/api-models";
import {
	AuditableItemGraphVertexIndexHelper,
	type AuditableItemGraphVertex,
	type AuditableItemGraphVertexIndex,
	type AuditableItemGraphVertexV1
} from "@3sixty/auditable-item-graph-service";
import type { IAuthorizationComponent, IAuthorizationPolicy } from "@3sixty/authorization-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import {
	BaseError,
	Coerce,
	ComponentFactory,
	Converter,
	EnvHelper,
	GeneralError,
	I18n,
	Is,
	RandomHelper,
	StringHelper
} from "@3sixty/core";
import { Sha256 } from "@3sixty/crypto";
import type { IEngineCore } from "@3sixty/engine-models";
import { ComparisonOperator, type IEntitySchemaProperty } from "@3sixty/entity";
import {
	EntityStorageConnectorFactory,
	SchemaMigrationFactory,
	type IEntityStorageConnector,
	type ISchemaMigration
} from "@3sixty/entity-storage-models";
import type { IdentityProfile } from "@3sixty/identity-connector-entity-storage";
import type { IIdentityComponent } from "@3sixty/identity-models";
import { nameof, nameofKebabCase } from "@3sixty/nameof";
import {
	OdrlPolicyIndexHelper,
	type OdrlPolicy,
	type OdrlPolicyIndex,
	type OdrlPolicyV0
} from "@3sixty/rights-management-pap-service";
import {
	AUTHORIZATION_MODEL_ID,
	DEFAULT_DEVOPS_ROLE,
	DEFAULT_IDENTITY_ADMIN_ROLE,
	DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
	DEFAULT_TENANT_ADMIN_ROLE,
	DEFAULT_USER_ADMIN_ROLE,
	DEFAULT_USER_ROLE,
	TRUST_VERIFICATION_METHOD_ID
} from "./defaults.js";
import type { IAccountMigrationRecord } from "./models/IAccountMigrationRecord.js";
import type { IEnvironmentVariables } from "./models/IEnvironmentVariables.js";
import type { IIdentityMigrationRecord } from "./models/IIdentityMigrationRecord.js";
import type { IOrganizationMigrationRecord } from "./models/IOrganizationMigrationRecord.js";
import { normaliseEmail } from "./utils.js";

/**
 * The account data type of the records holding the work left from migrating accounts, reserved so
 * the records cannot be read or written through the account services.
 */
const MIGRATION_ACCOUNT_DATA_TYPE = "migration";

/**
 * The account id the migration records are stored under, apart from every real account.
 */
const MIGRATION_ACCOUNT_ID = "migration";

/**
 * The entity storage of the authorization connector holding rules keyed by subject, used to find
 * the models a DID has rules in.
 */
const AUTHORIZATION_SUBJECT_STORAGE_NAMES: string[] = [
	"authorization-role-assignment",
	"authorization-policy"
];

/**
 * Initialise schema migrations for the engine.
 * @param engineCore The engine core instance.
 * @param envVars The environment variables.
 */
export function initialiseMigrations(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): void {
	if (!EnvHelper.envBoolean(envVars, "schemaMigrationEnabled", true)) {
		return;
	}

	migrationAuthenticationUserRoles();
	migrationAuthenticationUserAccounts();
	migrationAigIndexes();
	migrationPapIndexes();
}

/**
 * Complete the work the migrations stored as account data, once all the components have started.
 * Each record is removed only when its work succeeds, so a failure is retried on the next start.
 * @param engineCore The engine core instance.
 * @param envVars The environment variables.
 */
export async function finalizeMigrations(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables
): Promise<void> {
	if (!EnvHelper.envBoolean(envVars, "schemaMigrationEnabled", true)) {
		return;
	}
	const accountDataStorage =
		EntityStorageConnectorFactory.getIfExists<IEntityStorageConnector<AccountData>>(
			nameofKebabCase<AccountData>()
		);
	if (Is.empty(accountDataStorage)) {
		return;
	}

	const nodeContextIds = engineCore.getContextIds() ?? {};
	if (!(Coerce.boolean(envVars.tenantEnabled) ?? false)) {
		await ContextIdStore.run(nodeContextIds, async () =>
			finalizePartition(
				engineCore,
				envVars,
				accountDataStorage,
				nodeContextIds[ContextIdKeys.Organization]
			)
		);
		return;
	}

	// The records are stored in the partition of the tenant the user belonged to.
	const tenantAdminComponentType =
		engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");
	if (!Is.stringValue(tenantAdminComponentType)) {
		return;
	}
	const tenantAdminComponent =
		ComponentFactory.get<ITenantAdminComponent>(tenantAdminComponentType);
	let cursor: string | undefined;
	do {
		const page = await ContextIdStore.run(nodeContextIds, async () =>
			tenantAdminComponent.query(undefined, ["id", "organizationId"], cursor)
		);
		for (const tenant of page.tenants) {
			await ContextIdStore.run({ ...nodeContextIds, [ContextIdKeys.Tenant]: tenant.id }, async () =>
				finalizePartition(engineCore, envVars, accountDataStorage, tenant.organizationId)
			);
		}
		cursor = page.cursor;
	} while (Is.stringValue(cursor));
}

/**
 * Complete the migration records of the current partition, and register the organization of the
 * partition, the tenant organization or the node organization.
 * @param engineCore The engine core instance.
 * @param envVars The environment variables.
 * @param accountDataStorage The account data storage.
 * @param partitionOrganization The DID of the organization of the partition.
 */
async function finalizePartition(
	engineCore: IEngineCore,
	envVars: IEnvironmentVariables,
	accountDataStorage: IEntityStorageConnector<AccountData>,
	partitionOrganization: string | undefined
): Promise<void> {
	const organizationStorage =
		EntityStorageConnectorFactory.getIfExists<IEntityStorageConnector<Organization>>(
			nameofKebabCase<Organization>()
		);
	if (Is.object(organizationStorage) && Is.stringValue(partitionOrganization)) {
		try {
			await registerOrganization(organizationStorage, accountDataStorage, partitionOrganization);
		} catch (error) {
			CLIDisplay.warning(
				I18n.formatMessage("warn.node.migrationRecordFailed", {
					subject: partitionOrganization,
					error: BaseError.fromError(error).message
				})
			);
		}
	}

	const authorizationComponent = ComponentFactory.get<IAuthorizationComponent>(
		engineCore.getRegisteredInstanceType("authorizationComponent")
	);
	const identityComponentType = engineCore.getRegisteredInstanceTypeOptional("identityComponent");
	const identityComponent = Is.stringValue(identityComponentType)
		? ComponentFactory.get<IIdentityComponent>(identityComponentType)
		: undefined;
	const modelId = EnvHelper.envString(envVars, "authorizationModelId", AUTHORIZATION_MODEL_ID);
	const verificationMethodId = envVars.trustVerificationMethodId ?? TRUST_VERIFICATION_METHOD_ID;

	// Removing a record while paging could move a later one before the cursor, so the completed
	// records are removed once every page has been read.
	const completed: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await AccountDataHelper.query(
			accountDataStorage,
			MIGRATION_ACCOUNT_ID,
			MIGRATION_ACCOUNT_DATA_TYPE,
			cursor
		);
		for (const item of page.entities) {
			const record = item.data as
				IAccountMigrationRecord | IIdentityMigrationRecord | IOrganizationMigrationRecord;
			try {
				let done: boolean;
				if (record.kind === "identity") {
					done = await finalizeIdentityRecord(authorizationComponent, modelId, record);
				} else if (record.kind === "organization") {
					// Kept until the organization storage is configured.
					done = Is.object(organizationStorage);
					if (Is.object(organizationStorage)) {
						await registerOrganization(
							organizationStorage,
							accountDataStorage,
							record.organization
						);
					}
				} else {
					done = await finalizeAccountRecord(
						accountDataStorage,
						authorizationComponent,
						identityComponent,
						modelId,
						verificationMethodId,
						item.id,
						record
					);
				}
				if (done) {
					completed.push(item.id);
				}
			} catch (error) {
				CLIDisplay.warning(
					I18n.formatMessage("warn.node.migrationRecordFailed", {
						subject: migrationRecordSubject(record),
						error: BaseError.fromError(error).message
					})
				);
			}
		}
		cursor = page.cursor;
	} while (Is.stringValue(cursor));

	for (const id of completed) {
		await accountDataStorage.remove(id);
	}
}

/**
 * Get the subject a migration record is for, to report a failure.
 * @param record The record.
 * @returns The DID or e-mail address the record is for.
 */
function migrationRecordSubject(
	record: IAccountMigrationRecord | IIdentityMigrationRecord | IOrganizationMigrationRecord
): string {
	if (record.kind === "identity") {
		return record.identity;
	}
	if (record.kind === "organization") {
		return record.organization;
	}
	return record.email;
}

/**
 * Register an organization by its DID, copy its identity profile to the profiles of the
 * organization when it has none, and store the name it is searched by. The organization is found by
 * its DID, so a repeated run adds nothing.
 * @param organizationStorage The organization storage.
 * @param accountDataStorage The account data storage, which holds the organization profiles owned by its DID.
 * @param identity The DID of the organization.
 */
async function registerOrganization(
	organizationStorage: IEntityStorageConnector<Organization>,
	accountDataStorage: IEntityStorageConnector<AccountData>,
	identity: string
): Promise<void> {
	const { organization } = await OrganizationHelper.register(organizationStorage, identity);

	const profileStorage =
		EntityStorageConnectorFactory.getIfExists<IEntityStorageConnector<IdentityProfile>>(
			nameofKebabCase<IdentityProfile>()
		);
	const profile = await profileStorage?.get(identity);
	if (!Is.object<IdentityProfile>(profile)) {
		return;
	}

	const profiles: [string, unknown][] = [
		[AuthenticationAccountDataType.PublicProfile, profile.publicProfile],
		[AuthenticationAccountDataType.PrivateProfile, profile.privateProfile]
	];
	for (const [type, data] of profiles) {
		if (
			Is.object(data) &&
			!Is.object(await AccountDataHelper.getDefault(accountDataStorage, identity, type))
		) {
			await AccountDataHelper.create(accountDataStorage, identity, type, data, true);
		}
	}

	if (!Is.stringValue(organization.searchName)) {
		const publicProfile = await AccountDataHelper.getDefault(
			accountDataStorage,
			identity,
			AuthenticationAccountDataType.PublicProfile
		);
		await OrganizationHelper.storeSearchName(
			organizationStorage,
			organization,
			publicProfile?.data
		);
	}
}

/**
 * Assign the v0 roles of a migrated user to its account and issue the membership credential of its
 * organization. A credential that cannot be issued is logged and left for the next start.
 * @param accountDataStorage The account data storage.
 * @param authorizationComponent The authorization component.
 * @param identityComponent The identity component, if configured.
 * @param modelId The authorization model id.
 * @param verificationMethodId The verification method of the organization that signs credentials.
 * @param id The id of the record.
 * @param record The record.
 * @returns True when the record is complete.
 */
async function finalizeAccountRecord(
	accountDataStorage: IEntityStorageConnector<AccountData>,
	authorizationComponent: IAuthorizationComponent,
	identityComponent: IIdentityComponent | undefined,
	modelId: string,
	verificationMethodId: string,
	id: string,
	record: IAccountMigrationRecord
): Promise<boolean> {
	if (Is.arrayValue(record.roles)) {
		for (const role of record.roles) {
			await authorizationComponent.addRoleForSubject(modelId, record.accountId, role);
		}
		await storeRecord(accountDataStorage, id, { ...record, roles: undefined });
	}

	if (Is.stringValue(record.organization)) {
		try {
			if (Is.empty(identityComponent)) {
				throw new GeneralError("node", "migrationIdentityComponentMissing");
			}
			await OrganizationMembershipHelper.join(
				accountDataStorage,
				identityComponent,
				verificationMethodId,
				record.accountId,
				record.organization
			);
		} catch (error) {
			CLIDisplay.warning(
				I18n.formatMessage("warn.node.migrationCredentialFailed", {
					email: record.email,
					organization: record.organization,
					error: BaseError.fromError(error).message
				})
			);
			return false;
		}
	}

	return true;
}

/**
 * Move the authorization rules of a DID, its role assignments and its direct policies in every
 * model it has rules in, to every account of a user that held it. Every account is given every
 * rule before any rule of the DID is removed, so a repeated run completes it.
 * @param authorizationComponent The authorization component.
 * @param modelId The configured authorization model id.
 * @param record The record.
 * @returns True when the record is complete.
 */
async function finalizeIdentityRecord(
	authorizationComponent: IAuthorizationComponent,
	modelId: string,
	record: IIdentityMigrationRecord
): Promise<boolean> {
	const modelIds = await findSubjectModelIds(record.identity, modelId);

	const rules: { modelId: string; roles: string[]; policies: IAuthorizationPolicy[] }[] = [];
	for (const id of modelIds) {
		const roles = await authorizationComponent.getRolesForSubject(id, record.identity);
		const policies: IAuthorizationPolicy[] = [];
		let cursor: string | undefined;
		do {
			const page = await authorizationComponent.getPoliciesForSubject(id, record.identity, cursor);
			// Only the rules of the DID itself are moved.
			policies.push(...page.entities.filter(policy => policy.subject === record.identity));
			cursor = page.cursor;
		} while (Is.stringValue(cursor));
		rules.push({ modelId: id, roles, policies });
	}

	for (const accountId of record.accountIds) {
		for (const rule of rules) {
			for (const role of rule.roles) {
				await authorizationComponent.addRoleForSubject(rule.modelId, accountId, role);
			}
			for (const policy of rule.policies) {
				await authorizationComponent.addPolicy(
					rule.modelId,
					accountId,
					policy.object,
					policy.action
				);
			}
		}
	}

	for (const rule of rules) {
		for (const role of rule.roles) {
			await authorizationComponent.removeRoleForSubject(rule.modelId, record.identity, role);
		}
		for (const policy of rule.policies) {
			await authorizationComponent.removePolicy(
				rule.modelId,
				record.identity,
				policy.object,
				policy.action
			);
		}
	}
	return true;
}

/**
 * Find the authorization models a subject has rules in. The component cannot list its models, so
 * the configured model is always included, and the models of the rows held in the entity storage
 * of the authorization connector are added when that storage is used.
 * @param subject The subject.
 * @param modelId The configured authorization model id.
 * @returns The model ids.
 */
async function findSubjectModelIds(subject: string, modelId: string): Promise<string[]> {
	const modelIds = new Set<string>([modelId]);
	const storages: IEntityStorageConnector<{ id: string; modelId: string; subject: string }>[] = [];
	for (const storageName of AUTHORIZATION_SUBJECT_STORAGE_NAMES) {
		const storage =
			EntityStorageConnectorFactory.getIfExists<
				IEntityStorageConnector<{ id: string; modelId: string; subject: string }>
			>(storageName);
		if (Is.object(storage)) {
			storages.push(storage);
		}
	}
	for (const storage of storages) {
		let cursor: string | undefined;
		do {
			const page = await storage.query(
				{ property: "subject", value: subject, comparison: ComparisonOperator.Equals },
				undefined,
				["modelId", "subject"],
				cursor
			);
			for (const row of page.entities) {
				if (row.subject === subject && Is.stringValue(row.modelId)) {
					modelIds.add(row.modelId);
				}
			}
			cursor = page.cursor;
		} while (Is.stringValue(cursor));
	}
	return [...modelIds];
}

/**
 * Get the account data storage the migrated accounts are written to.
 * @returns The account data storage.
 * @throws GeneralError when the account data storage is not configured.
 */
function getAccountDataStorage(): IEntityStorageConnector<AccountData> {
	const accountDataStorage =
		EntityStorageConnectorFactory.getIfExists<IEntityStorageConnector<AccountData>>(
			nameofKebabCase<AccountData>()
		);
	if (Is.empty(accountDataStorage)) {
		throw new GeneralError("node", "migrationAccountDataMissing");
	}
	return accountDataStorage;
}

/**
 * Get the id of a migration record, derived from its key so a repeated run replaces it.
 * @param kind The kind of record.
 * @param key The e-mail address or DID the record is for.
 * @returns The id of the record.
 */
function migrationRecordId(kind: "account" | "identity" | "organization", key: string): string {
	return `migration-${kind}-${Converter.bytesToHex(Sha256.sum256(Converter.utf8ToBytes(key)))}`;
}

/**
 * Store a migration record, replacing any previous version.
 * @param accountDataStorage The account data storage.
 * @param id The id of the record.
 * @param record The record.
 */
async function storeRecord(
	accountDataStorage: IEntityStorageConnector<AccountData>,
	id: string,
	record: IAccountMigrationRecord | IIdentityMigrationRecord | IOrganizationMigrationRecord
): Promise<void> {
	await AccountDataHelper.create(
		accountDataStorage,
		MIGRATION_ACCOUNT_ID,
		MIGRATION_ACCOUNT_DATA_TYPE,
		record,
		false,
		id
	);
}

/**
 * Get the migration record of a user, storing one with a new account id when there is none, so a
 * run after an interrupted one keeps the account id and the account data already written. The
 * record is keyed by the normalised e-mail address. When another user already holds that key, the
 * record is keyed apart from it and the user it collides with is returned. A
 * record a previous run keyed by the original e-mail address is moved to the normalised key when
 * the key is free.
 * @param email The e-mail address of the user, as stored.
 * @param accountId The account id of the user, when it is known.
 * @returns The record, its id and the e-mail address of the user it collides with, if any.
 */
async function getAccountRecord(
	email: string,
	accountId?: string
): Promise<{ id: string; record: IAccountMigrationRecord; collidesWith?: string }> {
	const accountDataStorage = getAccountDataStorage();
	const normalisedId = migrationRecordId("account", normaliseEmail(email));
	const originalId = migrationRecordId("account", email);

	const normalisedItem = await accountDataStorage.get(normalisedId);
	const normalisedRecord = Is.object<AccountData>(normalisedItem)
		? (normalisedItem.data as IAccountMigrationRecord)
		: undefined;
	if (
		Is.object(normalisedRecord) &&
		(normalisedRecord.email === email || normalisedRecord.accountId === accountId)
	) {
		return { id: normalisedId, record: normalisedRecord };
	}

	const originalItem =
		originalId === normalisedId ? undefined : await accountDataStorage.get(originalId);
	const originalRecord = Is.object<AccountData>(originalItem)
		? (originalItem.data as IAccountMigrationRecord)
		: undefined;

	if (Is.object(normalisedRecord)) {
		// Another user has the same e-mail address apart from case and keeps it.
		if (Is.object(originalRecord)) {
			return { id: originalId, record: originalRecord, collidesWith: normalisedRecord.email };
		}
		// The original e-mail address can already be in lower case, so a separate key is used.
		const collisionId = migrationRecordId("account", `collision|${email}`);
		const collisionItem = await accountDataStorage.get(collisionId);
		if (Is.object<AccountData>(collisionItem)) {
			return {
				id: collisionId,
				record: collisionItem.data as IAccountMigrationRecord,
				collidesWith: normalisedRecord.email
			};
		}
		const record: IAccountMigrationRecord = {
			kind: "account",
			email,
			accountId: RandomHelper.generateUuidV7()
		};
		await storeRecord(accountDataStorage, collisionId, record);
		return { id: collisionId, record, collidesWith: normalisedRecord.email };
	}

	const record: IAccountMigrationRecord = originalRecord ?? {
		kind: "account",
		email,
		accountId: RandomHelper.generateUuidV7()
	};
	await storeRecord(accountDataStorage, normalisedId, record);
	if (Is.object(originalRecord)) {
		await accountDataStorage.remove(originalId);
	}
	return { id: normalisedId, record };
}

/**
 * Record that the account of a user held a DID, so it is given the roles of the DID.
 * @param identity The DID.
 * @param accountId The account id.
 */
async function addIdentityRecord(identity: string, accountId: string): Promise<void> {
	const accountDataStorage = getAccountDataStorage();
	const id = migrationRecordId("identity", identity);
	const existing = await accountDataStorage.get(id);
	const accountIds = Is.object<AccountData>(existing)
		? (existing.data as IIdentityMigrationRecord).accountIds
		: [];
	if (!accountIds.includes(accountId)) {
		await storeRecord(accountDataStorage, id, {
			kind: "identity",
			identity,
			accountIds: [...accountIds, accountId]
		});
	}
}

/**
 * Store the organization and identity profile of a migrated account as account data. Every write
 * replaces the item a previous interrupted run wrote, so the migration can run again. The old
 * identity profile is left in place, its routes are no longer served.
 * @param accountId The account id.
 * @param identity The DID the identity profile was stored for.
 * @param organization The organization DID of the account.
 */
async function migrateAccountData(
	accountId: string,
	identity: string | undefined,
	organization: string | undefined
): Promise<void> {
	const accountDataStorage = getAccountDataStorage();
	const profileStorage =
		EntityStorageConnectorFactory.getIfExists<IEntityStorageConnector<IdentityProfile>>(
			nameofKebabCase<IdentityProfile>()
		);

	const items: [string, unknown][] = [
		[
			AuthenticationAccountDataType.Organization,
			Is.stringValue(organization)
				? AuthenticationAccountHelper.createOrganizationData(organization)
				: undefined
		]
	];
	const profile = Is.stringValue(identity) ? await profileStorage?.get(identity) : undefined;
	if (Is.object<IdentityProfile>(profile)) {
		items.push([AuthenticationAccountDataType.PublicProfile, profile.publicProfile]);
		items.push([AuthenticationAccountDataType.PrivateProfile, profile.privateProfile]);
	}

	const values = items.filter(
		([, data]) => !Is.empty(data) && !(Is.string(data) && data.length === 0)
	);
	for (const [type, data] of values) {
		const existing = await AccountDataHelper.getDefault(accountDataStorage, accountId, type);
		if (Is.object(existing)) {
			await AccountDataHelper.update(accountDataStorage, existing.id, data, true);
		} else {
			await AccountDataHelper.create(accountDataStorage, accountId, type, data, true);
		}
	}
}

/**
 * Perform migrations for authentication user scopes to authorization roles.
 */
function migrationAuthenticationUserRoles(): void {
	const migrationV0V1: ISchemaMigration<AuthenticationUserV0, AuthenticationUserV1> = {
		removeEntityProperty: async (
			entity: AuthenticationUserV0,
			removedProperties: IEntitySchemaProperty<AuthenticationUserV0>[]
		): Promise<void> => {
			// If the scope property is not being removed, we don't need to do anything
			if (removedProperties.find(prop => prop.property === "scope") === undefined) {
				return;
			}

			let roles: string[] = [];
			if (Is.stringValue(entity.scope)) {
				roles = entity.scope
					.split(",")
					.map(role => role.trim().toLocaleLowerCase())
					.filter(role => role.length > 0);
			}
			if (roles.length === 0) {
				roles.push(DEFAULT_USER_ROLE);
			}

			// If the user has both tenant-admin and user-admin roles, we also add the new roles
			// to provide access to everything they had before
			if (roles.includes(DEFAULT_TENANT_ADMIN_ROLE) && roles.includes(DEFAULT_USER_ADMIN_ROLE)) {
				roles.push(DEFAULT_DEVOPS_ROLE);
				roles.push(DEFAULT_IDENTITY_ADMIN_ROLE);
				roles.push(DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE);
			}

			// The roles are stored in the partition being migrated before the migrated rows replace
			// the old ones, and are assigned to the account once the authorization component starts.
			const { id, record } = await getAccountRecord(entity.email);
			await storeRecord(getAccountDataStorage(), id, { ...record, roles });
		}
	};
	SchemaMigrationFactory.register(
		`${nameof<AuthenticationUser>()}_0_1`,
		() => migrationV0V1 as ISchemaMigration
	);
}

/**
 * Perform migrations for authentication users to accounts keyed by an account id, moving the
 * identity, organization and identity profile out to account data.
 */
function migrationAuthenticationUserAccounts(): void {
	const migrationV1V2: ISchemaMigration<
		AuthenticationUserV1 & Partial<AuthenticationUser>,
		AuthenticationUser
	> = {
		// The stored row has no account id, provider or dates, so they are supplied here.
		// A password account uses its e-mail address as the provider account id.
		transformEntity: async (
			entity: AuthenticationUserV1 & Partial<AuthenticationUser>
		): Promise<AuthenticationUserV1 & Partial<AuthenticationUser>> => {
			const { record, collidesWith } = await getAccountRecord(entity.email);
			const now = new Date().toISOString();
			if (Is.stringValue(collidesWith)) {
				// The later user keeps its e-mail address but is disabled for an admin to resolve.
				CLIDisplay.warning(
					I18n.formatMessage("warn.node.migrationEmailCollision", {
						email: entity.email,
						existingEmail: collidesWith
					})
				);
				return {
					...entity,
					accountId: record.accountId,
					authProviderId: "entity-storage",
					providerAccountId: entity.email,
					dateDisabled: now,
					dateCreated: now,
					dateModified: now
				};
			}
			const email = normaliseEmail(entity.email);
			return {
				...entity,
				email,
				accountId: record.accountId,
				authProviderId: "entity-storage",
				providerAccountId: email,
				dateCreated: now,
				dateModified: now
			};
		},
		removeEntityProperty: async (
			entity: AuthenticationUserV1 & Partial<AuthenticationUser>,
			removedProperties: IEntitySchemaProperty<AuthenticationUserV1 & Partial<AuthenticationUser>>[]
		): Promise<void> => {
			// If the identity property is not being removed, we don't need to do anything
			if (removedProperties.find(prop => prop.property === "identity") === undefined) {
				return;
			}
			if (!Is.stringValue(entity.accountId)) {
				return;
			}

			// Everything is written before the migrated rows replace the old ones, so a failure
			// leaves the old rows to migrate again.
			const accountDataStorage = getAccountDataStorage();
			let hasIdentity = false;
			if (Is.stringValue(entity.identity)) {
				// Users could share a DID, but only one account can hold it, so the first user keeps
				// it and the others are migrated without one.
				const holder = await accountDataStorage.get(AccountDataHelper.identityId(entity.identity));
				if (Is.object<AccountData>(holder) && holder.accountId !== entity.accountId) {
					CLIDisplay.warning(
						I18n.formatMessage("warn.node.migrationIdentityShared", {
							email: entity.email,
							identity: entity.identity
						})
					);
				} else {
					await AccountDataHelper.create(
						accountDataStorage,
						entity.accountId,
						AuthenticationAccountDataType.Identity,
						AuthenticationAccountHelper.createIdentityData(entity.identity),
						true,
						AccountDataHelper.identityId(entity.identity)
					);
					hasIdentity = true;
				}

				// Every account of a user that held the DID is given its roles.
				await addIdentityRecord(entity.identity, entity.accountId);
			}

			await migrateAccountData(entity.accountId, entity.identity, entity.organization);

			if (Is.stringValue(entity.organization)) {
				// The organization is registered once the organization storage has started.
				await storeRecord(
					accountDataStorage,
					migrationRecordId("organization", entity.organization),
					{ kind: "organization", organization: entity.organization }
				);

				if (hasIdentity) {
					// The credential is issued once the identity and vault components have started.
					const { id, record } = await getAccountRecord(entity.email, entity.accountId);
					await storeRecord(accountDataStorage, id, {
						...record,
						organization: entity.organization
					});
				} else {
					CLIDisplay.warning(
						I18n.formatMessage("warn.node.migrationCredentialSkipped", {
							email: entity.email,
							organization: entity.organization
						})
					);
				}
			}
		}
	};
	SchemaMigrationFactory.register(
		`${nameof<AuthenticationUser>()}_1_2`,
		() => migrationV1V2 as ISchemaMigration
	);
}

/**
 * Perform migrations for Auditable Item Graph indexes.
 */
function migrationAigIndexes(): void {
	let aigIndexEntityStorage: IEntityStorageConnector<AuditableItemGraphVertexIndex> | undefined;

	const migrationAigV1V2: ISchemaMigration<AuditableItemGraphVertexV1, AuditableItemGraphVertex> = {
		removeEntityProperty: async (
			entity: AuditableItemGraphVertexV1,
			removedProperties: IEntitySchemaProperty<AuditableItemGraphVertexV1>[]
		): Promise<void> => {
			// If the aliasIndex is being removed we should migrate both aliasIndex and resourceTypeIndex
			// to the new index structure.
			if (removedProperties.find(prop => prop.property === "aliasIndex") === undefined) {
				return;
			}

			aigIndexEntityStorage ??= EntityStorageConnectorFactory.get<
				IEntityStorageConnector<AuditableItemGraphVertexIndex>
			>(StringHelper.kebabCase(nameof<AuditableItemGraphVertexIndex>()));

			const values: { type: string; value: string }[] = [
				{ type: "vertex", value: entity.id.toLowerCase() }
			];

			const aliases: string[] =
				entity.aliasIndex
					?.split("||")
					.map(alias => alias.trim())
					.filter(alias => alias.length > 0) ?? [];

			for (const alias of aliases) {
				values.push({ type: "alias", value: alias.toLowerCase() });
			}

			const resourceTypes: string[] =
				entity.resourceTypeIndex
					?.split("||")
					.map(resourceType => resourceType.trim())
					.filter(resourceType => resourceType.length > 0) ?? [];

			for (const resourceType of resourceTypes) {
				values.push({ type: "resourceType", value: resourceType.toLowerCase() });
			}

			// The context ids already contain the correct partition information for the indexes.
			const entries: AuditableItemGraphVertexIndex[] = values.map(v =>
				AuditableItemGraphVertexIndexHelper.createIndexEntry(
					entity.id,
					v.type,
					v.value,
					entity.dateCreated,
					entity.dateModified ?? entity.dateCreated
				)
			);

			await writeIndexEntries(aigIndexEntityStorage, entries, entity.id);
		}
	};
	SchemaMigrationFactory.register(
		`${nameof<AuditableItemGraphVertex>()}_1_2`,
		() => migrationAigV1V2 as ISchemaMigration
	);
}

/**
 * Perform migrations for Policy Administration Point indexes.
 */
function migrationPapIndexes(): void {
	let papIndexEntityStorage: IEntityStorageConnector<OdrlPolicyIndex> | undefined;

	const migrationPapV0V1: ISchemaMigration<OdrlPolicyV0, OdrlPolicy> = {
		removeEntityProperty: async (
			entity: OdrlPolicyV0,
			removedProperties: IEntitySchemaProperty<OdrlPolicyV0>[]
		): Promise<void> => {
			// If the assignerIndex is being removed we should migrate all four of the pipe delimited
			// indexes to the new index structure.
			if (removedProperties.find(prop => prop.property === "assignerIndex") === undefined) {
				return;
			}

			papIndexEntityStorage ??= EntityStorageConnectorFactory.get<
				IEntityStorageConnector<OdrlPolicyIndex>
			>(StringHelper.kebabCase(nameof<OdrlPolicyIndex>()));

			// An absent dimension contributes a single undefined value, otherwise it would collapse
			// the combinations to none and the policy would not be indexed at all.
			const assigners = splitPolicyIndex(entity.assignerIndex);
			const assignees = splitPolicyIndex(entity.assigneeIndex);
			const targets = splitPolicyIndex(entity.targetIndex);
			const actions = splitPolicyIndex(entity.actionIndex);

			// The entries are ordered by the creation date, so a policy stored before the date was
			// recorded is given the epoch, which keeps a repeated run producing the same entries.
			const dateCreated = entity.dateCreated ?? new Date(0).toISOString();

			// One entry per combination of assigner, assignee, target and action, which is what lets
			// a locator covering several of those fields be answered by a single lookup.
			const entries: OdrlPolicyIndex[] = [];
			for (const assigner of assigners) {
				for (const assignee of assignees) {
					for (const target of targets) {
						for (const action of actions) {
							entries.push(
								OdrlPolicyIndexHelper.createIndexEntry(
									entity.id,
									dateCreated,
									assigner,
									assignee,
									target,
									action
								)
							);
						}
					}
				}
			}

			// The context ids already contain the correct partition information for the indexes.
			await writeIndexEntries(papIndexEntityStorage, entries, entity.id);
		}
	};
	SchemaMigrationFactory.register(
		`${nameof<OdrlPolicy>()}_0_1`,
		() => migrationPapV0V1 as ISchemaMigration
	);
}

/**
 * Split one of the pipe delimited indexes from a v0 policy into its index dimension values.
 * @param index The pipe delimited index value.
 * @returns The distinct case folded values, or a single undefined when there are none.
 */
function splitPolicyIndex(index: string | undefined): (string | undefined)[] {
	const values: string[] = [];

	for (const part of index?.split("|") ?? []) {
		// Index values are always stored case folded so lookups are case insensitive.
		const folded = part.trim().toLowerCase();
		if (folded.length > 0 && !values.includes(folded)) {
			values.push(folded);
		}
	}

	return values.length === 0 ? [undefined] : values;
}

/**
 * Write the index rows of one entity.
 * @param indexEntityStorage The index storage to write to.
 * @param entries The rows to write.
 * @param id The id of the entity the rows belong to.
 */
async function writeIndexEntries<T>(
	indexEntityStorage: IEntityStorageConnector<T>,
	entries: T[],
	id: string
): Promise<void> {
	try {
		await indexEntityStorage.setBatch(entries);
	} catch (error) {
		throw new GeneralError("node", "migrationIndexWriteFailed", { id }, error);
	}
}
