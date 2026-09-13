// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * CLI entry point: renders one soak run's report.json into a self-contained HTML page under
 * --site, and updates that site's run-history manifest (runs.json) + index.html. Invoked by
 * the soak workflow after a run completes — see apps/node/soak/README.md and the feat-262
 * implementation plan (.cursor/tasks/node/feat-262/) for the surrounding design.
 *
 * All rendering logic lives in report-renderer.mjs (pure functions, unit tested directly) —
 * this file is only argument parsing and file I/O, mirroring run-soak.mjs's relationship to
 * memory-verdict.mjs.
 *
 * Usage:
 *   node generate-report.mjs --report <report.json> --summary <summary.json> \
 *     --site <site checkout dir> --run-id <id> [--run-url <url>]
 */

/* eslint-disable unicorn/no-process-exit -- this file is a CLI entry point; exit codes are the contract */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
	buildRunEntry,
	isValidRunId,
	redactSummary,
	renderIndex,
	renderRunPage,
	updateManifest
} from './report-renderer.mjs';

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--')) {
			args[argv[i].slice(2)] = argv[i + 1];
			i++;
		}
	}
	return args;
}

async function readJson(filePath) {
	return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readManifest(sitePath) {
	try {
		return await readJson(path.join(sitePath, 'runs.json'));
	} catch {
		return [];
	}
}

function log(level, message) {
	const line = `[generate-report] ${level.toUpperCase()}: ${message}`;
	if (level === 'error') {
		process.stderr.write(`${line}\n`);
	} else {
		process.stdout.write(`${line}\n`);
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.report || !args.summary || !args.site || !args['run-id']) {
		log(
			'error',
			'Usage: node generate-report.mjs --report <report.json> --summary <summary.json> --site <site dir> --run-id <id> [--run-url <url>]'
		);
		process.exit(1);
	}

	const runId = String(args['run-id']);
	if (!isValidRunId(runId)) {
		log('error', `Invalid --run-id (must match /^[A-Za-z0-9_-]+$/): ${runId}`);
		process.exit(1);
	}

	const report = await readJson(args.report);
	const runUrl = args['run-url'] ?? null;
	const entry = buildRunEntry(report, runId, runUrl);

	const runDir = path.join(args.site, 'reports', runId);
	await mkdir(runDir, { recursive: true });
	await writeFile(path.join(runDir, 'report.html'), renderRunPage(report, entry), 'utf8');
	await writeFile(path.join(runDir, 'report.json'), await readFile(args.report, 'utf8'), 'utf8');

	const summary = await readJson(args.summary);
	await writeFile(
		path.join(runDir, 'summary.json'),
		JSON.stringify(redactSummary(summary), null, 2),
		'utf8'
	);

	const runs = updateManifest(await readManifest(args.site), entry);
	await writeFile(path.join(args.site, 'runs.json'), JSON.stringify(runs, null, 2), 'utf8');
	await writeFile(path.join(args.site, 'index.html'), renderIndex(runs), 'utf8');

	log(
		'info',
		`Generated report for run ${runId} (${entry.verdict}); ${runs.length} run(s) in index.`
	);
}

main().catch(error => {
	log('error', error?.stack ?? String(error));
	process.exit(1);
});
