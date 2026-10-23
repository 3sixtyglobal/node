// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Pure rendering functions for the soak report dashboard, extracted from generate-report.mjs
 * so they can be unit tested directly without a filesystem (mirrors memory-verdict.mjs's
 * relationship to run-soak.mjs).
 *
 * The memory panel renders an inline SVG chart (no external charting library — the page must
 * stay self-contained/offline-renderable) whenever the series has enough points to be worth
 * looking at; otherwise it falls back to the verdict text only. See the feat-262 readiness
 * re-check for the history of why this used to be text-only for cloud runs (no series existed
 * before the telemetry sampler).
 *
 * A CPU panel renders the same way when report.cpuSeries is present (SOAK_MEM_SOURCE=telemetry
 * cloud runs only) — display-only, no growth verdict: CPU is naturally spiky under load and
 * bounded at 100%, so it has no leak-like failure mode the way memory growth does.
 */

/* eslint-disable camelcase -- k6's summary export uses setup_data, fixed by the k6 API (same as twin-soak.js) */

const ACCENT = '#ff7200';
// Sentinel for report.json files predating feat-262 phase 1 (no config.startedIso). Sorts last
// in updateManifest without lying about a real date — fmtDate() below renders it as "unknown".
const UNKNOWN_DATE = new Date(0).toISOString();
// Padding either side of the run's own start/finish so the Grafana link shows baseline before
// the run and recovery after it, not just the exact window.
const GRAFANA_PADDING_MS = 15 * 60 * 1000;
const GRAFANA_DASHBOARD_URL =
	'https://grafana.twinnodes.com/d/twin-core-metrics-kitsune/twin-core-metrics-kitsune-soak';
const GRAFANA_LOGS_URL =
	'https://grafana.twinnodes.com/d/db2be8bb-51ef-46ce-b35a-94fcb2a08e4d/kitsune-application-log-explorer';
// Scopes the log explorer to the twin-node container in the kitsune namespace, matching how the
// dashboard is normally opened by hand.
const GRAFANA_LOGS_PARAMS =
	'&var-cluster=$__all&var-env=staging&var-namespace=twin-nodes-kitsune&var-container=twin-node&var-service=$__all&var-pod=$__all&var-search=&var-origin_prometheus=';
// Datadog log stream for the same service and range; the query is fixed to the kitsune service the
// cloud profile targets, and the padding matches the Grafana links so the three views line up.
const DATADOG_LOGS_URL = 'https://app.datadoghq.eu/logs';
const DATADOG_LOGS_PARAMS =
	'query=service%3Atwin-node-kitsune&agg_m=count&agg_m_source=base&agg_t=count&cols=host%2Cservice&messageDisplay=inline&refresh_mode=paused&storage=hot&stream_sort=desc&viz=stream&live=false';
const VERDICT_COLORS = {
	pass: '#1a7f37',
	fail: '#cf222e',
	breach: '#cf222e',
	informational: '#9a6700',
	insufficient: '#6e7781'
};
// Chart geometry (viewBox units — the SVG scales to its container, so these are relative, not px).
const CHART_WIDTH = 760;
const CHART_HEIGHT = 220;
const CHART_PAD = { top: 12, right: 12, bottom: 24, left: 48 };
// A single point (or a flat/degenerate series) isn't worth drawing — the text verdict already
// covers it, and a chart with no visible shape would just be confusing.
const CHART_MIN_POINTS = 3;

/** @see report-renderer.d.mts */
export function buildRunEntry(report, runId, runUrl) {
	const k6 = report.k6 ?? {};
	const cfg = report.config ?? {};
	const mem = report.memory ?? {};
	return {
		runId,
		runUrl,
		date: cfg.startedIso ?? UNKNOWN_DATE,
		profile: cfg.profile ?? 'unknown',
		duration: cfg.duration ?? 'unknown',
		vus: cfg.vus ?? 0,
		verdict: k6.exitCode === 0 ? 'pass' : 'fail',
		memVerdict: mem.verdict ?? 'insufficient',
		// NaN, not 0 — a missing field means the k6 summary failed to parse, and 0 would
		// misleadingly render as "clean run, zero traffic" instead of "unknown".
		reqs: k6.httpReqs?.count ?? Number.NaN,
		failedRate: k6.httpReqFailed?.rate ?? Number.NaN,
		p50: k6.httpReqDuration?.med ?? Number.NaN,
		p95: k6.httpReqDuration?.['p(95)'] ?? Number.NaN,
		p99: k6.httpReqDuration?.['p(99)'] ?? Number.NaN,
		p95Threshold: cfg.thresholds?.p95Ms ?? 0,
		p99Threshold: cfg.thresholds?.p99Ms ?? 0
	};
}

