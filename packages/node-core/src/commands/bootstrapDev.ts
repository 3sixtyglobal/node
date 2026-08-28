// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuthenticationAdminComponent } from "@twin.org/api-auth-entity-storage-models";
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, GeneralError, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { commaSeparatedListToArray } from "../builders/helper/envHelpers.js";
import {
	DEFAULT_DEVOPS_ROLE,
	DEFAULT_ESCALATED_PRIVILEGE_ROLE,
	DEFAULT_TENANT_ADMIN_ROLE,
	DEFAULT_USER_ADMIN_ROLE,
	DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE
} from "../defaults.js";
import { identityCreate } from "./identityCreate.js";
import { identityVerificationMethodCreate } from "./identityVerificationMethodCreate.js";
import { tenantCreate } from "./tenantCreate.js";
import { userCreate } from "./userCreate.js";
import { vaultKeyCreate } from "./vaultKeyCreate.js";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";

const COMMAND_NAME = "bootstrap-dev";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionBootstrapDev(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		aliases: ["bootstrap-legacy"],
		description: I18n.formatMessage("node.cli.commands.bootstrap-dev.description"),
		example: I18n.formatMessage("node.cli.commands.bootstrap-dev.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.bootstrap-dev.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.bootstrap-dev.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => bootstrapDev(engineCore, envVars, params)
	};
}

/**
 * Command for development bootstrap.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 * @returns A promise that resolves when the bootstrap sequence has completed.
 */
