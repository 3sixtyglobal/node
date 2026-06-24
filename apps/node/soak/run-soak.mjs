// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Soak-test orchestrator for the twin-node server.
 *
 * Pipeline: bootstrap a file-backed node → start it as a child process → poll GET /readyz →
 * drive k6 load (per-VU auth + reads) while sampling the process's OS-level memory → evaluate
 * k6 thresholds + memory-growth slope → exit non-zero on breach → tear down.
 *
 * Memory is sampled at the OS level (private bytes) rather than via the node's telemetry REST API:
 * in a standalone node the metrics collector captures a single value at startup and the REST API
 * returns only that frozen value, so it cannot track live growth (see the memory-sampler section).
 *
 * Still to come: phase 5 (weighted traffic mix) and phase 6 (nightly CI workflow).
 *
 * See ./README.md and ../../../.cursor/tasks/node/feat-215/feat-215-implementation-plan-merged.md
 */

/* eslint-disable unicorn/no-process-exit -- this file is a CLI entry point; exit codes are the contract */
/* eslint-disable no-mixed-operators -- conflicts with Prettier, which strips the clarifying parens this rule asks for */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const ENTRY = path.join('src', 'index.js'); // relative to APP_DIR (the node's cwd)

// ---------------------------------------------------------------------------
// Config (env-driven, with defaults). See plan §9.
// ---------------------------------------------------------------------------
const cfg = {
	port: int(process.env.SOAK_PORT, 3210),
	bootTimeoutMs: durationMs(process.env.SOAK_BOOT_TIMEOUT, '120s'),
	profile: process.env.SOAK_PROFILE ?? 'file-local',
	tenantMode: process.env.SOAK_TENANT_MODE ?? 'multi',
	strictEnv: process.env.SOAK_STRICT_ENV ?? 'error', // node throws on unknown TWIN_* by default
	skipBootstrap: bool(process.env.SOAK_SKIP_BOOTSTRAP, false),
	skipLoad: bool(process.env.SOAK_SKIP_LOAD, false),
	// Load (k6) parameters.
	duration: process.env.SOAK_DURATION ?? '2m',
	vus: int(process.env.SOAK_VUS, 5),
	p95Ms: int(process.env.SOAK_P95_MS, 500),
	p99Ms: int(process.env.SOAK_P99_MS, 1500),
	errorRate: process.env.SOAK_ERROR_RATE ?? '0.01',
	k6Bin: process.env.SOAK_K6_BIN,
	// Telemetry sampler (phase 3).
	sampleIntervalMs: durationMs(process.env.SOAK_SAMPLE_INTERVAL, '10s'),
	// Default informed by a 30-min baseline: a settled node's tail-floor slope sat near 100 MB/hr
	// (sampling/GC noise on a flat floor), so 150 gives headroom while still catching a real leak.
	memGrowthLimitMbPerHr: int(process.env.SOAK_MEM_GROWTH_MB_PER_HR, 150),
	warmupDiscardMs: durationMs(process.env.SOAK_WARMUP_DISCARD, '30s'),
	// Memory growth is only a *fatal* verdict once the settled window is long enough to distinguish a
	// leak from cold-start cache/JIT/pool warm-up. Below this, the slope is reported as informational.
	memMinWindowMs: durationMs(process.env.SOAK_MEM_MIN_WINDOW, '10m'),
	// Deterministic identity/credentials so phase 2 login is reproducible.
	tenantId: process.env.SOAK_TENANT_ID ?? '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
	tenantApiKey: process.env.SOAK_TENANT_API_KEY ?? '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
	adminEmail: process.env.SOAK_ADMIN_EMAIL ?? 'admin@node',
	adminPassword: process.env.SOAK_ADMIN_PASSWORD ?? 'Admin@Node12345!',
	adminScope: process.env.SOAK_ADMIN_SCOPE ?? 'tenant-admin,user-admin'
};

