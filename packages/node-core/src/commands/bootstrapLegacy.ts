// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, GeneralError, I18n, Is } from "@twin.org/core";
import type { IEngineCore } from "@twin.org/engine-models";
import { identityCreate } from "./identityCreate.js";
import { identityVerificationMethodCreate } from "./identityVerificationMethodCreate.js";
import { nodeSetIdentity } from "./nodeSetIdentity.js";
import { applyOrganizationIdToTenant } from "./setTenantOrgId.js";
import { tenantCreate } from "./tenantCreate.js";
import { userCreate } from "./userCreate.js";
import { vaultKeyCreate } from "./vaultKeyCreate.js";
import type { ICliCommandDefinition } from "../models/ICliCommandDefinition.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEngineState } from "../models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";

const COMMAND_NAME = "bootstrap-legacy";

/**
 * Get the command definition parameters.
 * @param commandDefinitions The registered command definitions.
 */
export function getCommandDefinitionBootstrapLegacy(commandDefinitions: {
	[id: string]: ICliCommandDefinition;
}): void {
	commandDefinitions[COMMAND_NAME] = {
		command: COMMAND_NAME,
		description: I18n.formatMessage("node.cli.commands.bootstrap-legacy.description"),
		example: I18n.formatMessage("node.cli.commands.bootstrap-legacy.example"),
		requiresNodeIdentity: false,
		requiresOrgIdentity: false,
		params: [
			{
				key: "env-prefix",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.bootstrap-legacy.params.env-prefix.description"
				),
				required: false
			},
			{
				key: "load-env",
				type: "string",
				description: I18n.formatMessage(
					"node.cli.commands.bootstrap-legacy.params.load-env.description"
				),
				required: false
			}
		],
		action: async (engineCore, envVars, params) => bootstrapLegacy(engineCore, envVars, params)
	};
}

/**
 * Command for legacy bootstrap.
 * @param engineCore The engine core.
 * @param envVars The environment variables for the node.
 * @param params The parameters for the command.
 */