export async function bootstrapDev(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: IEnvironmentVariables,
	params: {}
): Promise<void> {
	const features = commaSeparatedListToArray(envVars.features ?? "admin-user,wallet");

	const state = engineCore.getState();
	const requireWallet = features.includes("wallet");
	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	let nodeId = state.nodeId ?? envVars.nodeIdentity;
	let organizationId = tenantEnabled ? undefined : state.nodeOrganizationId;
	let tenant: { id: string; organizationId: string } | undefined;

	if (features.length === 0) {
		throw new GeneralError("bootstrapDev", "noFeaturesEnabled");
	}

	CLIDisplay.break();
	CLIDisplay.section(
		I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.nodeIdentityCreate")
	);

	const nodeIdentity = await identityCreate(engineCore, envVars, {
		identity: nodeId,
		mnemonic: envVars.nodeMnemonic,
		fundWallet: requireWallet,
		nodeId: true
	});

	nodeId = nodeIdentity.did;

	CLIDisplay.break();
	CLIDisplay.section(
		I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.nodeAuthKeyCreate")
	);
	await vaultKeyCreate(engineCore, envVars, {
		identity: nodeId,
		keyType: "Ed25519",
		keyId: envVars.authSigningKeyId,
		overwriteMode: "skip"
	});

	// Always create the organisation identity first so it can be associated with
	// the tenant (multi-tenant) or the node (single-tenant) immediately after.
	// The trust verification method is always added to the organisation identities.
	await ContextIdStore.run({ [ContextIdKeys.Node]: nodeId }, async () => {
		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.organisationCreate")
		);

		if (tenantEnabled) {
			const existingTenant = Is.stringValue(envVars.tenantId)
				? await resolveTenantById(engineCore, envVars.tenantId)
				: await resolveDefaultTenant(engineCore);
			organizationId = existingTenant?.organizationId;
		}

		const organisation = await identityCreate(engineCore, envVars, {
			identity: organizationId ?? envVars.organizationIdentity,
			mnemonic: envVars.organizationMnemonic,
			fundWallet: requireWallet
		});
		organizationId = organisation.did;

		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.trustVerificationMethodCreate")
		);
		await identityVerificationMethodCreate(engineCore, envVars, {
			identity: organisation.did,
			verificationMethodType: "assertionMethod",
			verificationMethodId: envVars.trustVerificationMethodId,
			overwriteMode: "skip"
		});

		if (Coerce.boolean(envVars.blobStorageEnableEncryption) ?? false) {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.blobStorageKeyCreate")
			);
			await vaultKeyCreate(engineCore, envVars, {
				identity: organizationId,
				keyType: "ChaCha20Poly1305",
				keyId: envVars.blobStorageEncryptionKeyId,
				overwriteMode: "skip"
			});
		}

		const defaultAttestationConnectorType =
			engineCore.getRegisteredInstanceTypeOptional("attestationConnector");
		if (!Is.empty(defaultAttestationConnectorType)) {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.attestationMethodCreate")
			);
			await identityVerificationMethodCreate(engineCore, envVars, {
				identity: organizationId,
				verificationMethodType: "assertionMethod",
				verificationMethodId: envVars.attestationVerificationMethodId,
				overwriteMode: "skip"
			});
		}

		const defaultImmutableProofComponentType =
			engineCore.getRegisteredInstanceTypeOptional("immutableProofComponent");

		if (!Is.empty(defaultImmutableProofComponentType)) {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.immutableProofMethodCreate")
			);
			await identityVerificationMethodCreate(engineCore, envVars, {
				identity: organizationId,
				verificationMethodType: "assertionMethod",
				verificationMethodId: envVars.immutableProofVerificationMethodId,
				overwriteMode: "skip"
			});
		}

		// In single-tenant mode, record the org DID in state so the node can resolve its
		// organisation without a tenant lookup.
		if (!tenantEnabled && !Is.stringValue(state.nodeOrganizationId)) {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.nodeOrganizationIdSet")
			);
			state.nodeOrganizationId = organisation.did;
			engineCore.setStateDirty();
			CLIDisplay.done();
		}
	});

	if (tenantEnabled) {
		await ContextIdStore.run({ [ContextIdKeys.Node]: nodeId }, async () => {
			// Resolve an existing tenant so a re-run does not create a duplicate.
			// When a specific tenant ID is configured, look it up directly;
			// otherwise search for the first tenant labelled "Tenant".
			if (Is.stringValue(envVars.tenantId)) {
				tenant = await resolveTenantById(engineCore, envVars.tenantId);
			} else {
				tenant = await resolveDefaultTenant(engineCore);
			}

			// Still empty so create a new tenant for the node and associate it with the organisation.
			if (Is.empty(tenant)) {
				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.nodeTenantCreate")
				);
				const tenantDetails = await tenantCreate(engineCore, envVars, {
					tenantId: envVars.tenantId,
					apiKey: envVars.tenantApiKey,
					label: "Tenant",
					organizationId
				});

				tenant = {
					id: tenantDetails.tenantId,
					organizationId: organizationId ?? tenantDetails.organizationId ?? ""
				};
			}
		});
	}

	if (features.includes("admin-user")) {
		await ContextIdStore.run(
			{ [ContextIdKeys.Node]: nodeId, [ContextIdKeys.Tenant]: tenant?.id },
			async () => {
				const orgDid = await resolveOrganizationDid(engineCore, tenantEnabled, tenant?.id);
				const effectiveAdminEmail =
					envVars.adminUserName ?? `admin@${tenantEnabled ? "tenant" : "node"}`;
				const adminUser = await resolveDefaultAdminUser(engineCore, effectiveAdminEmail);
				let userDid = adminUser?.userIdentity;

				if (Is.empty(adminUser)) {
					CLIDisplay.break();
					CLIDisplay.section(
						I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.adminIdentityCreate")
					);
					const result = await identityCreate(engineCore, envVars, {
						identity: envVars.adminUserIdentity,
						mnemonic: envVars.adminUserMnemonic,
						controller: orgDid
					});

					userDid = result.did;
				}

				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.adminUserCreate")
				);
				await userCreate(engineCore, envVars, {
					userIdentity: userDid,
					organizationIdentity: orgDid,
					tenantId: tenant?.id,
					email: envVars.adminUserName ?? `admin@${tenantEnabled ? "tenant" : "node"}`,
					password: envVars.adminUserPassword,
					roles:
						envVars.adminUserRoles ??
						(tenantEnabled
							? [
									DEFAULT_ESCALATED_PRIVILEGE_ROLE,
									DEFAULT_TENANT_ADMIN_ROLE,
									DEFAULT_USER_ADMIN_ROLE,
									DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
									DEFAULT_DEVOPS_ROLE
								]
							: [
									DEFAULT_ESCALATED_PRIVILEGE_ROLE,
									DEFAULT_USER_ADMIN_ROLE,
									DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
									DEFAULT_DEVOPS_ROLE
								]
						).join(","),
					givenName: tenantEnabled ? "Tenant" : "Node",
					familyName: "Admin",
					overwriteMode: "skip"
				});
			}
		);
	}
}