const OUT_DIR = path.join(__dirname, '.out');
const DATA_ROOT = path.join(OUT_DIR, 'data');
const SERVER_LOG = path.join(OUT_DIR, 'server.log');
const SUMMARY_PATH = path.join(OUT_DIR, 'summary.json');
const REPORT_PATH = path.join(OUT_DIR, 'report.json');
const SCENARIO = path.join(__dirname, 'scenarios', 'twin-soak.js');
const baseUrl = process.env.SOAK_BASE_URL ?? `http://localhost:${cfg.port}`;

/** The running server child process, tracked so signal handlers can reap it. */
let serverChild;
let tornDown = false;

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
main().catch(async error => {
	log('error', `Soak run failed: ${error?.message ?? error}`);
	await teardown();
	process.exit(1);
});

async function main() {
	installSignalHandlers();

	log(
		'info',
		`Soak orchestrator — profile=${cfg.profile} tenantMode=${cfg.tenantMode} port=${cfg.port}`
	);
	log('info', `Output dir: ${OUT_DIR}`);

	await rm(OUT_DIR, { recursive: true, force: true });
	await mkdir(DATA_ROOT, { recursive: true });

	const nodeEnv = await buildNodeEnv();

	if (!cfg.skipBootstrap) {
		await bootstrap(nodeEnv);
	} else {
		log('info', 'SOAK_SKIP_BOOTSTRAP=true — reusing existing state');
	}

	await startServer(nodeEnv);
	await waitForReady();

	log('info', 'Node is up and ready.');

	if (cfg.skipLoad) {
		log('info', 'SOAK_SKIP_LOAD=true — readiness only, no load driven.');
		await teardown();
		process.exit(0);
	}

	// Sample the node process's OS-level RSS while k6 drives load.
	const sampler = startSampler(serverChild.pid);

	const k6Code = await runLoad();

	const series = sampler.stop();
	const mem = evaluateMemory(series);
	const k6Summary = await reportSummary();
	reportMemory(mem);
	await writeReport({ k6Code, k6Summary, mem, series });

	await teardown();

	const k6Failed = k6Code !== 0;
	const memFailed = mem.verdict === 'breach';
	if (k6Failed || memFailed) {
		if (k6Failed) {
			log('error', `k6 reported a failure/threshold breach (exit ${k6Code}).`);
		}
		if (memFailed) {
			log(
				'error',
				`RSS growth ${mem.slopeMbPerHr.toFixed(1)} MB/hr exceeded limit ${cfg.memGrowthLimitMbPerHr} MB/hr.`
			);
		}
		process.exit(1);
	}
	log('info', 'Soak run passed.');
	process.exit(0);
}

// ---------------------------------------------------------------------------
// Node lifecycle
// ---------------------------------------------------------------------------

/** Build the TWIN_* env map from the selected profile + runtime/identity overrides. */
async function buildNodeEnv() {
	const profilePath = path.join(__dirname, 'config', `soak.${cfg.profile}.env`);
	const profile = await parseEnvFile(profilePath);

	const env = {
		...profile,
		TWIN_PORT: String(cfg.port),
		TWIN_STORAGE_FILE_ROOT: DATA_ROOT,
		TWIN_STRICT_ENV: cfg.strictEnv
	};

	if (cfg.tenantMode === 'multi') {
		env.TWIN_TENANT_ENABLED = 'true';
		env.TWIN_TENANT_ID = cfg.tenantId;
		env.TWIN_TENANT_API_KEY = cfg.tenantApiKey;
	}

	return env;
}

/** Run the one-shot `bootstrap-legacy` command to create node identity + admin user. */
async function bootstrap(nodeEnv) {
	log('info', 'Bootstrapping node (bootstrap-legacy)...');
	const bootstrapEnv = {
		...nodeEnv,
		TWIN_FEATURES: 'admin-user',
		TWIN_ADMIN_USER_NAME: cfg.adminEmail,
		TWIN_ADMIN_USER_PASSWORD: cfg.adminPassword,
		TWIN_ADMIN_USER_SCOPE: cfg.adminScope
	};

	const code = await runToCompletion(['bootstrap-legacy'], bootstrapEnv);
	if (code !== 0) {
		throw new Error(`bootstrap-legacy exited with code ${code} (see ${SERVER_LOG})`);
	}
	log('info', 'Bootstrap complete.');
}