export async function bootstrapLegacy(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables & {
		/**
		 * The features that are enabled on the node.
		 * @default []
		 */
		features?: string;

		/**
		 * The identity of the node which, if empty and node-identity feature is enabled it will be generated.
		 */
		nodeIdentity?: string;

		/**
		 * The mnemonic for the identity, if empty and node-identity feature is enabled it will be randomly generated.
		 */
		nodeMnemonic?: string;

		/**
		 * A tenant id to use as a default for the node.
		 */
		tenantId?: string;

		/**
		 * A tenant api key to use as a default for the node.
		 */
		tenantApiKey?: string;

		/**
		 * If the node-identity feature is enabled, this will be the organisation identity. If not provided it will be generated.
		 */
		organizationIdentity?: string;

		/**
		 * The mnemonic for the organisation, if empty and node-identity feature is enabled it will be randomly generated.
		 */
		organizationMnemonic?: string;

		/**
		 * If the node-admin-user feature is enabled, this will be the identity of the user, if one is not provided it will be generated
		 */
		adminUserIdentity?: string;

		/**
		 * The mnemonic for the admin user, if empty and node-admin-user feature is enabled it will be randomly generated.
		 */
		adminUserMnemonic?: string;

		/**
		 * If the node-admin-user feature is enabled, this will be the name of the user.
		 * @default admin@node
		 */
		adminUserName?: string;

		/**
		 * If the node-admin-user feature is enabled, this will be the password of the user, if empty it will be randomly generated.
		 */
		adminUserPassword?: string;
	},
	params: {}
): Promise<void> {
	const features = (envVars.features ?? "")
		.split(",")
		.map(f => f.trim())
		.filter(f => f.length > 0);

	const state = engineCore.getState();
	const requireWallet = features.includes("node-wallet");
	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	let nodeId = state.nodeId;
	let tenantId = tenantEnabled ? envVars.tenantId : undefined;

	if (features.length === 0) {
		throw new GeneralError("bootstrapLegacy", "noFeaturesEnabled");
	}

	if (features.includes("node-identity") && Is.empty(nodeId)) {
		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeIdentityCreate")
		);

		const nodeIdentity = await identityCreate(engineCore, envVars, {
			identity: envVars.nodeIdentity,
			mnemonic: envVars.nodeMnemonic,
			fundWallet: requireWallet
		});

		nodeId = nodeIdentity.did;

		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeAuthKeyCreate")
		);
		await vaultKeyCreate(engineCore, envVars, {
			identity: nodeIdentity.did,
			keyType: "Ed25519",
			keyId: envVars.authSigningKeyId,
			overwriteMode: "skip"
		});

		CLIDisplay.break();
		CLIDisplay.section(
			I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeIdentitySet")
		);
		await nodeSetIdentity(engineCore, envVars, {
			identity: nodeId
		});

		// Always create the organisation identity first so it can be associated with
		// the tenant (multi-tenant) or the node (single-tenant) immediately after.
		// The trust verification method is always added to the organisation identity.
		let orgDid: string | undefined;
		await ContextIdStore.run({ [ContextIdKeys.Node]: nodeId }, async () => {
			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.organisationCreate")
			);
			const organisation = await identityCreate(engineCore, envVars, {
				identity: envVars.organizationIdentity,
				mnemonic: envVars.organizationMnemonic,
				fundWallet: requireWallet
			});
			orgDid = organisation.did;

			CLIDisplay.break();
			CLIDisplay.section(
				I18n.formatMessage(
					"node.cli.commands.bootstrap-legacy.labels.trustVerificationMethodCreate"
				)
			);
			await identityVerificationMethodCreate(engineCore, envVars, {
				identity: organisation.did,
				verificationMethodType: "assertionMethod",
				verificationMethodId: envVars.trustVerificationMethodId,
				overwriteMode: "skip"
			});

			// Always record the bootstrapped org DID in state so callers can reference it.
			if (!Is.stringValue(state.nodeOrganizationId)) {
				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeOrganizationIdSet")
				);
				state.nodeOrganizationId = organisation.did;
				engineCore.setStateDirty();
				CLIDisplay.done();
			}
		});

		if (tenantEnabled) {
			await ContextIdStore.run({ [ContextIdKeys.Node]: nodeId }, async () => {
				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.nodeTenantCreate")
				);
				const tenantDetails = await tenantCreate(engineCore, envVars, {
					tenantId: envVars.tenantId,
					apiKey: envVars.tenantApiKey,
					label: "Node"
				});

				tenantId = tenantDetails.tenantId;

				if (Is.stringValue(orgDid)) {
					await applyOrganizationIdToTenant(engineCore, tenantId, orgDid, {
						sectionLabel: I18n.formatMessage(
							"node.cli.commands.bootstrap-legacy.labels.tenantOrganizationIdSet"
						),
						required: false
					});
				}
			});
		}
	} else if (tenantEnabled && Is.empty(tenantId) && Is.stringValue(nodeId)) {
		await ContextIdStore.run({ [ContextIdKeys.Node]: nodeId }, async () => {
			tenantId = await resolveBootstrapTenantId(engineCore);
		});
	}

	if (features.includes("node-admin-user")) {
		await ContextIdStore.run(
			{ [ContextIdKeys.Node]: nodeId, [ContextIdKeys.Tenant]: tenantId },
			async () => {
				// Resolve the organisation DID that was created during node-identity bootstrap.
				const orgDid = await resolveOrganizationDid(engineCore, tenantEnabled, tenantId);

				if (Coerce.boolean(envVars.blobStorageEnableEncryption) ?? false) {
					CLIDisplay.break();
					CLIDisplay.section(
						I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.blobStorageKeyCreate")
					);
					await vaultKeyCreate(engineCore, envVars, {
						identity: orgDid,
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
						I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.attestationMethodCreate")
					);
					await identityVerificationMethodCreate(engineCore, envVars, {
						identity: orgDid,
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
						I18n.formatMessage(
							"node.cli.commands.bootstrap-legacy.labels.immutableProofMethodCreate"
						)
					);
					await identityVerificationMethodCreate(engineCore, envVars, {
						identity: orgDid,
						verificationMethodType: "assertionMethod",
						verificationMethodId: envVars.immutableProofVerificationMethodId,
						overwriteMode: "skip"
					});
				}

				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.adminIdentityCreate")
				);
				const adminUserIdentity = await identityCreate(engineCore, envVars, {
					identity: envVars.adminUserIdentity,
					mnemonic: envVars.adminUserMnemonic,
					controller: orgDid
				});

				CLIDisplay.break();
				CLIDisplay.section(
					I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.adminUserCreate")
				);
				await userCreate(engineCore, envVars, {
					userIdentity: adminUserIdentity.did,
					organizationIdentity: orgDid,
					tenantId,
					email: envVars.adminUserName ?? "admin@node",
					password: envVars.adminUserPassword,
					scope: ["tenant-admin", "user-admin"].join(","),
					givenName: "Node",
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

	throw new GeneralError("bootstrapLegacy", "organizationNotSet");
}

/**
 * Resolve an existing tenant id for re-bootstrap when multi-tenancy is enabled.
 * @param engineCore The engine core.
 * @returns The tenant id if one exists in storage.
 * @internal
 */
async function resolveBootstrapTenantId(
	engineCore: IEngineCore<INodeEngineConfig, INodeEngineState>
): Promise<string | undefined> {
	const tenantAdminServiceComponentType =
		engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");

	if (!Is.stringValue(tenantAdminServiceComponentType)) {
		return undefined;
	}

	const tenantAdminService = ComponentFactory.get<ITenantAdminComponent>(
		tenantAdminServiceComponentType
	);

	let cursor: string | undefined;
	let firstTenantId: string | undefined;

	do {
		const result = await tenantAdminService.query(undefined, ["id", "label"], cursor);
		const nodeTenant = result.tenants.find(tenant => tenant.label === "Node");
		if (nodeTenant) {
			return nodeTenant.id;
		}

		if (Is.empty(firstTenantId) && !Is.empty(result.tenants)) {
			firstTenantId = result.tenants[0]?.id;
		}

		cursor = result.cursor;
	} while (Is.stringValue(cursor));

	if (Is.stringValue(firstTenantId)) {
		CLIDisplay.value(
			I18n.formatMessage("node.cli.commands.bootstrap-legacy.labels.tenantFallback"),
			firstTenantId
		);
	}

	return firstTenantId;
}
