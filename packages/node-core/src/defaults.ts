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
 * Feature tag identifying the DID context ID handler.
 */
export const CONTEXT_ID_HANDLER_FEATURE_DID = "did";

/**
 * Feature tag identifying the tenant context ID handler.
 */
export const CONTEXT_ID_HANDLER_FEATURE_TENANT = "tenant";

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
		[`${envPrefix}AUTH_SIGNING_KEY_ID`]: AUTH_SIGNING_KEY_ID
	};
	return envVars;
}