/** Start the long-running server child process. */
async function startServer(nodeEnv) {
	log('info', 'Starting node server...');
	const logStream = createWriteStream(SERVER_LOG, { flags: 'a' });

	serverChild = spawn(process.execPath, [ENTRY], {
		cwd: APP_DIR,
		env: { ...process.env, ...nodeEnv },
		stdio: ['ignore', 'pipe', 'pipe']
	});

	serverChild.stdout.pipe(logStream);
	serverChild.stderr.pipe(logStream);

	serverChild.on('exit', (code, signal) => {
		if (!tornDown) {
			log('error', `Server exited unexpectedly (code=${code} signal=${signal}). See ${SERVER_LOG}`);
		}
	});
}

/** Run the node entry with extra args to completion, returning the exit code. */
function runToCompletion(args, env) {
	return new Promise((resolve, reject) => {
		const logStream = createWriteStream(SERVER_LOG, { flags: 'a' });
		const child = spawn(process.execPath, [ENTRY, ...args], {
			cwd: APP_DIR,
			env: { ...process.env, ...env },
			stdio: ['ignore', 'pipe', 'pipe']
		});
		child.stdout.pipe(logStream);
		child.stderr.pipe(logStream);
		child.on('error', reject);
		child.on('exit', code => resolve(code ?? 1));
	});
}

/**
 * Poll GET /readyz until it returns 200, or fail after the boot timeout.
 * /readyz is the server-level readiness probe (auth:false, no tenant scope). The tenant-scoped
 * /health endpoint is NOT used here — in multi-tenant mode it 401s without an organization param.
 */
async function waitForReady() {
	const deadline = Date.now() + cfg.bootTimeoutMs;
	const url = `${baseUrl}/readyz`;
	log('info', `Waiting for ${url} (timeout ${Math.round(cfg.bootTimeoutMs / 1000)}s)...`);

	let lastErr;
	while (Date.now() < deadline) {
		if (serverChild && serverChild.exitCode !== null) {
			throw new Error(`Server process exited (code=${serverChild.exitCode}) before becoming ready`);
		}
		try {
			const res = await fetch(url, { method: 'GET' });
			if (res.status === 200) {
				return;
			}
			lastErr = `status ${res.status}`;
		} catch (error) {
			lastErr = error?.message ?? String(error);
		}
		await sleep(1000);
	}
	throw new Error(`Node did not become ready within timeout (last: ${lastErr})`);
}

// ---------------------------------------------------------------------------
// Load (k6)
// ---------------------------------------------------------------------------

/** Spawn k6 against the running node and await its exit code (0 = pass, non-zero = breach/error). */
async function runLoad() {
	const k6 = await resolveK6();
	log('info', `Driving load: ${cfg.vus} VUs for ${cfg.duration} (k6: ${k6})`);

	const args = [
		'run',
		'--env',
		`SOAK_BASE_URL=${baseUrl}`,
		'--env',
		`SOAK_TENANT_API_KEY=${cfg.tenantApiKey}`,
		'--env',
		`SOAK_ADMIN_EMAIL=${cfg.adminEmail}`,
		'--env',
		`SOAK_ADMIN_PASSWORD=${cfg.adminPassword}`,
		'--env',
		`SOAK_TENANT_MODE=${cfg.tenantMode}`,
		'--env',
		`SOAK_DURATION=${cfg.duration}`,
		'--env',
		`SOAK_VUS=${String(cfg.vus)}`,
		'--env',
		`SOAK_P95_MS=${String(cfg.p95Ms)}`,
		'--env',
		`SOAK_P99_MS=${String(cfg.p99Ms)}`,
		'--env',
		`SOAK_ERROR_RATE=${cfg.errorRate}`,
		'--env',
		`SOAK_SUMMARY_PATH=${SUMMARY_PATH}`,
		SCENARIO
	];

	return new Promise((resolve, reject) => {
		const child = spawn(k6, args, { cwd: __dirname, stdio: ['ignore', 'inherit', 'inherit'] });
		child.on('error', reject);
		child.on('exit', code => resolve(code ?? 1));
	});
}