/** @see report-renderer.d.mts */
export function isValidRunId(runId) {
	return /^[A-Za-z0-9_-]+$/.test(runId);
}

/**
 * @see report-renderer.d.mts
 * k6's summary embeds setup()'s return value as data.setup_data — for this scenario that's
 * { token, org } (see twin-soak.js's setup()), where token is the admin session token used to
 * drive the whole run's load. Never publish it verbatim.
 */
export function redactSummary(summary) {
	if (
		summary?.setup_data &&
		typeof summary.setup_data === 'object' &&
		typeof summary.setup_data.token === 'string'
	) {
		return { ...summary, setup_data: { ...summary.setup_data, token: '******' } };
	}
	return summary;
}

/** @see report-renderer.d.mts */
export function renderRunPage(report, entry) {
	const groups = report.k6?.groups ?? {};
	const groupRows = Object.entries(groups)
		.map(
			([name, g]) => `
			<tr>
				<td>${esc(name)}</td>
				<td>${g.reqs}</td>
				<td>${g.errors}</td>
				<td>${fmtMs(g.p50)}</td>
				<td>${fmtMs(g.p95)}</td>
				<td>${fmtMs(g.p99)}</td>
			</tr>`
		)
		.join('');

	return page(
		`Soak report — ${esc(fmtDate(entry.date))}`,
		`
		<a class="back" href="../../index.html">&larr; All runs</a>
		<section class="card">
			<div class="card-header">
				<span class="badge" style="background:${verdictColor(entry.verdict)}">${entry.verdict.toUpperCase()}</span>
				<h2>${esc(fmtDate(entry.date))}</h2>
			</div>
			<dl class="meta">
				<dt>Profile</dt><dd>${esc(entry.profile)}</dd>
				<dt>Duration</dt><dd>${esc(entry.duration)}</dd>
				<dt>VUs</dt><dd>${entry.vus}</dd>
				<dt>Thresholds</dt><dd>p95 &le; ${entry.p95Threshold} ms &middot; p99 &le; ${entry.p99Threshold} ms</dd>
				${entry.runUrl ? `<dt>CI run</dt><dd><a href="${esc(entry.runUrl)}">View on GitHub</a></dd>` : ''}
				${grafanaLinkRow(report.config ?? {})}
			</dl>
		</section>

		<section class="card">
			<h3>k6 metrics</h3>
			<dl class="meta">
				<dt>Requests</dt><dd>${fmtCount(entry.reqs)}</dd>
				<dt>Failed</dt><dd>${fmtPct(entry.failedRate)}</dd>
				<dt>p50 / p95 / p99</dt><dd>${fmtMs(entry.p50)} / ${fmtMs(entry.p95)} / ${fmtMs(entry.p99)}</dd>
			</dl>
			${
				groupRows
					? `<table>
				<thead><tr><th>Group</th><th>Reqs</th><th>Errors</th><th>p50</th><th>p95</th><th>p99</th></tr></thead>
				<tbody>${groupRows}</tbody>
			</table>`
					: '<p class="dim">No per-group metrics recorded.</p>'
			}
		</section>

		<section class="card">
			<h3>Memory</h3>
			${renderMemorySection(report.memory ?? {}, report.series, report.config?.warmupDiscardMs, report.config?.memSource, report.config?.memSamplerUnsupported)}
		</section>

		${renderCpuSection(report.cpuSeries)}
		`
	);
}

/** Render the CPU section, or '' when no CPU series was collected (only the telemetry sampler produces one). */
function renderCpuSection(cpuSeries) {
	const chart = renderCpuChart(cpuSeries ?? []);
	if (!chart) {
		return '';
	}
	return `
		<section class="card">
			<h3>CPU</h3>
			${chart}
		</section>`;
}

