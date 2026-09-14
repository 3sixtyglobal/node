// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { createRemoteMemorySampler } from "../soak/remote-memory-sampler.mjs";

const BASE = "http://node.test";
const OPTIONS = {
	baseUrl: BASE,
	apiKey: "test-api-key",
	email: "admin@node",
	password: "pw",
	// A long poll interval so tests only exercise the immediate first poll.
	pollIntervalMs: 3_600_000
};

interface IValuePoint {
	id: string;
	ts: number;
	value: number;
}

function jsonResponse(body: unknown, init?: { status?: number; setCookie?: string }): Response {
	const headers = new Headers();
	if (init?.setCookie) {
		headers.set("set-cookie", init.setCookie);
	}
	return {
		ok: (init?.status ?? 200) < 400,
		status: init?.status ?? 200,
		headers,
		json: async () => body
	} as unknown as Response;
}

/**
 * A fetch mock serving the login, user-lookup, and values routes.
 * Values can be paginated by supplying multiple pages.
 * @param pages The value pages served in order; the last page repeats for later polls.
 * @returns The mock fetch implementation and the list of requested urls.
 */
function makeFetchMock(pages: { entities: IValuePoint[]; cursor?: string }[]): {
	fetchImpl: typeof fetch;
	calls: string[];
} {
	const calls: string[] = [];
	let pageIndex = 0;
	const fetchImpl = (async (url: string | URL) => {
		const u = String(url);
		calls.push(u);
		if (u.includes("/authentication/login")) {
			return jsonResponse({}, { setCookie: "access_token=tok123; Path=/; HttpOnly" });
		}
		if (u.includes("/authentication/admin/users/")) {
			return jsonResponse({ organizationIdentity: "did:example:org" });
		}
		if (u.includes("/telemetry/metric/")) {
			const page = pages[Math.min(pageIndex, pages.length - 1)];
			pageIndex++;
			return jsonResponse(page);
		}
		throw new Error(`unexpected url ${u}`);
	}) as typeof fetch;
	return { fetchImpl, calls };
}

async function settled(): Promise<void> {
	// The first poll runs in the background; a few macrotask turns let it complete.
	for (let i = 0; i < 10; i++) {
		await new Promise(resolve => setTimeout(resolve, 5));
	}
}

