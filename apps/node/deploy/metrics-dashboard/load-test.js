// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.PORT ?? '4000';
const HOST = `http://localhost:${PORT}`;
const BURSTS = Number(process.env.BURSTS ?? 20);
const BETWEEN_MS = Number(process.env.BETWEEN_MS ?? 1000);
const TIMEOUT_MS = 8000;

const smallBody = JSON.stringify({ mimeType: 'application/json', data: 'x'.repeat(100) });
const largeBody = JSON.stringify({ mimeType: 'application/json', data: 'x'.repeat(170_000) });

async function req(method, path, body) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(`${HOST}${path}`, {
			method,
			headers: body ? { 'Content-Type': 'application/json' } : undefined,
			body,
			signal: ctrl.signal
		});
		return String(res.status);
	} catch {
		return 'ERR';
	} finally {
		clearTimeout(t);
	}
}

for (let burst = 1; burst <= BURSTS; burst++) {
	const results = await Promise.all([
		...Array.from({ length: 3 }, () => req('POST', '/data-processing/convert', smallBody)),
		...Array.from({ length: 3 }, () => req('POST', '/data-processing/convert', largeBody)),
		...Array.from({ length: 6 }, () => req('GET', '/telemetry/metric')),
		req('GET', '/aig'),
		req('GET', '/ais')
	]);
	// eslint-disable-next-line no-console
	console.log(`Burst ${burst.toString().padStart(2, '0')}: ${results.join(' ')}`);
	await sleep(BETWEEN_MS);
}