/**
 * Render the memory section: verdict text, plus an inline chart when the series has enough points.
 * With no samples the text says why: a run with no sampler at all is a different situation from a
 * telemetry sampler whose every poll failed, and the second one points at the target, not the run.
 */
function renderMemorySection(mem, series, warmupDiscardMs, memSource, memSamplerUnsupported) {
	const verdict = mem.verdict ?? 'insufficient';
	if (verdict === 'insufficient' && (mem.totalSamples ?? 0) === 0) {
		if (memSamplerUnsupported) {
			return '<p class="dim">Memory not sampled: the target answered 501 Not Implemented on <code>/telemetry/metric/&hellip;/value</code>. Its configured telemetry connector does not serve reads (for example an OpenTelemetry-only setup), so memory for this run is only in the server metrics dashboard.</p>';
		}
		if (memSource === 'telemetry') {
			return '<p class="dim">Memory sampler returned no samples: the telemetry sampler polled the target <code>/telemetry/metric/&hellip;/value</code> endpoint for the whole run and every poll failed or timed out (see the <code>Remote memory sampler</code> warnings in the run log). The telemetry reads on the target were not answering in time; the run itself was not affected.</p>';
		}
		return '<p class="dim">Memory not sampled for this run (no local process to sample and no telemetry sampler configured).</p>';
	}
	const lines = [
		`<dt>Verdict</dt><dd><span class="badge" style="background:${verdictColor(verdict)}">${verdict.toUpperCase()}</span></dd>`,
		`<dt>Floor slope</dt><dd>${num(mem.slopeMbPerHr, 1)} MB/hr</dd>`,
		`<dt>Raw slope</dt><dd>${num(mem.rawSlopeMbPerHr, 1)} MB/hr</dd>`,
		`<dt>Samples</dt><dd>${mem.samples ?? 0} of ${mem.totalSamples ?? 0} (post warm-up)</dd>`,
		`<dt>Peak</dt><dd>${mem.peakMb === null || mem.peakMb === undefined ? 'n/a' : `${num(mem.peakMb, 1)} MB`}</dd>`
	];
	if (mem.extended) {
		lines.push(
			`<dt>Extended</dt><dd>yes — was ${esc(mem.preExtensionVerdict ?? 'unknown')} before the automatic disambiguation extension</dd>`
		);
	}
	const chart = renderMemoryChart(series ?? [], mem, warmupDiscardMs ?? 0);
	return `<dl class="meta">${lines.join('')}</dl>${chart}`;
}

/**
 * Render the sampled RSS series as an inline SVG line chart — no external charting library, so
 * the report stays self-contained/offline-renderable. Shades the warm-up window (excluded from
 * the growth-slope calculation) and marks the floor-start/floor-end/peak reference points, the
 * same signals the text panel above already reports as numbers.
 * Returns '' when there are too few points to draw a meaningful shape.
 */
function renderMemoryChart(series, mem, warmupDiscardMs) {
	if (series.length < CHART_MIN_POINTS) {
		return '';
	}

	const values = series.map(p => ({ t: p.t, v: p.rssBytes / 1_000_000 })); // MB
	const chart = buildLineChart(values);
	if (!chart) {
		return '';
	}
	const { x, y, plotW, plotH, linePoints, areaPoints, yTicks, xTicks, tMin } = chart;

	const warmupEndX = x(tMin + warmupDiscardMs);
	const warmupRect =
		warmupDiscardMs > 0 && warmupEndX > CHART_PAD.left
			? `<rect x="${CHART_PAD.left}" y="${CHART_PAD.top}" width="${(Math.min(warmupEndX, CHART_PAD.left + plotW) - CHART_PAD.left).toFixed(1)}" height="${plotH}" fill="#6e7781" opacity="0.12" />`
			: '';

	const floorLines = [
		floorLine(mem.floorStartMb, '#9a6700', 'Floor start'),
		floorLine(mem.floorEndMb, ACCENT, 'Floor end')
	]
		.filter(Boolean)
		.join('');

	const peakMarker =
		Number.isFinite(mem.peakMb) && mem.peakMb !== null
			? peakDot(values, mem.peakMb, x, y, mb => `Peak: ${num(mb, 1)} MB`)
			: '';

	function floorLine(mb, color, label) {
		if (mb === null || mb === undefined || !Number.isFinite(mb)) {
			return '';
		}
		const yy = y(mb).toFixed(1);
		return `
			<line x1="${CHART_PAD.left}" y1="${yy}" x2="${CHART_WIDTH - CHART_PAD.right}" y2="${yy}" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7">
				<title>${esc(label)}: ${num(mb, 1)} MB</title>
			</line>`;
	}

	return `
		<figure class="chart">
			<svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="Process RSS memory over the run">
				${warmupRect}
				${yTicks}
				${xTicks}
				<polygon points="${areaPoints}" fill="${ACCENT}" opacity="0.15" />
				<polyline points="${linePoints}" fill="none" stroke="${ACCENT}" stroke-width="1.5" />
				${floorLines}
				${peakMarker}
			</svg>
			<figcaption class="dim">RSS over time (MB) — shaded region is the warm-up window excluded from the growth slope.</figcaption>
		</figure>`;
}

