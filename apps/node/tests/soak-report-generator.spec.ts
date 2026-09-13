// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/* eslint-disable camelcase -- k6's summary export uses setup_data, fixed by the k6 API (same as twin-soak.js) */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IRunEntry, ISoakReport } from "../soak/report-renderer.d.mts";
import {
	buildRunEntry,
	isValidRunId,
	redactSummary,
	renderIndex,
	renderRunPage,
	updateManifest
} from "../soak/report-renderer.mjs";

async function loadFixture(dirName: string): Promise<ISoakReport> {
	const raw = await readFile(path.resolve("./tests/fixtures/soak", dirName, "report.json"), "utf8");
	return JSON.parse(raw) as ISoakReport;
}

describe("soak report generator", () => {
	describe("buildRunEntry", () => {
		test("a green (passing) run, current report.json shape (feat-262 phase 1 + feat-367 fields present)", async () => {
			const report = await loadFixture("report-green");

			const entry = buildRunEntry(report, "12345", "https://github.com/x/y/actions/runs/12345");

			expect(entry.verdict).toEqual("pass");
			expect(entry.runId).toEqual("12345");
			expect(entry.runUrl).toEqual("https://github.com/x/y/actions/runs/12345");
			expect(entry.date).toEqual("2026-08-28T07:22:56.524Z");
			expect(entry.profile).toEqual("file-local");
			expect(entry.p95).toBeCloseTo(253.642785);
			expect(entry.p95Threshold).toEqual(3000);
			expect(entry.memVerdict).toEqual("insufficient");
		});

		test("a failed run, older report.json shape (no startedIso, no feat-367 fields)", async () => {
			const report = await loadFixture("report-failed");

			const entry = buildRunEntry(report, "67890", null);

			expect(entry.verdict).toEqual("fail");
			expect(entry.p95).toBeCloseTo(527.3325592000004);
			expect(entry.p95Threshold).toEqual(3300);
			expect(entry.runUrl).toBeNull();
			// No startedIso in this fixture — falls back to the epoch sentinel (sorts last in
			// updateManifest) rather than throwing or producing the literal string "undefined".
			expect(entry.date).toEqual(new Date(0).toISOString());
		});

		test("a run whose k6 summary failed to parse (report.k6.httpReqDuration absent) yields NaN, not 0", async () => {
			const report = await loadFixture("report-green");
			// Mirrors run-soak.mjs's summarizeK6() output when reportSummary() returned null.
			report.k6 = {
				...report.k6,
				httpReqDuration: undefined,
				httpReqFailed: undefined,
				httpReqs: undefined
			};

			const entry = buildRunEntry(report, "12345", null);

			expect(entry.reqs).toBeNaN();
			expect(entry.failedRate).toBeNaN();
			expect(entry.p50).toBeNaN();
			expect(entry.p95).toBeNaN();
			expect(entry.p99).toBeNaN();
		});
	});

	describe("renderRunPage", () => {
		test("acceptance signal: contains the memory verdict and the correct p95 from the fixture", async () => {
			const report = await loadFixture("report-green");
			const entry = buildRunEntry(report, "12345", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("INSUFFICIENT");
			expect(html).toContain("254 ms"); // p95, rounded (253.64... -> 254)
		});

		test("a failed run's page shows the FAIL badge and still renders group metrics from the old shape", async () => {
			const report = await loadFixture("report-failed");
			const entry = buildRunEntry(report, "67890", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("FAIL");
			expect(html).toContain("dataspace");
			expect(html).toContain("527 ms"); // p95
		});

		test("a run with no memory samples explains why, instead of showing zeros", async () => {
			const report = await loadFixture("report-failed");
			const entry = buildRunEntry(report, "67890", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("not sampled for this run");
			expect(html).not.toContain("returned no samples");
		});

		test("a run whose target does not implement telemetry reads says so instead of blaming the sampler", async () => {
			const report = await loadFixture("report-failed");
			report.config = { ...report.config, memSource: "telemetry", memSamplerUnsupported: true };
			const entry = buildRunEntry(report, "67890", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("501 Not Implemented");
			expect(html).toContain("does not serve reads");
			expect(html).not.toContain("returned no samples");
			expect(html).not.toContain("not sampled for this run");
		});

		test("a telemetry-sampled run whose every poll failed says the sampler got no data, not that it was absent", async () => {
			const report = await loadFixture("report-failed");
			report.config = { ...report.config, memSource: "telemetry" };
			const entry = buildRunEntry(report, "67890", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("returned no samples");
			expect(html).toContain("every poll failed or timed out");
			expect(html).not.toContain("not sampled for this run");
		});

		test("an extended run (feat-367) shows its pre-extension verdict", async () => {
			const report = await loadFixture("report-green");
			report.memory = {
				...report.memory,
				verdict: "pass",
				totalSamples: 400,
				extended: true,
				preExtensionVerdict: "breach"
			};
			const entry = buildRunEntry(report, "12345", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("Extended");
			expect(html).toContain("breach");
		});

		test("renders with no remote script or stylesheet references (offline-renderable)", async () => {
			const report = await loadFixture("report-green");
			const entry = buildRunEntry(report, "12345", "https://github.com/x/y/actions/runs/12345");

			const html = renderRunPage(report, entry);

			expect(html).not.toMatch(/<script[^>]+src=/i);
			expect(html).not.toMatch(/<link[^>]+href="https?:/i);
		});

		test("a run with too few samples (report-green, 2 points) shows no chart", async () => {
			const report = await loadFixture("report-green");
			const entry = buildRunEntry(report, "12345", null);

			const html = renderRunPage(report, entry);

			expect(html).not.toContain('class="chart"');
		});

		test("a run with a real multi-point series (report-memory-chart) draws the SVG chart", async () => {
			const report = await loadFixture("report-memory-chart");
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain('class="chart"');
			expect(html).toContain("<svg");
			// One polyline point per series entry (fixture has 12 points).
			const polyline = /<polyline points="([^"]+)"/.exec(html);
			expect(polyline?.[1].trim().split(/\s+/)).toHaveLength(report.series.length);
		});

		test("the chart plots within its viewBox and marks the reported peak", async () => {
			const report = await loadFixture("report-memory-chart");
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);
			const viewBoxMatch = /viewBox="0 0 (\d+) (\d+)"/.exec(html);
			expect(viewBoxMatch).not.toBeNull();
			const [, widthStr, heightStr] = viewBoxMatch ?? [];
			const width = Number(widthStr);
			const height = Number(heightStr);

			const coords = [...html.matchAll(/(?:cx|x1|x2)="(-?[\d.]+)"/g)].map(m => Number(m[1]));
			const yCoords = [...html.matchAll(/(?:cy|y1|y2)="(-?[\d.]+)"/g)].map(m => Number(m[1]));
			for (const xVal of coords) {
				expect(xVal).toBeGreaterThanOrEqual(0);
				expect(xVal).toBeLessThanOrEqual(width);
			}
			for (const yVal of yCoords) {
				expect(yVal).toBeGreaterThanOrEqual(0);
				expect(yVal).toBeLessThanOrEqual(height);
			}

			// The peak marker's <title> reports the same MB figure as the text panel above it.
			const peakMb = report.memory.peakMb;
			expect(peakMb).not.toBeNull();
			expect(html).toContain(`Peak: ${(peakMb ?? 0).toFixed(1)} MB`);
		});

		test("a flat series (all equal values) still renders a chart instead of dividing by zero", async () => {
			const report = await loadFixture("report-memory-chart");
			report.series = [
				{ t: 0, rssBytes: 500_000_000 },
				{ t: 60_000, rssBytes: 500_000_000 },
				{ t: 120_000, rssBytes: 500_000_000 }
			];
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain('class="chart"');
			expect(html).not.toContain("NaN");
			expect(html).not.toContain("Infinity");
		});

		test("a run with no warm-up configured (older report.json) draws the chart with no shaded region", async () => {
			const report = await loadFixture("report-memory-chart");
			report.config = { ...report.config, warmupDiscardMs: undefined };
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain('class="chart"');
			expect(html).not.toContain('fill="#6e7781" opacity="0.12"');
		});

		test("a run with no cpuSeries shows no CPU card at all", async () => {
			const report = await loadFixture("report-memory-chart");
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);

			expect(html).not.toContain("<h3>CPU</h3>");
		});

		test("a run with a cpuSeries draws a second, display-only chart with no verdict badge", async () => {
			const report = await loadFixture("report-memory-chart");
			report.cpuSeries = report.series.map((p, i) => {
				const wobble = (i % 3) * 5;
				return { t: p.t, cpuPercent: 10 + wobble };
			});
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("<h3>CPU</h3>");
			const cpuCard = html.slice(html.indexOf("<h3>CPU</h3>"));
			expect(cpuCard).toContain("<svg");
			expect(cpuCard).not.toContain('class="badge"');
			// Two independent charts on the page: memory's and CPU's.
			expect(html.match(/class="chart"/g)).toHaveLength(2);
		});

		test("the CPU chart clamps its axis to [0, 100] and marks the observed peak", async () => {
			const report = await loadFixture("report-memory-chart");
			report.cpuSeries = report.series.map((p, i) => ({
				t: p.t,
				cpuPercent: i === 5 ? 97 : 20
			}));
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);
			const cpuCard = html.slice(html.indexOf("<h3>CPU</h3>"));

			const yLabels = [...cpuCard.matchAll(/font-size="10" fill="#6e7781">(-?\d+)<\/text>/g)]
				.map(m => Number(m[1]))
				.filter(v => !Number.isNaN(v));
			for (const label of yLabels) {
				expect(label).toBeGreaterThanOrEqual(0);
				expect(label).toBeLessThanOrEqual(100);
			}
			expect(cpuCard).toContain("Peak: 97.0%");
		});

		test("a CPU series too short to chart renders no CPU card (same threshold as memory)", async () => {
			const report = await loadFixture("report-memory-chart");
			report.cpuSeries = [
				{ t: 0, cpuPercent: 10 },
				{ t: 60_000, cpuPercent: 12 }
			];
			const entry = buildRunEntry(report, "chart-01", null);

			const html = renderRunPage(report, entry);

			expect(html).not.toContain("<h3>CPU</h3>");
		});

		test("a run missing startedIso shows 'date unknown' instead of the raw 1970 sentinel", async () => {
			const report = await loadFixture("report-failed");
			const entry = buildRunEntry(report, "67890", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("date unknown");
			expect(html).not.toContain("1970-01-01");
		});

		test("a run with startedIso/finishedIso links to Grafana with a 15-minute padded range", async () => {
			const report = await loadFixture("report-green");
			const entry = buildRunEntry(report, "12345", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("grafana.twinnodes.com/d/twin-core-metrics-kitsune");
			// startedIso 07:22:56.524Z minus 15m, finishedIso 07:23:26.210Z plus 15m.
			expect(html).toContain("from=1787900876524");
			expect(html).toContain("to=1787902706210");
		});

		test("a run with startedIso/finishedIso links to the Datadog log stream with the same padded range", async () => {
			const report = await loadFixture("report-green");
			const entry = buildRunEntry(report, "12345", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain("Server logs (Datadog)");
			const datadogHref = /href="[^"]*app\.datadoghq\.eu\/logs[^"]*"/.exec(html)?.[0] ?? "";
			expect(datadogHref).toContain("query=service%3Atwin-node-kitsune");
			expect(datadogHref).toContain("live=false");
			// Same padded window as the Grafana links, in Datadog's from_ts/to_ts parameters.
			expect(datadogHref).toContain("from_ts=1787900876524");
			expect(datadogHref).toContain("to_ts=1787902706210");
		});

		test("a run with startedIso/finishedIso links to the application log explorer with the same padded range", async () => {
			const report = await loadFixture("report-green");
			const entry = buildRunEntry(report, "12345", null);

			const html = renderRunPage(report, entry);

			expect(html).toContain(
				"grafana.twinnodes.com/d/db2be8bb-51ef-46ce-b35a-94fcb2a08e4d/kitsune-application-log-explorer"
			);
			expect(html).toContain("Server logs");
			expect(html).toContain("var-namespace=twin-nodes-kitsune");
			expect(html).toContain("var-container=twin-node");
			// Same padded window as the metrics link.
			const logsHref = /href="[^"]*kitsune-application-log-explorer[^"]*"/.exec(html)?.[0] ?? "";
			expect(logsHref).toContain("from=1787900876524");
			expect(logsHref).toContain("to=1787902706210");
		});

		test("a run predating startedIso/finishedIso (feat-262 phase 1) has no Grafana link", async () => {
			const report = await loadFixture("report-failed");
			const entry = buildRunEntry(report, "67890", null);

			const html = renderRunPage(report, entry);

			expect(html).not.toContain("grafana.twinnodes.com");
		});

		test("a run with no k6 summary shows n/a for requests/failed/p50/p95/p99, not 0 or NaN", async () => {
			const report = await loadFixture("report-green");
			report.k6 = {
				...report.k6,
				httpReqDuration: undefined,
				httpReqFailed: undefined,
				httpReqs: undefined
			};
			const entry = buildRunEntry(report, "12345", null);

			const html = renderRunPage(report, entry);
			const metricsCard = html.slice(
				html.indexOf("k6 metrics"),
				html.indexOf("</dl>", html.indexOf("k6 metrics"))
			);

			expect(metricsCard).not.toContain("NaN");
			expect(metricsCard).toContain("<dd>n/a</dd>");
			// Requests, Failed, p50, p95, p99 each render n/a independently.
			expect(metricsCard.match(/n\/a/g)?.length).toEqual(5);
		});
	});

	describe("isValidRunId", () => {
		test("accepts GitHub Actions run ids and other safe identifiers", () => {
			expect(isValidRunId("33155070596")).toBe(true);
			expect(isValidRunId("local-preview")).toBe(true);
			expect(isValidRunId("run_A-1")).toBe(true);
		});

		test("rejects path traversal and other unsafe characters", () => {
			expect(isValidRunId("../../etc/passwd")).toBe(false);
			expect(isValidRunId("../secrets")).toBe(false);
			expect(isValidRunId("a/b")).toBe(false);
			expect(isValidRunId("a b")).toBe(false);
			expect(isValidRunId("")).toBe(false);
		});
	});

	describe("redactSummary", () => {
		test("redacts setup_data.token when present", () => {
			const summary = { setup_data: { org: "did:x", token: "eyJ.real.jwt" }, metrics: {} };

			const redacted = redactSummary(summary) as typeof summary;

			expect(redacted.setup_data.token).toEqual("******");
			expect(redacted.setup_data.org).toEqual("did:x");
			// The input is not mutated — callers that hold a reference to the original see it unchanged.
			expect(summary.setup_data.token).toEqual("eyJ.real.jwt");
		});

		test("passes through unchanged when there is no token to redact", () => {
			const summary = { metrics: {} };

			expect(redactSummary(summary)).toEqual(summary);
		});

		test("passes through unchanged when setup_data has no token field", () => {
			const summary = { setup_data: { org: "did:x" }, metrics: {} };

			expect(redactSummary(summary)).toEqual(summary);
		});
	});

	describe("updateManifest", () => {
		const makeEntry = (runId: string, date: string): IRunEntry => ({
			runId,
			runUrl: null,
			date,
			profile: "cloud",
			duration: "1h",
			vus: 5,
			verdict: "pass",
			memVerdict: "insufficient",
			reqs: 100,
			failedRate: 0,
			p50: 100,
			p95: 200,
			p99: 300,
			p95Threshold: 3000,
			p99Threshold: 5000
		});

		test("prepends a new run and sorts newest-first", () => {
			const existing = [makeEntry("1", "2026-08-01T00:00:00.000Z")];

			const result = updateManifest(existing, makeEntry("2", "2026-08-02T00:00:00.000Z"));

			expect(result.map(r => r.runId)).toEqual(["2", "1"]);
		});

		test("de-duplicates by runId: re-generating the same run replaces its entry instead of appending a duplicate", () => {
			const existing = [
				makeEntry("1", "2026-08-01T00:00:00.000Z"),
				makeEntry("2", "2026-08-02T00:00:00.000Z")
			];
			const rerun = { ...makeEntry("2", "2026-08-02T00:00:00.000Z"), verdict: "fail" as const };

			const result = updateManifest(existing, rerun);

			expect(result).toHaveLength(2);
			expect(result.find(r => r.runId === "2")?.verdict).toEqual("fail");
		});
	});

	describe("renderIndex", () => {
		test("lists one row per run, linking to its report page", () => {
			const runs: IRunEntry[] = [
				{
					runId: "12345",
					runUrl: null,
					date: "2026-08-28T02:00:00.000Z",
					profile: "cloud",
					duration: "1h",
					vus: 5,
					verdict: "pass",
					memVerdict: "insufficient",
					reqs: 1000,
					failedRate: 0.01,
					p50: 100,
					p95: 200,
					p99: 300,
					p95Threshold: 3000,
					p99Threshold: 5000
				}
			];

			const html = renderIndex(runs);

			expect(html).toContain("reports/12345/report.html");
			expect(html).toContain("Run history (1)");
		});

		test("an empty manifest renders without error", () => {
			const html = renderIndex([]);

			expect(html).toContain("No runs published yet");
		});

		test("renders with no remote script or stylesheet references (offline-renderable)", () => {
			const html = renderIndex([]);

			expect(html).not.toMatch(/<script[^>]+src=/i);
			expect(html).not.toMatch(/<link[^>]+href="https?:/i);
		});
	});
});