describe("remote-memory-sampler", () => {
	test("logs in, queries values scoped to the admin org and maps points to samples", async () => {
		const start = Date.now();
		const { fetchImpl, calls } = makeFetchMock([
			{
				entities: [
					{ id: "a", ts: start + 1000, value: 500_000_000 },
					{ id: "b", ts: start + 61_000, value: 510_000_000 }
				]
			}
		]);

		const sampler = createRemoteMemorySampler({ ...OPTIONS, fetchImpl });
		await settled();
		const series = sampler.stop();

		expect(series).toHaveLength(2);
		expect(series[0].rssBytes).toBe(500_000_000);
		expect(series[1].rssBytes).toBe(510_000_000);
		expect(series[0].t).toBeGreaterThanOrEqual(0);
		expect(series[1].t).toBeGreaterThan(series[0].t);

		const valuesCall = calls.find(c => c.includes("/telemetry/metric/"));
		expect(valuesCall).toContain("process_memory_rss_bytes");
		expect(valuesCall).toContain(`organization=${encodeURIComponent("did:example:org")}`);
	});

	test("collapses duplicate broadcast copies (identical values milliseconds apart)", async () => {
		const start = Date.now();
		const { fetchImpl } = makeFetchMock([
			{
				entities: [
					{ id: "a", ts: start + 1000, value: 500_000_000 },
					{ id: "b", ts: start + 1002, value: 500_000_000 },
					{ id: "c", ts: start + 1003, value: 500_000_000 },
					{ id: "d", ts: start + 61_000, value: 510_000_000 },
					{ id: "e", ts: start + 61_002, value: 510_000_000 }
				]
			}
		]);

		const sampler = createRemoteMemorySampler({ ...OPTIONS, fetchImpl });
		await settled();
		const series = sampler.stop();

		expect(series.map(sample => sample.rssBytes)).toEqual([500_000_000, 510_000_000]);
	});

	test("keeps identical values further apart than the dedupe window", async () => {
		const start = Date.now();
		const { fetchImpl } = makeFetchMock([
			{
				entities: [
					{ id: "a", ts: start + 1000, value: 500_000_000 },
					{ id: "b", ts: start + 61_000, value: 500_000_000 }
				]
			}
		]);

		const sampler = createRemoteMemorySampler({ ...OPTIONS, fetchImpl });
		await settled();
		const series = sampler.stop();

		expect(series).toHaveLength(2);
	});

	test("follows cursors across pages", async () => {
		const start = Date.now();
		const { fetchImpl, calls } = makeFetchMock([
			{
				entities: [{ id: "a", ts: start + 1000, value: 500_000_000 }],
				cursor: "next-page"
			},
			{
				entities: [{ id: "b", ts: start + 61_000, value: 510_000_000 }]
			}
		]);

		const sampler = createRemoteMemorySampler({ ...OPTIONS, fetchImpl });
		await settled();
		const series = sampler.stop();

		expect(series).toHaveLength(2);
		const valueCalls = calls.filter(c => c.includes("/telemetry/metric/"));
		expect(valueCalls).toHaveLength(2);
		expect(valueCalls[1]).toContain("cursor=next-page");
	});

	test("serves an empty series and does not throw when login fails", async () => {
		const warnings: string[] = [];
		const fetchImpl = (async () => jsonResponse({}, { status: 401 })) as typeof fetch;

		const sampler = createRemoteMemorySampler({
			...OPTIONS,
			fetchImpl,
			log: (level, message) => {
				warnings.push(`${level}:${message}`);
			}
		});
		await settled();
		const series = sampler.stop();

		expect(series).toEqual([]);
		expect(warnings.some(w => w.startsWith("warn:"))).toBe(true);
	});

	test("serves an empty series and does not throw when the user lookup fails", async () => {
		const warnings: string[] = [];
		const fetchImpl = (async (url: string | URL) => {
			const u = String(url);
			if (u.includes("/authentication/login")) {
				return jsonResponse({}, { setCookie: "access_token=tok123;" });
			}
			if (u.includes("/authentication/admin/users/")) {
				return jsonResponse({}, { status: 500 });
			}
			throw new Error(`unexpected url ${u}`);
		}) as typeof fetch;

		const sampler = createRemoteMemorySampler({
			...OPTIONS,
			fetchImpl,
			log: (level, message) => {
				warnings.push(`${level}:${message}`);
			}
		});
		await settled();
		const series = sampler.stop();

		expect(series).toEqual([]);
		expect(warnings.some(w => w.startsWith("warn:"))).toBe(true);
	});

	test("retries the user lookup on the next poll after a transient failure", async () => {
		const start = Date.now();
		let failUserLookup = true;
		const fetchImpl = (async (url: string | URL) => {
			const u = String(url);
			if (u.includes("/authentication/login")) {
				return jsonResponse({}, { setCookie: "access_token=tok123;" });
			}
			if (u.includes("/authentication/admin/users/")) {
				return failUserLookup
					? jsonResponse({}, { status: 500 })
					: jsonResponse({ organizationIdentity: "did:example:org" });
			}
			return jsonResponse({
				entities: [{ id: "a", ts: start + 1000, value: 500_000_000 }]
			});
		}) as typeof fetch;

		const sampler = createRemoteMemorySampler({ ...OPTIONS, fetchImpl, pollIntervalMs: 20 });
		await settled();
		expect(sampler.peek()).toEqual([]);

		failUserLookup = false;
		await settled();
		const series = sampler.stop();

		expect(series).toHaveLength(1);
		expect(series[0].rssBytes).toBe(500_000_000);
	});

	test("stops polling after the target answers 501 and reports the read API as unsupported", async () => {
		const warnings: string[] = [];
		let valueCalls = 0;
		const fetchImpl = (async (url: string | URL) => {
			const u = String(url);
			if (u.includes("/authentication/login")) {
				return jsonResponse({}, { setCookie: "access_token=tok123;" });
			}
			if (u.includes("/authentication/admin/users/")) {
				return jsonResponse({ organizationIdentity: "did:example:org" });
			}
			valueCalls++;
			return jsonResponse({}, { status: 501 });
		}) as typeof fetch;

		const sampler = createRemoteMemorySampler({
			...OPTIONS,
			fetchImpl,
			pollIntervalMs: 20,
			log: (level, message) => {
				if (level === "warn") {
					warnings.push(message);
				}
			}
		});
		await settled();
		await settled();
		const series = sampler.stop();

		expect(series).toHaveLength(0);
		expect(valueCalls).toBe(1);
		expect(sampler.status()).toEqual({ polls: 1, failures: 1, unsupported: true });
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("501 Not Implemented");
		expect(warnings[0]).toContain("Polling stopped");
	});

	test("keeps polling and counts the failure when the target answers a status other than 501", async () => {
		let valueCalls = 0;
		const fetchImpl = (async (url: string | URL) => {
			const u = String(url);
			if (u.includes("/authentication/login")) {
				return jsonResponse({}, { setCookie: "access_token=tok123;" });
			}
			if (u.includes("/authentication/admin/users/")) {
				return jsonResponse({ organizationIdentity: "did:example:org" });
			}
			valueCalls++;
			return jsonResponse({}, { status: 500 });
		}) as typeof fetch;

		const sampler = createRemoteMemorySampler({ ...OPTIONS, fetchImpl, pollIntervalMs: 20 });
		await settled();
		await settled();
		sampler.stop();

		expect(valueCalls).toBeGreaterThan(1);
		expect(sampler.status().unsupported).toBe(false);
	});

	test("keeps the last good series when a later poll fails", async () => {
		const start = Date.now();
		let failValues = false;
		const fetchImpl = (async (url: string | URL) => {
			const u = String(url);
			if (u.includes("/authentication/login")) {
				return jsonResponse({}, { setCookie: "access_token=tok123;" });
			}
			if (u.includes("/authentication/admin/users/")) {
				return jsonResponse({ organizationIdentity: "did:example:org" });
			}
			if (failValues) {
				return jsonResponse({}, { status: 500 });
			}
			return jsonResponse({
				entities: [{ id: "a", ts: start + 1000, value: 500_000_000 }]
			});
		}) as typeof fetch;

		const sampler = createRemoteMemorySampler({ ...OPTIONS, fetchImpl, pollIntervalMs: 20 });
		await settled();
		failValues = true;
		await settled();
		const series = sampler.stop();

		expect(series).toHaveLength(1);
		expect(series[0].rssBytes).toBe(500_000_000);
	});
});