/**
 * Render the sampled CPU-percent series as an inline SVG line chart. Display-only: unlike
 * memory, there is no growth verdict for CPU (it is naturally spiky under load and bounded at
 * 100%, so "trending up" carries no leak-like meaning) — this only marks the observed peak.
 * Returns '' when there are too few points to draw a meaningful shape.
 */
function renderCpuChart(series) {
	if (series.length < CHART_MIN_POINTS) {
		return '';
	}

	const values = series.map(p => ({ t: p.t, v: p.cpuPercent }));
	const chart = buildLineChart(values, { vMinFloor: 0, vMaxCeil: 100 });
	if (!chart) {
		return '';
	}
	const { x, y, linePoints, areaPoints, yTicks, xTicks } = chart;

	const peakPercent = Math.max(...values.map(p => p.v));
	const peakMarker = Number.isFinite(peakPercent)
		? peakDot(values, peakPercent, x, y, pct => `Peak: ${num(pct, 1)}%`)
		: '';

	return `
		<figure class="chart">
			<svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="System CPU usage over the run">
				${yTicks}
				${xTicks}
				<polygon points="${areaPoints}" fill="#8250df" opacity="0.15" />
				<polyline points="${linePoints}" fill="none" stroke="#8250df" stroke-width="1.5" />
				${peakMarker}
			</svg>
			<figcaption class="dim">System CPU usage over time (%) — display only, no growth verdict.</figcaption>
		</figure>`;
}

/**
 * Shared geometry for the memory/CPU line charts: axis scales, tick marks, and the
 * line/area polyline point strings. Returns null when the series is empty.
 */
function buildLineChart(points, { vMinFloor, vMaxCeil } = {}) {
	if (points.length === 0) {
		return null;
	}

	const tMin = Math.min(...points.map(p => p.t));
	const tMax = Math.max(...points.map(p => p.t));
	let vMin = Math.min(...points.map(p => p.v));
	let vMax = Math.max(...points.map(p => p.v));
	if (vMin === vMax) {
		// A perfectly flat series would otherwise divide by zero below; pad it into a visible band.
		vMin -= 1;
		vMax += 1;
	}
	// Headroom so the line/markers never touch the plot edges.
	const vPad = (vMax - vMin) * 0.08;
	vMin = vMinFloor === undefined ? vMin - vPad : Math.max(vMinFloor, vMin - vPad);
	vMax = vMaxCeil === undefined ? vMax + vPad : Math.min(vMaxCeil, vMax + vPad);

	const plotW = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
	const plotH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
	const x = t => {
		const fraction = (t - tMin) / (tMax - tMin || 1);
		const offset = fraction * plotW;
		return CHART_PAD.left + offset;
	};
	const y = v => {
		const fraction = (v - vMin) / (vMax - vMin);
		const offset = fraction * plotH;
		return CHART_PAD.top + plotH - offset;
	};

	const linePoints = points.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
	const areaPoints = [
		`${x(tMin).toFixed(1)},${(CHART_PAD.top + plotH).toFixed(1)}`,
		...linePoints,
		`${x(tMax).toFixed(1)},${(CHART_PAD.top + plotH).toFixed(1)}`
	].join(' ');

	const yTicks = axisTicks(vMin, vMax, 4)
		.map(
			v => `
			<line x1="${CHART_PAD.left}" y1="${y(v).toFixed(1)}" x2="${CHART_WIDTH - CHART_PAD.right}" y2="${y(v).toFixed(1)}" stroke="#eeeeee" />
			<text x="${CHART_PAD.left - 6}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="#6e7781">${Math.round(v)}</text>`
		)
		.join('');

	const xTicks = axisTicks(tMin, tMax, 4)
		.map(
			t => `
			<text x="${x(t).toFixed(1)}" y="${CHART_HEIGHT - 6}" text-anchor="middle" font-size="10" fill="#6e7781">${fmtElapsed(t - tMin)}</text>`
		)
		.join('');

	return { x, y, plotW, plotH, linePoints: linePoints.join(' '), areaPoints, yTicks, xTicks, tMin };
}

