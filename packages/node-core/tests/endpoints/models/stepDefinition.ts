// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Defines a test step with request details, expected outcomes, and variable capture/assertion rules.
 */
export interface StepDefinition {
	/**
	 * A brief description of the step, used in logs and error messages.
	 */
	description: string;

	/**
	 * HTTP method to use for the request (e.g., "GET", "POST", "PUT", "DELETE").
	 */
	method: string;

	/**
	 * URL path template; {{varName}} segments are URL-encoded.
	 */
	path: string;

	/**
	 * Default false — set to true to append the api key as a request header.
	 * Only the login endpoint accepts an API key; all other endpoints use the
	 * organization DID (from the JWT access_token org claim) for tenant resolution.
	 */
	apiKey?: boolean;

	/**
	 * Additional request headers.
	 * Header values support {{varName}} interpolation.
	 */
	headers?: { [key: string]: string };

	/**
	 * Request body; {{varName}} values are NOT URL-encoded.
	 * A lone {{varName}} at the top level sends the captured value verbatim (already JSON-serialised).
	 * A lone {{varName}} inside a field whose captured value starts with { or [ is re-parsed
	 * as a native object before the body is serialised, so nested JSON is not double-encoded.
	 */
	body?: unknown;

	/**
	 * Expected HTTP status code from the response.
	 */
	expectedStatus: number;

	/**
	 * Capture response data into named context variables.
	 * Spec strings:
	 * "location-last-segment" — decodeURIComponent of last path segment of Location header
	 * "header.location" — raw Location header value
	 * "cookie:<name>" — named cookie from Set-Cookie header
	 * "body" — entire JSON response body (serialised; re-parsed as object when used in body fields)
	 * "body.<dot.path>" — dot-path into JSON response (supports [n] array indexing)
	 * "body.<dot.path>|last-colon" — as above, then takes the last colon-delimited segment
	 * "response-text" — full response as plain text
	 * "jwt-claim:<name>" — decodes the current authToken JWT and returns the named payload claim
	 */
	capture?: { [key: string]: string };

	/**
	 * Assert values after capture.
	 * Key: "body.<dot.path>" | "body" | "text"
	 * Value: "isDefined" | "{{varName}}" (compare to captured var) | literal
	 */
	assert?: { [key: string]: unknown };

	/**
	 * Milliseconds to wait (relative to serverStartTime) before executing this step.
	 * Used to ensure slow-starting services are ready.
	 */
	timeBarrier?: number;

	/**
	 * Non-falsy string = skip this step with reason; false/omit = run.
	 */
	skip?: string | false;

	/**
	 * Controls whether ?organization=<orgDid> is appended to this step's URL.
	 * The runner appends it automatically for all non-apiKey requests when ctx.appendOrgParam
	 * is not false and an organizationId is captured. Set to false to explicitly suppress the
	 * organization param on steps that test missing-tenant-token error cases.
	 */
	appendOrgParam?: boolean;

	/**
	 * When true, this step is skipped automatically when ctx.isSingleTenant is true.
	 * Use for steps that only make sense on multi-tenant nodes (e.g. verifying that a
	 * missing org param produces a particular error code that differs in single-tenant mode).
	 */
	skipIfOrgParamOmitted?: boolean;
}