/**
 * Resolve the organisation DID from node state (single-tenant) or the tenant entry (multi-tenant).
 * @param engineCore The engine core.
 * @param tenantEnabled Whether multi-tenancy is enabled.
 * @param tenantId The active tenant ID (multi-tenant only).
 * @returns The organisation DID.
 * @throws GeneralError if the organisation has not been associated yet.
 * @internal
 */
async function resolveOrganizationDid(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	tenantEnabled: boolean,
	tenantId: string | undefined
): Promise<string> {
	if (tenantEnabled) {
		if (Is.stringValue(tenantId)) {
			const tenantAdminComponentType =
				engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");
			if (Is.stringValue(tenantAdminComponentType)) {
				const tenantAdminComponent =
					ComponentFactory.get<ITenantAdminComponent>(tenantAdminComponentType);
				const tenant = await tenantAdminComponent.get(tenantId);
				if (Is.stringValue(tenant.organizationId)) {
					return tenant.organizationId;
				}
			}
		}
	} else {
		const state = engineCore.getState();
		if (Is.stringValue(state.nodeOrganizationId)) {
			return state.nodeOrganizationId;
		}
	}

	throw new GeneralError("bootstrapDev", "organizationNotSet");
}

/**
 * Resolve the default tenant id for re-bootstrap when multi-tenancy is enabled.
 * @param engineCore The engine core.
 * @returns The tenant id if one exists in storage.
 * @internal
 */
async function resolveDefaultTenant(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>
): Promise<{ id: string; organizationId: string } | undefined> {
	const tenantAdminServiceComponentType =
		engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(tenantAdminServiceComponentType)) {
		return undefined;
	}

	const tenantAdminService = ComponentFactory.get<ITenantAdminComponent>(
		tenantAdminServiceComponentType
	);

	let cursor: string | undefined;
	let firstTenant: { id: string; organizationId: string } | undefined;

	do {
		const result = await tenantAdminService.query(
			undefined,
			["id", "organizationId", "label"],
			cursor
		);
		const nodeTenant = result.tenants.find(tenant => tenant.label === "Tenant");
		if (nodeTenant) {
			return {
				id: nodeTenant.id,
				organizationId: nodeTenant.organizationId ?? ""
			};
		}

		if (Is.empty(firstTenant) && Is.arrayValue(result.tenants)) {
			firstTenant = {
				id: result.tenants[0].id,
				organizationId: result.tenants[0].organizationId ?? ""
			};
		}

		cursor = result.cursor;
	} while (Is.stringValue(cursor));

	if (!Is.empty(firstTenant)) {
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.bootstrap-dev.labels.tenantFallback"),
			firstTenant.id
		);
	}

	return firstTenant;
}

/**
 * Resolve the admin user by email for idempotent re-bootstrap.
 * @param engineCore The engine core.
 * @param email The email address of the admin user to look up.
 * @returns The admin user if one exists in storage.
 * @internal
 */
async function resolveDefaultAdminUser(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	email: string
): Promise<{ email: string; userIdentity: string; organizationIdentity: string } | undefined> {
	const defaultAuthenticationAdminComponentType = engineCore.getRegisteredInstanceType(
		"authenticationAdminComponent"
	);
	const authenticationAdminComponent = ComponentFactory.get<IAuthenticationAdminComponent>(
		defaultAuthenticationAdminComponentType
	);

	try {
		return await authenticationAdminComponent.get(email);
	} catch {
		return undefined;
	}
}

/**
 * Resolve a tenant by its specific ID for idempotent re-bootstrap.
 * @param engineCore The engine core.
 * @param tenantId The tenant ID to look up.
 * @returns The tenant if found, otherwise undefined.
 * @internal
 */
async function resolveTenantById(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	tenantId: string
): Promise<{ id: string; organizationId: string } | undefined> {
	const tenantAdminServiceComponentType =
		engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(tenantAdminServiceComponentType)) {
		return undefined;
	}

	const tenantAdminService = ComponentFactory.get<ITenantAdminComponent>(
		tenantAdminServiceComponentType
	);

	try {
		const found = await tenantAdminService.get(tenantId);
		return {
			id: found.id,
			organizationId: found.organizationId ?? ""
		};
	} catch {
		return undefined;
	}
}
