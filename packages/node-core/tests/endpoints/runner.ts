// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Is } from "@twin.org/core";

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
	 * Default true — adds cookie: access_token={{authToken}}.
	 * Set to false for unauthenticated requests such as login.
	 */
	auth?: boolean;

	/**
	 * Default true — appends ?x-api-key=... query param.
	 * Set to false when testing endpoints that do not require an API key.
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
}

/**
 * A named group of steps that are executed sequentially.
 */
export interface GroupDefinition {
	/**
	 * Display name for the group, shown in console output.
	 */
	group: string;

	/**
	 * Ordered list of steps to run within the group.
	 */
	steps: StepDefinition[];
}

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
	 * Pre-formatted query string appended to authenticated requests (e.g. "x-api-key=abc123").
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
}

/**
 * Replaces {{varName}} tokens in a URL path template with URL-encoded variable values.
 * Each token is individually encoded so special characters in IDs (e.g. colons in URNs)
 * do not break the URL structure.
 * @param template The URL path template containing {{varName}} tokens.
 * @param vars The variable map to resolve tokens against.
 * @returns The resolved URL path with all tokens replaced.
 */
function interpolatePath(template: string, vars: { [key: string]: string }): string {
	return template.replace(/{{([^}]+)}}/g, (fullMatch, key: string) =>
		encodeURIComponent(vars[key] ?? "")
	);
}

/**
 * Recursively substitutes {{varName}} tokens in a request body value.
 *
 * Special cases for string values:
 * - A lone {{varName}} whose captured content starts with { or [ is JSON-parsed back to a
 * native object, preventing double-serialisation when later passed through JSON.stringify.
 * - A lone {{varName}} that is not JSON is returned as a plain string.
 * - Mixed strings (e.g. "prefix-{{id}}") have each token substituted in place.
 * @param value The value to interpolate (string, array, object, or primitive).
 * @param vars The variable map to resolve tokens against.
 * @returns The interpolated value with the same shape as the input.
 */
function interpolateDeep(value: unknown, vars: { [key: string]: string }): unknown {
	if (typeof value === "string") {
		const singleVar = /^{{([^}]+)}}$/.exec(value);
		if (singleVar) {
			const raw = vars[singleVar[1]] ?? "";
			if (raw.startsWith("{") || raw.startsWith("[")) {
				try {
					return JSON.parse(raw);
				} catch {
					// not valid JSON — fall through and return as string
				}
			}
			return raw;
		}
		return value.replace(/{{([^}]+)}}/g, (fullMatch, key: string) => vars[key] ?? "");
	}
	if (Is.array(value)) {
		return value.map(item => interpolateDeep(item, vars));
	}
	if (value !== null && typeof value === "object") {
		const result: { [key: string]: unknown } = {};
		for (const [k, v] of Object.entries(value as { [key: string]: unknown })) {
			result[k] = interpolateDeep(v, vars);
		}
		return result;
	}
	return value;
}

/**
 * Walks a dot-separated path through a parsed JSON object and returns the value at that location.
 * Path segments of the form [n] are treated as array indices rather than property names, allowing
 * capture specs like "itemListElement.[0].id" to index into arrays without a separate syntax.
 * @param obj The root object to traverse.
 * @param dotPath Dot-separated path string, e.g. "itemListElement.[0].id".
 * @returns The value at the given path, or undefined if any segment is missing.
 */
function getNestedValue(obj: unknown, dotPath: string): unknown {
	let current: unknown = obj;
	for (const part of dotPath.split(".")) {
		if (current === null || current === undefined) {
			return undefined;
		}
		const arrMatch = /^\[(\d+)]$/.exec(part);
		if (arrMatch) {
			current = (current as unknown[])[Number.parseInt(arrMatch[1], 10)];
		} else {
			current = (current as { [key: string]: unknown })[part];
		}
	}
	return current;
}

/**
 * Executes a single test step: builds and fires the HTTP request, validates the status code,
 * captures values from the response into context variables, and evaluates any assertions.
 * Throws on status mismatch or assertion failure so the enclosing test fails immediately.
 * @param step The step definition to execute.
 * @param ctx The shared runner context providing variables and auth state.
 */