/** Locate the k6 binary: explicit override, then PATH, then the default Windows install path. */
async function resolveK6() {
	const candidates = [
		cfg.k6Bin,
		'k6',
		process.platform === 'win32' ? 'C:\\Program Files\\k6\\k6.exe' : undefined
	].filter(Boolean);

	for (const candidate of candidates) {
		if (await canRun(candidate)) {
			return candidate;
		}
	}
	throw new Error(
		'k6 not found. Install it (Windows: `winget install GrafanaLabs.k6`; macOS: `brew install k6`; ' +
			'see soak/README.md) or set SOAK_K6_BIN to its full path.'
	);
}

/** True if the binary runs `version` successfully. */
function canRun(bin) {
	return new Promise(resolve => {
		const child = spawn(bin, ['version'], { stdio: 'ignore' });
		child.on('error', () => resolve(false));
		child.on('exit', code => resolve(code === 0));
	});
}

/** Read and print the k6 summary the scenario exported; returns the parsed summary (or undefined). */
async function reportSummary() {
	try {
		const data = JSON.parse(await readFile(SUMMARY_PATH, 'utf8'));
		const m = data.metrics ?? {};
		const dur = m.http_req_duration?.values ?? {};
		const failed = (m.http_req_failed?.values?.rate ?? 0) * 100;
		const reqs = m.http_reqs?.values ?? {};
		log('info', '──────── soak result ────────');
		log('info', `  requests:    ${num(reqs.count)} (${num(reqs.rate, 1)}/s)`);
		log('info', `  failed:      ${num(failed, 2)}%`);
		log('info', `  p50/p95/p99: ${num(dur.med)} / ${num(dur['p(95)'])} / ${num(dur['p(99)'])} ms`);
		return data;
	} catch (error) {
		log('warn', `Could not read k6 summary (${error?.message ?? error}).`);
		return null;
	}
}

function num(n, digits = 0) {
	return typeof n === 'number' ? n.toFixed(digits) : 'n/a';
}

// ---------------------------------------------------------------------------
// Memory sampler + growth regression (phase 3)
// ---------------------------------------------------------------------------
//
// NOTE: the original plan sampled the node's own telemetry (GET /telemetry/metric/<id>).
// Verified during phase 3 that, in a standalone node, the metrics collector captures a single
// value at startup and the REST API returns only that frozen value (the recurring collector tick
// produces no further readable values). So instead we sample the node process's OS-level RSS via
// its PID — always live, independent of the node's telemetry, and RSS growth is the canonical leak
// signal. (Caveat: counts the main process; engine work in worker_threads shares this RSS, but any
// separate child processes are not included. See the node-side follow-up in the plan.)

/**
 * Sample the node process's RSS on an interval. Returns a handle whose stop() returns the
 * series: [{ t, rssBytes }] (t = ms since sampler start).
 */
function startSampler(pid) {
	const series = [];
	const startedAt = Date.now();
	let stopped = false;
	let inFlight = false; // guards against a slow sample overlapping the next interval tick

	const tick = async () => {
		if (stopped || inFlight) {
			return;
		}
		inFlight = true;
		try {
			const rssBytes = await sampleProcessRssBytes(pid);
			// Re-check `stopped`: the sample may have resolved after stop() was called.
			if (!stopped && typeof rssBytes === 'number') {
				series.push({ t: Date.now() - startedAt, rssBytes });
			}
		} finally {
			inFlight = false;
		}
	};

	tick(); // sample immediately (tick never rejects — sampleProcessRssBytes resolves undefined on error)
	const timer = setInterval(() => {
		tick();
	}, cfg.sampleIntervalMs);

	return {
		stop() {
			stopped = true;
			clearInterval(timer);
			return [...series]; // snapshot — a late in-flight tick can't mutate the caller's copy
		}
	};
}

