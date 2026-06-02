// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Shared mutable state threaded through every step in a test run.
 * Variables captured by one step are immediately available to subsequent steps.
 */
export interface RunnerContext {
	/**
	 * Root URL of the server under test (e.g. "http://localhost:3000").
	 */
	baseUrl: string;

	/**
	 * API key sent as a request header on steps with apiKey: true (e.g. "x-api-key=abc123").
	 * Formatted as "header-name=value"; the runner splits on the first "=" and injects it
	 * as an HTTP header rather than a query param so the server-side URL regex (/login$/) matches
	 * the clean path without a query string.
	 */
	apiKeyQuery: string;

	/**
	 * Current auth token; updated whenever a step captures "cookie:access_token".
	 */
	authToken: string;

	/**
	 * Named string variables populated by capture specs and referenced via {{varName}} in
	 * subsequent path templates and request bodies.
	 */
	vars: { [key: string]: string };

	/**
	 * Unix timestamp (ms) recorded when the server process started, used by timeBarrier steps.
	 */
	serverStartTime: number;

	/**
	 * When false, the x-enc-tenant-token query parameter is stripped from every path before
	 * the request is sent. Use false for single-tenant nodes where there is no tenant to
	 * identify. Defaults to true when omitted.
	 */
	appendTenantParam?: boolean;
}
