// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Aggregate of the runtime values produced by setup.sh + provision-storage.sh
 * that the test phases need. Populated once by `loadContext` and threaded
 * through every phase function.
 */
export interface IKenyaContext {
	/**
	 * Host used by curl, e.g. `http://localhost:3040`.
	 */
	host: string;

	/**
	 * Internal docker host:port used by the container when it builds
	 * callback URLs (e.g. `http://twin-kenya-node:3000`). Phase 7 strips
	 * this prefix to translate container-internal endpoints back to the
	 * host-accessible HOST.
	 */
	internalUrl: string;

	/**
	 * The DSP JSON-LD context URI baked into every DSP message.
	 */
	dspContext: string;

	/**
	 * The ODRL JSON-LD context URI used when re-constructing the offer.
	 */
	odrlContext: string;

	// ---------------------------------------------------------------------
	// Tenants
	// ---------------------------------------------------------------------
	kraTenantId: string;
	kraApiKey: string;
	kraUserEmail: string;
	kraUserPassword: string;
	kraDid: string;

	traderTenantId: string;
	traderApiKey: string;
	traderUserEmail: string;
	traderUserPassword: string;
	traderDid: string;

	// ---------------------------------------------------------------------
	// Auth tokens (mutable: session JWTs are re-issued after container restart
	// in phases 10 + 11).
	// ---------------------------------------------------------------------
	kraSessionJwt: string;
	traderSessionJwt: string;
	kraTrustJwt: string;
	traderTrustJwt: string;

	/**
	 * The encrypted tenant token Trader's catalogue lookup baked into the
	 * distribution.accessService URL (Phase 3). Re-applied as
	 * `?x-enc-tenant-token=...` on subsequent PNP/DSP routes to make those
	 * requests land in KRA's tenant partition.
	 */
	kraTenantToken?: string;

	/**
	 * The encrypted tenant token routing inbound consumer-side callbacks
	 * (PNAP / DSP) into Trader's partition. Read from `.trust-tokens`.
	 */
	traderTenantToken: string;

	// ---------------------------------------------------------------------
	// Seeded resources
	// ---------------------------------------------------------------------
	kraOfferId: string;
	kraDatasetId: string;
}