/**
 * Read a process's committed/resident memory in bytes via the OS (cross-platform). Undefined on failure.
 * Windows uses PrivateMemorySize64 (private bytes / commit) rather than the working set — working set is
 * volatile (the OS trims resident pages, producing a sawtooth), whereas private bytes is the stable
 * leak indicator. Unix uses ps RSS.
 */
function sampleProcessRssBytes(pid) {
	const isWin = process.platform === 'win32';
	const cmd = isWin ? 'powershell' : 'ps';
	const args = isWin
		? ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).PrivateMemorySize64`]
		: ['-o', 'rss=', '-p', String(pid)];

	return new Promise(resolve => {
		const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
		let out = '';
		child.stdout.on('data', chunk => {
			out += chunk;
		});
		child.on('error', () => resolve());
		child.on('exit', () => {
			const n = Number.parseInt(out.trim(), 10);
			if (!Number.isFinite(n)) {
				resolve();
			} else {
				// Windows PrivateMemorySize64 is bytes; ps rss is KiB.
				resolve(isWin ? n : n * 1024);
			}
		});
	});
}

/**
 * Fit a least-squares slope of RSS vs time (after the warm-up discard) and convert to MB/hour.
 * Returns { verdict, slopeMbPerHr, samples, totalSamples, startMb, endMb, peakMb }.
 */
function evaluateMemory(series) {
	const usable = series.filter(s => s.t >= cfg.warmupDiscardMs && typeof s.rssBytes === 'number');
	const peakMb = series.length ? mb(Math.max(...series.map(s => s.rssBytes))) : null;

	if (usable.length < 2) {
		return {
			verdict: 'insufficient',
			slopeMbPerHr: 0,
			rawSlopeMbPerHr: 0,
			windowMs: 0,
			samples: usable.length,
			totalSamples: series.length,
			startMb: null,
			endMb: null,
			floorStartMb: null,
			floorEndMb: null,
			peakMb,
			buckets: 0,
			tailBuckets: 0
		};
	}

	const windowMs = usable[usable.length - 1].t - usable[0].t;

	// Raw least-squares over the whole post-warm-up window (reported for reference only — it is
	// contaminated by the warm-up ramp and GC sawtooth, so it is NOT used for the verdict).
	const rawSlopeMbPerHr = lsSlopeMbPerHr(usable.map(s => ({ t: s.t, v: s.rssBytes })));

	// Verdict signal: the post-GC FLOOR over the settled TAIL of the run.
	// - Bucketing + per-bucket minimum strips GC peaks (the floor = retained memory).
	// - Restricting to the tail (second half) strips the warm-up ramp.
	// - A robust Theil–Sen slope (median of pairwise slopes) is used instead of least-squares so a
	//   single noisy end-of-run bucket can't dominate the verdict (least-squares over ~4 buckets
	//   flipped a settling node between 100 and 894 MB/hr across two similar runs).
	// A true leak keeps lifting the tail floor; cache/warm-up fill plateaus it.
	const t0 = usable[0].t;
	const bucketMs = Math.min(180_000, Math.max(30_000, Math.round(windowMs / 16)));
	const floorByBucket = new Map();
	for (const s of usable) {
		const b = Math.floor((s.t - t0) / bucketMs);
		const cur = floorByBucket.get(b);
		if (cur === undefined || s.rssBytes < cur.v) {
			floorByBucket.set(b, { t: t0 + (b + 0.5) * bucketMs, v: s.rssBytes });
		}
	}
	const floors = [...floorByBucket.values()].sort((a, b) => a.t - b.t);

	const midT = t0 + windowMs / 2;
	let tail = floors.filter(f => f.t >= midT);
	if (tail.length < 4) {
		tail = floors.slice(Math.max(0, floors.length - 4)); // fall back to the last few floors
	}
	const slopeMbPerHr =
		tail.length >= 2 ? theilSenSlopeMbPerHr(tail.map(f => ({ t: f.t, v: f.v }))) : rawSlopeMbPerHr;

	// Only enforce once the window is long enough AND we have enough tail floors for a stable slope.
	let verdict;
	if (windowMs < cfg.memMinWindowMs || tail.length < 4) {
		verdict = 'informational';
	} else {
		verdict = slopeMbPerHr > cfg.memGrowthLimitMbPerHr ? 'breach' : 'pass';
	}

	return {
		verdict,
		slopeMbPerHr, // tail-floor slope — the verdict signal
		rawSlopeMbPerHr, // whole-window raw slope — reference only
		windowMs,
		samples: usable.length,
		totalSamples: series.length,
		buckets: floors.length,
		tailBuckets: tail.length,
		startMb: mb(usable[0].rssBytes),
		endMb: mb(usable[usable.length - 1].rssBytes),
		floorStartMb: mb(floors[0].v),
		floorEndMb: mb(floors[floors.length - 1].v),
		peakMb
	};
}

/** Least-squares slope of {t(ms), v(bytes)} points, expressed in MB/hour. */
function lsSlopeMbPerHr(points) {
	const n = points.length;
	if (n < 2) {
		return 0;
	}
	const sT = points.reduce((a, p) => a + p.t, 0);
	const sV = points.reduce((a, p) => a + p.v, 0);
	const sTT = points.reduce((a, p) => a + p.t * p.t, 0);
	const sTV = points.reduce((a, p) => a + p.t * p.v, 0);
	const denom = n * sTT - sT * sT;
	const slopeBytesPerMs = denom === 0 ? 0 : (n * sTV - sT * sV) / denom;
	return (slopeBytesPerMs * 3_600_000) / 1_000_000;
}

/**
 * Theil–Sen slope of {t(ms), v(bytes)} points in MB/hour: the median of all pairwise slopes.
 * Robust to outliers (tolerates a noisy end bucket that would skew a least-squares fit).
 */
function theilSenSlopeMbPerHr(points) {
	const n = points.length;
	if (n < 2) {
		return 0;
	}
	const slopes = [];
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const dt = points[j].t - points[i].t;
			if (dt > 0) {
				slopes.push((points[j].v - points[i].v) / dt);
			}
		}
	}
	if (slopes.length === 0) {
		return 0;
	}
	slopes.sort((a, b) => a - b);
	const mid = Math.floor(slopes.length / 2);
	const medianBytesPerMs = slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
	return (medianBytesPerMs * 3_600_000) / 1_000_000;
}

function reportMemory(mem) {
	if (mem.verdict === 'insufficient') {
		log(
			'info',
			`  mem growth:  insufficient samples (${mem.samples} after warm-up of ${mem.totalSamples} total) — run longer for a verdict`
		);
		log('info', `  mem peak:    ${num(mem.peakMb, 1)} MB`);
		log('info', `  full report: ${REPORT_PATH}`);
		log('info', '─────────────────────────────');
		return;
	}
	const tag =
		mem.verdict === 'informational'
			? `INFO (window ${Math.round(mem.windowMs / 1000)}s < ${Math.round(cfg.memMinWindowMs / 1000)}s min — not enforced)`
			: mem.verdict.toUpperCase();
	// Label the metric by what the OS actually reports: private bytes on Windows, RSS elsewhere.
	const metricLabel = process.platform === 'win32' ? 'priv' : 'rss';
	log(
		'info',
		`  mem (${metricLabel}):  ${num(mem.startMb, 1)} → ${num(mem.endMb, 1)} MB   floor ${num(mem.floorStartMb, 1)} → ${num(mem.floorEndMb, 1)} MB`
	);
	log(
		'info',
		`  growth:      ${num(mem.slopeMbPerHr, 1)} MB/hr [tail-floor]  (raw ${num(mem.rawSlopeMbPerHr, 1)} MB/hr, limit ${cfg.memGrowthLimitMbPerHr})  ${tag}`
	);
	log('info', `  mem peak:    ${num(mem.peakMb, 1)} MB`);
	log('info', `  full report: ${REPORT_PATH}`);
	log('info', '─────────────────────────────');
}

/** Write the combined machine-readable report (config + k6 verdict + memory series + verdict). */
async function writeReport({ k6Code, k6Summary, mem, series }) {
	const report = {
		config: {
			profile: cfg.profile,
			tenantMode: cfg.tenantMode,
			duration: cfg.duration,
			vus: cfg.vus,
			thresholds: {
				p95Ms: cfg.p95Ms,
				p99Ms: cfg.p99Ms,
				errorRate: cfg.errorRate,
				rssGrowthMbPerHr: cfg.memGrowthLimitMbPerHr
			}
		},
		k6: {
			exitCode: k6Code,
			httpReqDuration: k6Summary?.metrics?.http_req_duration?.values,
			httpReqFailed: k6Summary?.metrics?.http_req_failed?.values,
			httpReqs: k6Summary?.metrics?.http_reqs?.values
		},
		memory: mem,
		series
	};
	await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
}

function mb(bytes) {
	return typeof bytes === 'number' ? bytes / 1_000_000 : null;
}

// ---------------------------------------------------------------------------
// Teardown + signals
// ---------------------------------------------------------------------------
async function teardown() {
	if (tornDown) {
		return;
	}
	tornDown = true;

	if (serverChild && serverChild.exitCode === null) {
		log('info', 'Stopping node server...');
		await stopChild(serverChild);
	}
}

/** SIGTERM then SIGKILL fallback so a hung node never lingers. */
function stopChild(child) {
	return new Promise(resolve => {
		// Already terminated (exited or signalled) — nothing to wait for. Guards against ever
		// awaiting an 'exit' event that has already fired (which would hang).
		if (child.exitCode !== null || child.signalCode !== null) {
			resolve();
			return;
		}
		const killTimer = setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill('SIGKILL');
			}
		}, 5000);
		child.once('exit', () => {
			clearTimeout(killTimer);
			resolve();
		});
		child.kill('SIGTERM');
	});
}

function installSignalHandlers() {
	for (const sig of ['SIGINT', 'SIGTERM']) {
		process.on(sig, async () => {
			log('warn', `Received ${sig} — tearing down.`);
			await teardown();
			process.exit(130);
		});
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal KEY=VALUE .env parser (comments, blank lines, optional surrounding quotes). */
async function parseEnvFile(file) {
	let raw;
	try {
		raw = await readFile(file, 'utf8');
	} catch {
		throw new Error(`Soak profile not found: ${file}`);
	}
	const out = {};
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		const eq = trimmed.indexOf('=');
		// Skip blank lines, comments, and lines without a key=value shape.
		if (trimmed && !trimmed.startsWith('#') && eq > 0) {
			const key = trimmed.slice(0, eq).trim();
			let value = trimmed.slice(eq + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			out[key] = value;
		}
	}
	return out;
}

function int(value, fallback) {
	const n = Number.parseInt(value ?? '', 10);
	return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback) {
	if (value === undefined) {
		return fallback;
	}
	return value === 'true' || value === '1';
}

/** Parse a k6-style duration string (e.g. "120s", "2m", "1500ms") to milliseconds. */
function durationMs(value, fallback) {
	const v = value ?? fallback;
	const m = /^(\d+)(ms|s|m|h)?$/.exec(String(v).trim());
	if (!m) {
		return durationMs(fallback, '120s');
	}
	const n = Number.parseInt(m[1], 10);
	switch (m[2]) {
		case 'ms':
			return n;
		case 'm':
			return n * 60_000;
		case 'h':
			return n * 3_600_000;
		default:
			return n * 1000; // seconds
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function log(level, message) {
	const ts = new Date().toISOString();
	const line = `[soak ${ts}] ${level.toUpperCase()}: ${message}`;
	if (level === 'error') {
		process.stderr.write(`${line}\n`);
	} else {
		process.stdout.write(`${line}\n`);
	}
}
