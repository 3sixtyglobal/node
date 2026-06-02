// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Minimal console logger that mirrors the colour conventions used by the
 * Kenya bash scaffold (kenya-test.sh). Kept dependency-free so the script
 * stays runnable with a plain `npx tsx src/kenyaTest.ts` invocation.
 */

const RED = "\u001B[0;31m";
const GREEN = "\u001B[0;32m";
const YELLOW = "\u001B[1;33m";
const BLUE = "\u001B[0;34m";
const BOLD = "\u001B[1m";
const NC = "\u001B[0m";

/**
 * Log a sub-step heading.
 * @param message The message to print.
 */
export function step(message: string): void {
	console.log(`${BLUE}  -> ${message}${NC}`);
}

/**
 * Log a success line.
 * @param message The message to print.
 */
export function ok(message: string): void {
	console.log(`${GREEN}  [OK] ${message}${NC}`);
}

/**
 * Log a warning line. Does not exit.
 * @param message The message to print.
 */
export function warn(message: string): void {
	console.log(`${YELLOW}  [WARN] ${message}${NC}`);
}

/**
 * Log an informational line.
 * @param message The message to print.
 */
export function info(message: string): void {
	console.log(`${BLUE}  ${message}${NC}`);
}

/**
 * Log a failure line and throw — the orchestrator catches and exits with code 1.
 * @param message The message to print.
 * @throws Error always, carrying the message, after logging.
 */
export function fail(message: string): never {
	console.log(`${RED}  [FAIL] ${message}${NC}`);
	throw new Error(message);
}

/**
 * Print a phase banner.
 * @param number The phase number.
 * @param title The phase title.
 */
export function phase(number: number | string, title: string): void {
	console.log("");

	console.log("================================================================");

	console.log(`  ${BOLD}Phase ${number}: ${title}${NC}`);

	console.log("================================================================");

	console.log("");
}

/**
 * Print the final success banner.
 * @param message The message to print.
 */
export function done(message: string): void {
	console.log("");

	console.log(`${GREEN}================================================================${NC}`);

	console.log(`${GREEN}  ${message}${NC}`);

	console.log(`${GREEN}================================================================${NC}`);
}