export async function runStep(step: StepDefinition, ctx: RunnerContext): Promise<void> {
	// Honour the time barrier — some steps must not run until the server has had a chance to
	// fully initialise (e.g. health checks that depend on background indexing).
	if (step.timeBarrier) {
		const delay = Math.max(0, step.timeBarrier - (Date.now() - ctx.serverStartTime));
		if (delay > 0) {
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}

	const useAuth = step.auth !== false;
	const useApiKey = step.apiKey !== false;

	const resolvedPath = interpolatePath(step.path, ctx.vars);
	let urlStr = `${ctx.baseUrl}${resolvedPath}`;
	if (useApiKey) {
		urlStr += `${urlStr.includes("?") ? "&" : "?"}${ctx.apiKeyQuery}`;
	}

	const headers: { [key: string]: string } = {};
	if (useAuth && ctx.authToken) {
		headers.cookie = `access_token=${ctx.authToken}`;
	}
	if (step.headers) {
		for (const [key, value] of Object.entries(step.headers)) {
			headers[key] = interpolateDeep(value, ctx.vars) as string;
		}
	}
	const hasBody = step.body !== undefined && step.body !== null;
	if (hasBody) {
		headers["content-type"] = "application/json";
	}

	const fetchOptions: RequestInit = { method: step.method, headers };
	if (hasBody) {
		const interpolated = interpolateDeep(step.body, ctx.vars);
		// A top-level string body means step.body was "{{varName}}" — the captured value
		// is already a JSON string (e.g. a serialized object), so send it verbatim.
		fetchOptions.body =
			typeof interpolated === "string" ? interpolated : JSON.stringify(interpolated);
	}

	const res = await fetch(urlStr, fetchOptions);

	// Parse response body — skip for 204 No Content; otherwise prefer JSON when the
	// content-type indicates it, falling back to plain text.
	let responseJson: unknown;
	let responseText: string | undefined;
	if (res.status !== 204) {
		const contentType = res.headers.get("content-type") ?? "";
		if (contentType.includes("json")) {
			responseJson = await res.json();
		} else {
			const raw = await res.text();
			if (raw) {
				responseText = raw;
			}
		}
	}

	if (res.status !== step.expectedStatus) {
		throw new Error(
			`[${step.description}] Expected ${step.expectedStatus}, got ${res.status}: ${responseText ?? JSON.stringify(responseJson)}`
		);
	}

	console.debug(`[${step.description}]`, {
		status: res.status,
		...(responseJson !== undefined ? { body: responseJson } : {}),
		...(responseText !== undefined ? { text: responseText } : {})
	});

	// Capture — extract values from the response and store them in ctx.vars so they can be
	// referenced via {{varName}} in subsequent steps.
	if (step.capture) {
		for (const [varName, spec] of Object.entries(step.capture)) {
			let captured: string | undefined;

			if (spec === "location-last-segment") {
				const loc = res.headers.get("location") ?? "";
				captured = decodeURIComponent(loc.split("/").pop() ?? "") || undefined;
			} else if (spec === "header.location") {
				captured = res.headers.get("location") ?? undefined;
			} else if (spec.startsWith("cookie:")) {
				const name = spec.slice(7);
				const raw = res.headers.get("set-cookie") ?? "";
				const m = new RegExp(`${name}=([^\\s,;]+)`).exec(raw);
				captured = m?.[1];
			} else if (spec === "body") {
				// Serialise the whole response so it can be re-embedded as a body field later.
				if (responseJson !== undefined) {
					captured = JSON.stringify(responseJson);
				}
			} else if (spec.startsWith("body.")) {
				const colonTransform = spec.endsWith("|last-colon");
				const dotPath = colonTransform ? spec.slice(5, -11) : spec.slice(5);
				const val = getNestedValue(responseJson, dotPath);
				if (val !== undefined && val !== null) {
					const raw = typeof val === "string" ? val : JSON.stringify(val);
					// |last-colon extracts the final segment of a colon-delimited URN, e.g.
					// "aig:uuid:changeset:changesetUUID" → "changesetUUID".
					captured = colonTransform ? raw.split(":").pop() : raw;
				}
			} else if (spec === "response-text") {
				captured = responseText;
			}

			if (captured) {
				ctx.vars[varName] = captured;
				// authToken gets a dedicated slot so runStep can inject it as a cookie header.
				if (varName === "authToken") {
					ctx.authToken = captured;
				}
			}
		}
	}

	// Assert — validate captured or response values against expected literals, context
	// variables, or the sentinel "isDefined".
	if (step.assert) {
		for (const [spec, expected] of Object.entries(step.assert)) {
			let actual: unknown;
			if (spec.startsWith("body.")) {
				actual = getNestedValue(responseJson, spec.slice(5));
			} else if (spec === "body") {
				actual = responseJson;
			} else if (spec === "text") {
				actual = responseText;
			}

			if (expected === "isDefined") {
				if (actual === undefined || actual === null) {
					throw new Error(
						`[${step.description}] Assert ${spec} should be defined, got ${JSON.stringify(actual)}`
					);
				}
			} else if (typeof expected === "string" && /^{{[^}]+}}$/.test(expected)) {
				// Compare against a previously captured variable rather than a literal.
				const key = expected.slice(2, -2);
				if (actual !== ctx.vars[key]) {
					throw new Error(
						`[${step.description}] Assert ${spec}: expected '${ctx.vars[key]}', got '${String(actual)}'`
					);
				}
			} else if (actual !== expected) {
				throw new Error(
					`[${step.description}] Assert ${spec}: expected '${String(expected)}', got '${String(actual)}'`
				);
			}
		}
	}
}

/**
 * Runs all steps in a group sequentially, logging skipped steps rather than executing them.
 * @param group The group definition containing the ordered steps.
 * @param ctx The shared runner context providing variables and auth state.
 */
export async function runGroup(group: GroupDefinition, ctx: RunnerContext): Promise<void> {
	console.debug(`\n=== ${group.group} ===`);
	for (const step of group.steps) {
		if (step.skip) {
			console.debug(`  [SKIP] ${step.description}: ${step.skip}`);
		} else {
			await runStep(step, ctx);
		}
	}
}

/**
 * Reads an index file that lists group filenames, loads each group JSON from the groups/
 * subdirectory alongside the index, and runs them in order.
 * Groups share the same RunnerContext so variables captured in one group are available in all
 * subsequent groups.
 * @param indexFile Absolute path to the index JSON file listing group names.
 * @param ctx The shared runner context providing variables and auth state.
 */
export async function loadAndRunGroups(indexFile: string, ctx: RunnerContext): Promise<void> {
	const groupDir = path.dirname(indexFile);
	const groupNames = JSON.parse(await readFile(indexFile, "utf8")) as string[];

	for (const groupName of groupNames) {
		const groupFile = path.join(groupDir, "groups", `${groupName}.json`);
		const group = JSON.parse(await readFile(groupFile, "utf8")) as GroupDefinition;
		await runGroup(group, ctx);
	}
}
