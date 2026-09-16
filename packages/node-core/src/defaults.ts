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
 * The default component types excluded from the engine clone used by the application health
 * background task. Each entry is a regular expression matched against the engine config type keys.
 * None of the components in these groups implement healthApplication, and nothing that does
 * implement it depends on them, so keeping them out of the clone removes the cost of constructing
 * and starting them in the health worker.
 */
export const DEFAULT_HEALTH_EXCLUDE_CLONE_COMPONENTS: string[] = [
	"^rightsManagement",
	"^dataspace",
	"^federatedCatalogue",
	"^trust",
	"^automation",
	"^telemetry",
	"^tracing",
	"^restClientProcessor$"
];

/**
 * The name the tracing facade is registered with in the facade factory
 */
export const TRACING_FACADE_NAME = "tracing-facade";

/**
 * The type name of the component factory.
 */
export const COMPONENT_FACTORY_TYPE_NAME = "component";

/**
 * The default factories the tracing facade is activated on.
 */
export const DEFAULT_TRACING_FACADE_FACTORIES: string[] = [
	"component",
	"nft-connector",
	"identity-connector",
	"attestation",
	"notarization-connector",
	"blob-storage",
	"vault",
	"wallet-connector"
];

/**
 * The instance types the tracing facade is never applied to in the component factory, matched as
 * regular expressions anywhere in the type name. The facade resolves the tracing and logging
 * components while recording a span, so wrapping those results in an endless call chain. The
 * remaining patterns cover the high volume infrastructure services whose spans carry little value.
 */
export const DEFAULT_TRACING_FACADE_COMPONENT_EXCLUDE_TYPES: string[] = [
	"tracing",
	"telemetry",
	"metrics",
	"logging",
	"platform"
];

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
