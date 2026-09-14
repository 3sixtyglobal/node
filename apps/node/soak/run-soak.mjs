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
 * See ./README.md for configuration, profiles, and env-var reference.
 */

/* eslint-disable unicorn/no-process-exit -- this file is a CLI entry point; exit codes are the contract */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { evaluateMemory, shouldExtendForDisambiguation } from './memory-verdict.mjs';
import { createRemoteMemorySampler } from './remote-memory-sampler.mjs';

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
	// When true, skips spawning a local node process and memory sampling — used when
	// SOAK_BASE_URL points to an externally-deployed node (e.g. cloud CI runs).
	skipServer: bool(process.env.SOAK_SKIP_SERVER, false),
	skipLoad: bool(process.env.SOAK_SKIP_LOAD, false),
	// Load (k6) parameters.
	// 2m used to be enough to show a real (if unenforced) memory slope on the bare default
	// invocation. Since the warm-up discard rose to 2m (see warmupDiscardMs below), a 2m run
	// leaves ~0 post-discard samples and always reads "insufficient" instead. 5m restores a
	// genuine informational reading and matches this file's own smoke-testing guidance
	// ("shorter runs (5-10m) keep storage manageable" in README.md).
	duration: process.env.SOAK_DURATION ?? '5m',
	vus: int(process.env.SOAK_VUS, 5),
	p95Ms: int(process.env.SOAK_P95_MS, 500),
	p99Ms: int(process.env.SOAK_P99_MS, 1500),
	errorRate: process.env.SOAK_ERROR_RATE ?? '0.01',
	k6Bin: process.env.SOAK_K6_BIN,
	k6WebDashboard: bool(process.env.K6_WEB_DASHBOARD, false),
	k6WebDashboardExport: process.env.K6_WEB_DASHBOARD_EXPORT,
	// Telemetry sampler (phase 3).
	sampleIntervalMs: durationMs(process.env.SOAK_SAMPLE_INTERVAL, '10s'),
	// Default informed by a 30-min baseline: a settled node's tail-floor slope sat near 100 MB/hr
	// (sampling/GC noise on a flat floor), so 150 gives headroom while still catching a real leak.
	memGrowthLimitMbPerHr: int(process.env.SOAK_MEM_GROWTH_MB_PER_HR, 150),
	// 30s was too short: with only 30s discarded, the cold-start ramp still contaminated the
	// verdict window and was a contributing factor in issue #367's flip (-933 vs +434 MB/hr on
	// identical code). 2m was validated against the real next.16 pair plus a synthetic fixture
	// matrix (flat/leak/warm-up-settling scenarios) and reliably clears the cold-start ramp
	// without eating meaningfully into a 30m+ run's usable window.
	warmupDiscardMs: durationMs(process.env.SOAK_WARMUP_DISCARD, '2m'),
	// Memory growth is only a *fatal* verdict once the settled window is long enough to distinguish a
	// leak from cold-start cache/JIT/pool warm-up. Below this, the slope is reported as informational.
	memMinWindowMs: durationMs(process.env.SOAK_MEM_MIN_WINDOW, '10m'),
	// A memory breach on an otherwise-clean k6 run gets one automatic extension before failing —
	// encodes the campaign's manual "breach -> 60m re-run" disambiguation protocol. Fires on local
	// runs, and on cloud runs only once the telemetry sampler's verdict is enforced
	// (SOAK_MEM_SOURCE=telemetry + SOAK_MEM_ENFORCE=true).
	memExtendDuration: process.env.SOAK_MEM_EXTEND_DURATION ?? '30m',
	// Memory series source for cloud runs: 'process' (default — the local PID sampler, which on
	// cloud runs degrades to the empty stub) or 'telemetry' (sample the target node's own
	// telemetry store — Option B, see .cursor/tasks/node/soak-cloud-memory/option-b-probe-plan.md).
	memSource: process.env.SOAK_MEM_SOURCE ?? 'process',
	// Per-request timeout for the telemetry-sourced memory/CPU samplers, see soak-report-04/investigation.md.
	memSamplerTimeoutMs: int(process.env.SOAK_MEM_SAMPLER_TIMEOUT_MS, 15_000),
	// While calibrating, a telemetry-sourced breach is reported but does not fail the run.
	// Set to true once the threshold is recalibrated against containerized-pod baselines.
	memEnforce: bool(process.env.SOAK_MEM_ENFORCE, false),
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

	// Captured here (not at writeReport time) so it reflects the orchestrator's actual start,
	// not just the load-phase window — useful later as the left edge of a Grafana/Datadog
	// time-range deep-link once the dashboard grows one (see feat-262 implementation plan).
	const startedIso = new Date().toISOString();

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

	if (!cfg.skipServer) {
		await startServer(nodeEnv);
	} else {
		log('info', `SOAK_SKIP_SERVER=true — targeting external node at ${baseUrl}`);
	}
	await waitForReady();

	log('info', 'Node is up and ready.');

	if (cfg.skipLoad) {
		log('info', 'SOAK_SKIP_LOAD=true — readiness only, no load driven.');
		await teardown();
		process.exit(0);
	}

	// Sample the node process's OS-level RSS while k6 drives load. When targeting an external
	// node there is no local PID to sample: with SOAK_MEM_SOURCE=telemetry the target node's own
	// telemetry store provides the series (Option B); otherwise return an empty series so
	// evaluateMemory reports verdict: 'insufficient' (non-fatal, informational).
	const usingTelemetrySampler = cfg.skipServer && cfg.memSource === 'telemetry';
	let sampler;
	if (!cfg.skipServer) {
		sampler = startSampler(serverChild.pid);
	} else if (usingTelemetrySampler) {
		log('info', 'Memory source: target node telemetry (process_memory_rss_bytes).');
		sampler = createRemoteMemorySampler({
			baseUrl,
			apiKey: cfg.tenantApiKey,
			email: cfg.adminEmail,
			password: cfg.adminPassword,
			fetchTimeoutMs: cfg.memSamplerTimeoutMs,
			log
		});
	} else {
		sampler = {
			peek() {
				return [];
			},
			stop() {
				return [];
			}
		};
	}

	// Display-only CPU sampler — telemetry-sourced cloud runs only (no local OS-level equivalent
	// exists yet). Independent of the memory sampler: its series never feeds evaluateMemory or
	// any pass/fail decision, so a failure here cannot affect the run's exit code.
	let cpuSampler;
	if (usingTelemetrySampler) {
		log('info', 'CPU source: target node telemetry (system_cpu_usage_percent), display-only.');
		cpuSampler = createRemoteMemorySampler({
			baseUrl,
			apiKey: cfg.tenantApiKey,
			email: cfg.adminEmail,
			password: cfg.adminPassword,
			metricId: 'system_cpu_usage_percent',
			valueField: 'cpuPercent',
			fetchTimeoutMs: cfg.memSamplerTimeoutMs,
			log
		});
	} else {
		cpuSampler = {
			peek() {
				return [];
			},
			stop() {
				return [];
			}
		};
	}

	const memOptions = {
		warmupDiscardMs: cfg.warmupDiscardMs,
		memMinWindowMs: cfg.memMinWindowMs,
		memGrowthLimitMbPerHr: cfg.memGrowthLimitMbPerHr
	};

	let k6Code = await runLoad();
	let mem = evaluateMemory(sampler.peek(), memOptions);

	let extended = false;
	let preExtension;
	if (
		shouldExtendForDisambiguation({
			verdict: mem.verdict,
			signals: mem.signals,
			k6Code,
			alreadyExtended: extended,
			// The extension exists to avoid failing on a disambiguable breach, so it only applies
			// where a breach can fail the run: local runs, or telemetry-sourced runs under enforcement.
			skipServer: cfg.skipServer && !(usingTelemetrySampler && cfg.memEnforce)
		})
	) {
		// Read the summary.json the first runLoad() just wrote — the second runLoad() below
		// overwrites that file (and the dashboard export), so this is the only chance to capture
		// the initial run's k6 evidence before it's gone.
		const preExtensionK6Summary = await reportSummary();
		preExtension = {
			verdict: mem.verdict,
			slopeMbPerHr: mem.slopeMbPerHr,
			rawSlopeMbPerHr: mem.rawSlopeMbPerHr,
			k6: summarizeK6(k6Code, preExtensionK6Summary)
		};
		const reason =
			mem.verdict === 'breach' ? 'breached' : 'was inconclusive (the two signals disagreed)';
		log(
			'info',
			`Memory verdict ${reason} (floor ${mem.slopeMbPerHr.toFixed(1)} MB/hr, raw ${mem.rawSlopeMbPerHr.toFixed(1)} MB/hr) but k6 passed cleanly — extending once by ${cfg.memExtendDuration} to disambiguate settling from a real leak, per the campaign's manual re-run protocol.`
		);
		extended = true;
		k6Code = await runLoad(cfg.memExtendDuration);
		mem = evaluateMemory(sampler.peek(), memOptions);
		if (mem.verdict === 'informational') {
			log(
				'warn',
				`Memory verdict is still inconclusive after the automatic extension (floor ${mem.slopeMbPerHr.toFixed(1)} MB/hr, raw ${mem.rawSlopeMbPerHr.toFixed(1)} MB/hr) — the run will pass, but this is worth a manual look.`
			);
		}
	}

	const series = sampler.stop();
	const cpuSeries = cpuSampler.stop();
	const memSamplerUnsupported = usingTelemetrySampler && (sampler.status?.().unsupported ?? false);
	const k6Summary = await reportSummary();
	reportMemory(mem, usingTelemetrySampler, memSamplerUnsupported);
	const finishedIso = new Date().toISOString();
	let memSource = 'process';
	if (usingTelemetrySampler) {
		memSource = 'telemetry';
	} else if (cfg.skipServer) {
		memSource = 'none';
	}
	await writeReport({
		k6Code,
		k6Summary,
		mem,
		series,
		cpuSeries,
		extended,
		preExtension,
		startedIso,
		finishedIso,
		memSource,
		memSamplerUnsupported
	});

	await teardown();

	const k6Failed = k6Code !== 0;
	// Telemetry-sourced verdicts are informational until the threshold is recalibrated for
	// containerized pods (SOAK_MEM_ENFORCE=true) — a breach is reported but does not fail the run.
	const memEnforced = !usingTelemetrySampler || cfg.memEnforce;
	const memFailed = mem.verdict === 'breach' && memEnforced;
	if (mem.verdict === 'breach' && !memEnforced) {
		log(
			'warn',
			`Telemetry-sourced memory breach (floor ${mem.slopeMbPerHr.toFixed(1)} MB/hr, limit ${cfg.memGrowthLimitMbPerHr}) — NOT enforced while calibrating; set SOAK_MEM_ENFORCE=true to enforce.`
		);
	}
	if (k6Failed || memFailed) {
		if (k6Failed) {
			log('error', `k6 reported a failure/threshold breach (exit ${k6Code}).`);
		}
		if (memFailed) {
			const extendedNote = extended ? ' (still breached after the automatic extension)' : '';
			log(
				'error',
				`RSS growth ${mem.slopeMbPerHr.toFixed(1)} MB/hr exceeded limit ${cfg.memGrowthLimitMbPerHr} MB/hr${extendedNote}.`
			);
		}
		process.exit(1);
	}
	if (extended && mem.verdict !== 'informational') {
		log(
			'info',
			`Soak run passed — the extension resolved the initial ${preExtension.verdict === 'breach' ? 'breach' : 'disagreement'} (was ${preExtension.verdict} at ${preExtension.slopeMbPerHr.toFixed(1)} MB/hr, settled to ${mem.verdict} at ${mem.slopeMbPerHr.toFixed(1)} MB/hr).`
		);
	} else if (extended) {
		// Still informational after the extension — already logged at 'warn' above; don't
		// re-claim "resolved" here.
		log('info', 'Soak run passed (inconclusive even after the extension — see the warning above).');
	} else {
		log('info', 'Soak run passed.');
	}
	process.exit(0);
}

