// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Default verification method fragment ID for attestation.
 */
export const ATTESTATION_VERIFICATION_METHOD_ID = "attestation-assertion";

/**
 * Default verification method fragment ID for immutable proofs.
 */
export const IMMUTABLE_PROOF_VERIFICATION_METHOD_ID = "immutable-proof-assertion";

/**
 * Default vault key ID for blob storage encryption.
 */
export const BLOB_STORAGE_ENCRYPTION_KEY_ID = "blob-encryption";

/**
 * Default verification method fragment ID for trust assertions.
 */
export const TRUST_VERIFICATION_METHOD_ID = "trust-assertion";

/**
 * Default vault key ID used for signing authentication tokens.
 */
export const AUTH_SIGNING_KEY_ID = "auth-signing";

/**
 * Default model identifier for authorization.
 */
export const AUTHORIZATION_MODEL_ID = "rest";

/**
 * Feature tag identifying the DID context ID handler.
 */
export const CONTEXT_ID_HANDLER_FEATURE_DID = "did";

/**
 * Feature tag identifying the tenant context ID handler.
 */
export const CONTEXT_ID_HANDLER_FEATURE_TENANT = "tenant";

/**
 * Default role for escalated privileges.
 */
export const DEFAULT_ESCALATED_PRIVILEGE_ROLE = "global-admin";

/**
 * Default role for tenant admins.
 */
export const DEFAULT_TENANT_ADMIN_ROLE = "tenant-admin";

/**
 * Default role for user admins.
 */
export const DEFAULT_USER_ADMIN_ROLE = "user-admin";

/**
 * Default role for identity profile admins.
 */
export const DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE = "identity-profile-admin";

/**
 * Default role for devops.
 */
export const DEFAULT_DEVOPS_ROLE = "devops";

/**
 * Default role for users.
 */
export const DEFAULT_USER_ROLE = "user";

/**
 * Get the default environment variables for the node.
 * @param envPrefix The environment variable prefix.
 * @returns The default environment variables.
 */
export function getEnvDefaults(envPrefix: string): { [key: string]: string } {
	const envVars: { [key: string]: string } = {
		[`${envPrefix}ATTESTATION_VERIFICATION_METHOD_ID`]: ATTESTATION_VERIFICATION_METHOD_ID,
		[`${envPrefix}IMMUTABLE_PROOF_VERIFICATION_METHOD_ID`]: IMMUTABLE_PROOF_VERIFICATION_METHOD_ID,
		[`${envPrefix}BLOB_STORAGE_ENCRYPTION_KEY_ID`]: BLOB_STORAGE_ENCRYPTION_KEY_ID,
		[`${envPrefix}TRUST_VERIFICATION_METHOD_ID`]: TRUST_VERIFICATION_METHOD_ID,
		[`${envPrefix}AUTH_SIGNING_KEY_ID`]: AUTH_SIGNING_KEY_ID,
		[`${envPrefix}AUTHORIZATION_MODEL_ID`]: AUTHORIZATION_MODEL_ID
	};
	return envVars;
}
