// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	EntityStorageAuthenticationRestClient,
	type IEntityStorageAuthenticationRestClientConstructorOptions
} from "@twin.org/api-auth-entity-storage-rest-client";
import type { IBaseRestClientConfig } from "@twin.org/api-models";
import { Is } from "@twin.org/core";
import { DataspaceControlPlaneRestClient } from "@twin.org/dataspace-control-plane-rest-client";
import { FederatedCatalogueRestClient } from "@twin.org/federated-catalogue-rest-client";
import {
	PolicyAdministrationPointRestClient,
	PolicyNegotiationAdminPointRestClient,
	PolicyNegotiationPointRestClient
} from "@twin.org/rights-management-rest-client";

/**
 * Common per-client construction parameters. Mirrors how the kenya bash test
 * routes every request through a tenant gate: an `x-api-key` is mandatory for
 * any non-cross-node call, and authenticated routes carry an
 * `access_token=<session-jwt>` cookie. Cross-tenant DSP/PNP routes additionally
 * use a Bearer trust JWT, but that's wired by the rest client per-call (we
 * just plumb the credentials in here).
 */
export interface ITenantCredentials {
	/**
	 * The host (no trailing slash, no path), e.g. `http://localhost:3040`.
	 */
	host: string;

	/**
	 * The tenant api key — populates the `x-api-key` header used by the
	 * api-tenant-processor to pin ContextIds[Tenant] before auth.
	 */
	apiKey: string;

	/**
	 * The session JWT to surface as an `access_token=...` cookie. Optional so the
	 * pre-login phases can still construct a client.
	 */
	sessionJwt?: string;

	/**
	 * An optional encrypted tenant token to bake into the endpoint URL query
	 * string (`?x-enc-tenant-token=...`). The BaseRestClient preserves the
	 * endpoint-level query on every outbound request, so this is the cleanest
	 * way to mirror the bash test's per-call `?x-enc-tenant-token=...` routing
	 * without monkey-patching individual rest-client methods.
	 */
	encTenantToken?: string;
}

/**
 * Build an endpoint URL that bakes the encrypted tenant token into the query
 * string when present.
 * @param host The bare host (e.g. `http://localhost:3040`).
 * @param encTenantToken Optional encrypted tenant token.
 * @returns The endpoint URL.
 */
function buildEndpoint(host: string, encTenantToken?: string): string {
	if (!Is.stringValue(encTenantToken)) {
		return host;
	}
	return `${host}?x-enc-tenant-token=${encodeURIComponent(encTenantToken)}`;
}

/**
 * Build the headers payload that the rest client should send on every request.
 *
 * IMPORTANT: when an `encTenantToken` is set, we are making a CROSS-TENANT
 * call where the destination tenant is identified by the URL-baked tenant
 * token. In that mode we must NOT send `x-api-key` or `cookie: access_token=...`
 * — those would tell the server's TenantProcessor to pin the context to the
 * SOURCE tenant instead of decrypting the URL token to land in the
 * destination tenant's partition. The bash test mirrors this by issuing
 * cross-tenant DSP/PNP calls with ONLY the Authorization Bearer trust JWT.
 *
 * For same-tenant admin calls (no encTenantToken), the api-key + session
 * cookie are required to authenticate the calling user.
 * @param credentials The tenant credentials.
 * @returns The headers to send.
 */
function buildHeaders(credentials: ITenantCredentials): { [key: string]: string } {
	const isCrossTenant = Is.stringValue(credentials.encTenantToken);
	if (isCrossTenant) {
		return {};
	}
	const headers: { [key: string]: string } = {
		"x-api-key": credentials.apiKey
	};
	if (Is.stringValue(credentials.sessionJwt)) {
		headers.cookie = `access_token=${credentials.sessionJwt}`;
	}
	return headers;
}

/**
 * Build the shared rest-client config block used by all per-tenant clients.
 * @param credentials The tenant credentials.
 * @param pathPrefix The route prefix the engine-server publishes for the
 * target component (e.g. `dataspace`, `rights-management`,
 * `federated-catalogue`).
 * @returns The rest client config.
 */
function buildConfig(credentials: ITenantCredentials, pathPrefix: string): IBaseRestClientConfig {
	return {
		endpoint: buildEndpoint(credentials.host, credentials.encTenantToken),
		pathPrefix,
		headers: buildHeaders(credentials),
		// Keep the session cookie working across redirects when the runtime
		// supports it. The Kenya scaffold always speaks to a single host so
		// this is purely defensive.
		includeCredentials: true
	};
}

/**
 * Build an EntityStorageAuthenticationRestClient bound to the host + api key.
 * Optionally accepts an existing session JWT so callers can re-issue calls
 * after a login.
 * @param host The host.
 * @param apiKey The api key.
 * @returns The authentication rest client.
 */
export function makeAuthenticationClient(
	host: string,
	apiKey: string
): EntityStorageAuthenticationRestClient {
	const options: IEntityStorageAuthenticationRestClientConstructorOptions = {
		endpoint: host,
		pathPrefix: "authentication",
		headers: {
			"x-api-key": apiKey
		}
	};
	return new EntityStorageAuthenticationRestClient(options);
}

/**
 * Build a DataspaceControlPlaneRestClient bound to the supplied tenant
 * credentials. The path prefix is overridden to match the engine-server
 * default route (`/dataspace`).
 * @param credentials The tenant credentials.
 * @returns The control plane rest client.
 */
export function makeControlPlaneClient(
	credentials: ITenantCredentials
): DataspaceControlPlaneRestClient {
	return new DataspaceControlPlaneRestClient(buildConfig(credentials, "dataspace"));
}

/**
 * Build a FederatedCatalogueRestClient bound to the supplied tenant
 * credentials.
 * @param credentials The tenant credentials.
 * @returns The federated catalogue rest client.
 */
export function makeFederatedCatalogueClient(
	credentials: ITenantCredentials
): FederatedCatalogueRestClient {
	return new FederatedCatalogueRestClient(buildConfig(credentials, "federated-catalogue"));
}

/**
 * Build a PolicyNegotiationPointRestClient bound to the supplied tenant
 * credentials.
 * @param credentials The tenant credentials.
 * @returns The PNP rest client.
 */
export function makePnpClient(credentials: ITenantCredentials): PolicyNegotiationPointRestClient {
	return new PolicyNegotiationPointRestClient(buildConfig(credentials, "rights-management"));
}

/**
 * Build a PolicyNegotiationAdminPointRestClient (PNAP) bound to the supplied
 * tenant credentials. Used to pre-inject the consumer-side negotiation entry
 * (mobius pattern) and to read agreement state after FINALIZED.
 * @param credentials The tenant credentials.
 * @returns The PNAP rest client.
 */
export function makePnapClient(
	credentials: ITenantCredentials
): PolicyNegotiationAdminPointRestClient {
	return new PolicyNegotiationAdminPointRestClient(buildConfig(credentials, "rights-management"));
}

/**
 * Build a PolicyAdministrationPointRestClient (PAP) bound to the supplied
 * tenant credentials. Phase 11.4 uses this to assert tenant-partition
 * isolation on direct-by-URN reads.
 * @param credentials The tenant credentials.
 * @returns The PAP rest client.
 */
export function makePapClient(
	credentials: ITenantCredentials
): PolicyAdministrationPointRestClient {
	return new PolicyAdministrationPointRestClient(buildConfig(credentials, "rights-management"));
}