/** Renders a peak-value marker: a dot at whichever series point actually reached the reported peak. */
function peakDot(points, peakValue, xFn, yFn, titleFn) {
	const peakPoint = points.reduce((a, b) => (b.v > a.v ? b : a), points[0]);
	return `
		<circle cx="${xFn(peakPoint.t).toFixed(1)}" cy="${yFn(peakPoint.v).toFixed(1)}" r="3.5" fill="#cf222e">
			<title>${esc(titleFn(peakValue))}</title>
		</circle>`;
}

/** Evenly-spaced tick values between min and max, inclusive, rounded to sensible display precision. */
function axisTicks(min, max, count) {
	const ticks = [];
	for (let i = 0; i <= count; i++) {
		const step = ((max - min) * i) / count;
		ticks.push(min + step);
	}
	return ticks;
}

/** Formats a millisecond offset as a compact elapsed-time label (e.g. "5m", "1h 20m"). */
function fmtElapsed(ms) {
	const totalMinutes = Math.round(ms / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** @see report-renderer.d.mts */
export function updateManifest(existingRuns, entry) {
	const withoutThisRun = existingRuns.filter(r => r.runId !== entry.runId);
	const merged = [...withoutThisRun, entry];
	merged.sort((a, b) => b.date.localeCompare(a.date));
	return merged;
}

/** @see report-renderer.d.mts */
export function renderIndex(runs) {
	const rows = runs
		.map(
			r => `
			<tr>
				<td><a href="reports/${esc(r.runId)}/report.html">${esc(fmtDate(r.date))}</a></td>
				<td><span class="badge" style="background:${verdictColor(r.verdict)}">${r.verdict}</span></td>
				<td>${esc(r.profile)}</td>
				<td>${esc(r.duration)}</td>
				<td>${fmtCount(r.reqs)}</td>
				<td>${fmtPct(r.failedRate)}</td>
				<td>${fmtMs(r.p95)} (&le; ${r.p95Threshold})</td>
				<td>${esc(r.memVerdict)}</td>
			</tr>`
		)
		.join('');

	return page(
		'TWIN Soak Tests',
		`
		<section class="card">
			<h3>Run history (${runs.length})</h3>
			${
				rows
					? `<table>
				<thead>
					<tr><th>Date</th><th>Verdict</th><th>Profile</th><th>Duration</th><th>Reqs</th><th>Failed</th><th>p95</th><th>Memory</th></tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>`
					: '<p class="dim">No runs published yet.</p>'
			}
		</section>
		`
	);
}

// ---------------------------------------------------------------------------
// HTML shell + small formatting helpers
// ---------------------------------------------------------------------------

/** Wrap body content in the site shell, matching apps/node/soak/web's look (self-contained, no external resources). */
function page(title, body) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<style>${css()}</style>
</head>
<body>
<header><h1>TWIN Soak Tests</h1></header>
<main>${body}</main>
<footer><span>&copy; IOTA Foundation 2026</span></footer>
</body>
</html>
`;
}

function css() {
	return `
	html{font-family:ui-sans-serif,system-ui,sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji';}
	body{margin:10px;display:flex;flex-direction:column;min-height:calc(100vh - 20px);}
	header{padding-bottom:10px;border-bottom:1px solid #eeeeee;}
	main{flex:1;padding:20px 0;}
	footer{padding-top:10px;border-top:1px solid #eeeeee;color:#6e7781;font-size:0.85rem;}
	h1{font-size:1.5rem;font-weight:bold;}
	h2{font-size:1.2rem;font-weight:bold;margin:0;}
	h3{font-size:1rem;font-weight:bold;margin:0 0 10px;}
	a{color:${ACCENT};text-decoration:none;}
	a:hover{text-decoration:underline;}
	a.back{display:inline-block;margin-bottom:14px;}
	.card{border:1px solid #eeeeee;border-radius:8px;padding:16px;margin-bottom:16px;}
	.card-header{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
	.badge{display:inline-block;color:#fff;font-size:0.75rem;font-weight:bold;padding:2px 8px;border-radius:4px;}
	.meta{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0;}
	.meta dt{color:#6e7781;font-size:0.85rem;}
	.meta dd{margin:0;}
	.dim{color:#6e7781;}
	.chart{margin:16px 0 0;padding:0;}
	.chart svg{width:100%;height:auto;display:block;}
	.chart figcaption{margin-top:6px;font-size:0.8rem;}
	table{border-collapse:collapse;width:100%;font-size:0.9rem;}
	th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #eeeeee;}
	th{color:#6e7781;font-weight:normal;}
	`;
}

function verdictColor(verdict) {
	return VERDICT_COLORS[verdict] ?? VERDICT_COLORS.insufficient;
}

function fmtDate(iso) {
	return iso === UNKNOWN_DATE ? 'date unknown' : iso;
}

/** Renders the Grafana and Datadog meta rows, or '' when the run predates startedIso/finishedIso (feat-262 phase 1). */
function grafanaLinkRow(cfg) {
	const metricsUrl = grafanaLink(GRAFANA_DASHBOARD_URL, cfg.startedIso, cfg.finishedIso);
	const logsUrl = grafanaLink(
		GRAFANA_LOGS_URL,
		cfg.startedIso,
		cfg.finishedIso,
		GRAFANA_LOGS_PARAMS
	);
	const datadogUrl = datadogLogsLink(cfg.startedIso, cfg.finishedIso);
	return [
		metricsUrl
			? `<dt>Server metrics</dt><dd><a href="${esc(metricsUrl)}">View on Grafana</a></dd>`
			: '',
		logsUrl ? `<dt>Server logs</dt><dd><a href="${esc(logsUrl)}">View on Grafana</a></dd>` : '',
		datadogUrl
			? `<dt>Server logs (Datadog)</dt><dd><a href="${esc(datadogUrl)}">View on Datadog</a></dd>`
			: ''
	].join('');
}

/** Builds a Datadog log-stream link for the run's time range with the same padding as the Grafana links. Returns null if either timestamp is missing/invalid. */
function datadogLogsLink(startedIso, finishedIso) {
	const start = Date.parse(startedIso);
	const finish = Date.parse(finishedIso);
	if (Number.isNaN(start) || Number.isNaN(finish)) {
		return null;
	}
	const from = start - GRAFANA_PADDING_MS;
	const to = finish + GRAFANA_PADDING_MS;
	return `${DATADOG_LOGS_URL}?${DATADOG_LOGS_PARAMS}&from_ts=${from}&to_ts=${to}`;
}

/** Builds a Grafana deep link for the run's time range, padded on each side. Returns null if either timestamp is missing/invalid. */
function grafanaLink(baseUrl, startedIso, finishedIso, extraParams = '') {
	const start = Date.parse(startedIso);
	const finish = Date.parse(finishedIso);
	if (Number.isNaN(start) || Number.isNaN(finish)) {
		return null;
	}
	const from = start - GRAFANA_PADDING_MS;
	const to = finish + GRAFANA_PADDING_MS;
	return `${baseUrl}?orgId=1&from=${from}&to=${to}&timezone=browser${extraParams}`;
}

function fmtMs(value) {
	return Number.isFinite(value) ? `${Math.round(value)} ms` : 'n/a';
}

function fmtCount(value) {
	return Number.isFinite(value) ? String(value) : 'n/a';
}

function fmtPct(value) {
	return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : 'n/a';
}

function num(value, digits) {
	return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function esc(value) {
	return String(value).replace(
		/[&<>"']/g,
		c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
	);
}
