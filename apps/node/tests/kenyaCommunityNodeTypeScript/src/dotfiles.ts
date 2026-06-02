// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The set of KEY=VALUE entries parsed from one of the kenya scaffold's dotfiles.
 */
export interface DotEnv {
	[key: string]: string;
}

/**
 * Parse a bash-style KEY=VALUE file. Quoted values, comments and blank lines
 * are tolerated; we mirror the subset of `source` behaviour the kenya scaffold
 * relies on.
 * @param contents The raw file contents.
 * @returns A map of trimmed key/value pairs.
 */
function parseDotEnv(contents: string): DotEnv {
	const out: DotEnv = {};
	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		const eq = line.indexOf("=");
		if (line.length > 0 && !line.startsWith("#") && eq > 0) {
			const key = line.slice(0, eq).trim();
			let value = line.slice(eq + 1).trim();
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

/**
 * Read and parse a single dotfile relative to the bash scaffold directory.
 * @param scaffoldDir The directory the bash scaffold lives in.
 * @param name The dotfile name (e.g. ".tenants").
 * @returns The parsed key/value entries.
 */
export async function readDotFile(scaffoldDir: string, name: string): Promise<DotEnv> {
	const full = path.join(scaffoldDir, name);
	const contents = await readFile(full, "utf8");
	return parseDotEnv(contents);
}

/**
 * Read and merge the full set of dotfiles produced by setup.sh + provision-storage.sh.
 * Missing files throw — callers should fail fast if the bash scaffold isn't ready.
 * @param scaffoldDir The directory the bash scaffold lives in.
 * @returns The merged environment.
 */
export async function readAllDotFiles(scaffoldDir: string): Promise<DotEnv> {
	const names = [
		".node-password",
		".tenants",
		".tenant-users",
		".session-tokens",
		".trust-tokens",
		".seeded-offer"
	];
	const merged: DotEnv = {};
	for (const name of names) {
		const env = await readDotFile(scaffoldDir, name);
		Object.assign(merged, env);
	}
	return merged;
}

/**
 * Retrieve a required key from a parsed dotfile env, throwing if missing.
 * @param env The parsed env.
 * @param key The key to read.
 * @returns The value.
 * @throws Error if the key is missing or empty.
 */
export function required(env: DotEnv, key: string): string {
	const value = env[key];
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`Missing required dotfile value: ${key}`);
	}
	return value;
}