// ---------------------------------------------------------------------------
// Node lifecycle
// ---------------------------------------------------------------------------

/** Build the TWIN_* env map from the selected profile + runtime/identity overrides. */
async function buildNodeEnv() {
	const profilePath = path.join(__dirname, 'config', `soak.${cfg.profile}.env`);
	const profile = await parseEnvFile(profilePath);

	// Back-fill cfg from the profile for any SOAK_* key not already set in the shell.
	// Precedence: shell env > profile file > coded default.
	applyProfileOverrides(profile);

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

/**
 * Back-fills cfg from the profile env file for any SOAK_* key the shell did not
 * explicitly set. Makes a profile .env file authoritative for threshold calibration
 * without requiring every SOAK_* var to be re-declared in the shell or workflow env.
 */
function applyProfileOverrides(profile) {
	const numKeys = [
		['SOAK_P95_MS', 'p95Ms', 500],
		['SOAK_P99_MS', 'p99Ms', 1500],
		['SOAK_MEM_GROWTH_MB_PER_HR', 'memGrowthLimitMbPerHr', 150],
		['SOAK_VUS', 'vus', 5],
		['SOAK_MEM_SAMPLER_TIMEOUT_MS', 'memSamplerTimeoutMs', 15_000]
	];
	const strKeys = [
		['SOAK_ERROR_RATE', 'errorRate'],
		['SOAK_DURATION', 'duration'],
		['SOAK_TENANT_MODE', 'tenantMode'],
		['SOAK_DISABLED_GROUPS', 'disabledGroups'],
		['SOAK_MEM_EXTEND_DURATION', 'memExtendDuration'],
		['SOAK_MEM_SOURCE', 'memSource'],
		['K6_WEB_DASHBOARD_EXPORT', 'k6WebDashboardExport']
	];
	const boolKeys = [
		['SOAK_SKIP_SERVER', 'skipServer'],
		['SOAK_SKIP_BOOTSTRAP', 'skipBootstrap'],
		['SOAK_SKIP_LOAD', 'skipLoad'],
		['SOAK_MEM_ENFORCE', 'memEnforce'],
		['K6_WEB_DASHBOARD', 'k6WebDashboard']
	];
	for (const [envKey, cfgKey, fallback] of numKeys) {
		if (process.env[envKey] === undefined && profile[envKey] !== undefined) {
			cfg[cfgKey] = int(profile[envKey], fallback);
		}
	}
	for (const [envKey, cfgKey] of strKeys) {
		if (process.env[envKey] === undefined && profile[envKey] !== undefined) {
			cfg[cfgKey] = profile[envKey];
		}
	}
	for (const [envKey, cfgKey] of boolKeys) {
		if (process.env[envKey] === undefined && profile[envKey] !== undefined) {
			cfg[cfgKey] = bool(profile[envKey], false);
		}
	}
}

/** Run the one-shot `bootstrap-legacy` command to create node identity + admin user. */
async function bootstrap(nodeEnv) {
	log('info', 'Bootstrapping node (bootstrap-dev)...');
	const bootstrapEnv = {
		...nodeEnv,
		TWIN_FEATURES: 'admin-user',
		TWIN_ADMIN_USER_NAME: cfg.adminEmail,
		TWIN_ADMIN_USER_PASSWORD: cfg.adminPassword,
		TWIN_ADMIN_USER_SCOPE: cfg.adminScope
	};

	const code = await runToCompletion(['bootstrap-dev'], bootstrapEnv);
	if (code !== 0) {
		throw new Error(`bootstrap-dev exited with code ${code} (see ${SERVER_LOG})`);
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

/**
 * Spawn k6 against the running node and await its exit code (0 = pass, non-zero = breach/error).
 * @param duration Overrides cfg.duration — used for the one automatic memory-breach extension.
 */
async function runLoad(duration = cfg.duration) {
	const k6 = await resolveK6();
	log('info', `Driving load: ${cfg.vus} VUs for ${duration} (k6: ${k6})`);

	const args = [
		'run',
		'--env',
		`SOAK_BASE_URL=${baseUrl}`,
		'--env',
		`SOAK_ADMIN_EMAIL=${cfg.adminEmail}`,
		'--env',
		`SOAK_TENANT_MODE=${cfg.tenantMode}`,
		'--env',
		`SOAK_DURATION=${duration}`,
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
		...(cfg.disabledGroups ? ['--env', `SOAK_DISABLED_GROUPS=${cfg.disabledGroups}`] : []),
		SCENARIO
	];

	// Secret-bearing vars are passed via the child environment rather than --env argv
	// so they are not visible in the host process list (ps -ef) during the run.
	const k6Env = {
		...process.env,
		K6_WEB_DASHBOARD: String(cfg.k6WebDashboard),
		K6_WEB_DASHBOARD_EXPORT: cfg.k6WebDashboardExport ?? '',
		SOAK_ADMIN_PASSWORD: cfg.adminPassword
	};
	// In local server mode the tenant API key must match TWIN_TENANT_API_KEY on the server.
	// In cloud/skip-server mode only forward it if the caller explicitly provided it — the
	// hardcoded local fallback would not match the remote node's key. A multi-tenant cloud
	// node rejects every request without x-api-key, so SOAK_TENANT_API_KEY must be supplied
	// for those targets.
	if (!cfg.skipServer || process.env.SOAK_TENANT_API_KEY !== undefined) {
		k6Env.SOAK_TENANT_API_KEY = cfg.tenantApiKey;
	}

	return new Promise((resolve, reject) => {
		const child = spawn(k6, args, {
			cwd: __dirname,
			env: k6Env,
			stdio: ['ignore', 'inherit', 'inherit']
		});
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

/** Shape a k6 exit code + parsed summary into the subset writeReport() persists. */
function summarizeK6(exitCode, summary) {
	return {
		exitCode,
		httpReqDuration: summary?.metrics?.http_req_duration?.values,
		httpReqFailed: summary?.metrics?.http_req_failed?.values,
		httpReqs: summary?.metrics?.http_reqs?.values,
		groups: summary?.groups
	};
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
//
// UPDATE (2026-08, option-B probe): the phase-3 "frozen value" finding no longer holds on nodes
// with a queryable telemetry connector — kitsune serves a periodic, load-tracking
// process_memory_rss_bytes series. Cloud runs can therefore opt in to sampling the TARGET node's
// telemetry with SOAK_MEM_SOURCE=telemetry (see remote-memory-sampler.mjs). The PID sampler below
// remains the local-run default: it stays live even when a node is too sick to answer its own API.

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
		/** Snapshot the series so far, without halting sampling — used to evaluate an interim verdict. */
		peek() {
			return [...series];
		},
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

function reportMemory(mem, usingTelemetrySampler, memSamplerUnsupported = false) {
	if (memSamplerUnsupported) {
		log(
			'info',
			'  mem growth:  not sampled — the target answered 501 on telemetry reads (its telemetry connector does not implement them); use the server metrics dashboard for memory'
		);
		log('info', `  full report: ${REPORT_PATH}`);
		log('info', '─────────────────────────────');
		return;
	}
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
	let tag;
	if (mem.verdict === 'informational' && mem.signals === null) {
		tag = `INFO (window ${Math.round(mem.windowMs / 1000)}s < ${Math.round(cfg.memMinWindowMs / 1000)}s min — not enforced)`;
	} else if (mem.verdict === 'informational') {
		tag = 'INFO (floor/raw signals disagree — inconclusive, not enforced)';
	} else {
		tag = mem.verdict.toUpperCase();
	}
	// Label the metric by its actual source: the target node's telemetry, or what the local OS
	// reports (private bytes on Windows, RSS elsewhere).
	let metricLabel;
	if (usingTelemetrySampler) {
		metricLabel = 'rss·tel';
	} else {
		metricLabel = process.platform === 'win32' ? 'priv' : 'rss';
	}
	log(
		'info',
		`  mem (${metricLabel}):  ${num(mem.startMb, 1)} → ${num(mem.endMb, 1)} MB   floor ${num(mem.floorStartMb, 1)} → ${num(mem.floorEndMb, 1)} MB`
	);
	log(
		'info',
		`  growth:      floor ${num(mem.slopeMbPerHr, 1)} MB/hr, raw ${num(mem.rawSlopeMbPerHr, 1)} MB/hr (limit ${cfg.memGrowthLimitMbPerHr}, both must exceed to breach)  ${tag}`
	);
	log('info', `  mem peak:    ${num(mem.peakMb, 1)} MB`);
	log('info', `  full report: ${REPORT_PATH}`);
	log('info', '─────────────────────────────');
}

/** Write the combined machine-readable report (config + k6 verdict + memory series + verdict). */
async function writeReport({
	k6Code,
	k6Summary,
	mem,
	series,
	cpuSeries,
	extended,
	preExtension,
	startedIso,
	finishedIso,
	memSource,
	memSamplerUnsupported = false
}) {
	const report = {
		config: {
			profile: cfg.profile,
			tenantMode: cfg.tenantMode,
			duration: cfg.duration,
			vus: cfg.vus,
			startedIso,
			finishedIso,
			memSource,
			memSamplerUnsupported,
			warmupDiscardMs: cfg.warmupDiscardMs,
			thresholds: {
				p95Ms: cfg.p95Ms,
				p99Ms: cfg.p99Ms,
				errorRate: cfg.errorRate,
				rssGrowthMbPerHr: cfg.memGrowthLimitMbPerHr
			}
		},
		k6: {
			...summarizeK6(k6Code, k6Summary),
			// Present only when the run was extended (see shouldExtendForDisambiguation) — the
			// fields above are the FINAL, post-extension k6 result; this is what the run's first
			// load phase reported before summary.json and the dashboard export were overwritten
			// by the extension's own run.
			preExtension: extended ? (preExtension?.k6 ?? null) : null
		},
		memory: {
			...mem,
			// Present only when a breach (or a genuine signal disagreement) on an otherwise-clean
			// run triggered one automatic extension (see shouldExtendForDisambiguation) — the
			// verdict/slopes below are the FINAL, post-extension ones; these record what the run
			// looked like before extending.
			extended: extended ?? false,
			preExtensionVerdict: preExtension?.verdict ?? null,
			preExtensionSlopeMbPerHr: preExtension?.slopeMbPerHr ?? null,
			preExtensionRawSlopeMbPerHr: preExtension?.rawSlopeMbPerHr ?? null
		},
		series,
		// Display-only — never evaluated for a verdict, so it's absent (not an empty array) when
		// the run didn't use the telemetry sampler, to distinguish "not collected" from "collected
		// but empty".
		cpuSeries: cpuSeries && cpuSeries.length > 0 ? cpuSeries : undefined
	};
	await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
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
