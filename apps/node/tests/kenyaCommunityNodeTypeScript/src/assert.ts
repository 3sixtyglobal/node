// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { fail, ok } from "./logger.js";

/**
 * Assert that a condition is truthy. On failure, log a [FAIL] line and throw.
 * On success, log an [OK] line so the test output mirrors the bash scaffold.
 * @param condition The expression to assert.
 * @param successMessage The line printed when the assertion holds.
 * @param failureMessage The line printed when the assertion does not hold.
 */
export function assert(
	condition: unknown,
	successMessage: string,
	failureMessage: string
): asserts condition {
	if (condition) {
		ok(successMessage);
		return;
	}
	fail(failureMessage);
}

/**
 * Assert two values are strictly equal.
 * @param actual The actual value.
 * @param expected The expected value.
 * @param description Human-readable description of what is being asserted.
 */
export function assertEquals<T>(actual: T, expected: T, description: string): void {
	assert(
		actual === expected,
		`${description} → ${String(actual)}`,
		`${description}: expected ${String(expected)}, got ${String(actual)}`
	);
}

/**
 * Assert a string is non-empty.
 * @param value The value to check.
 * @param description Human-readable description of what is being asserted.
 */
export function assertNonEmpty(value: string | undefined | null, description: string): void {
	assert(
		typeof value === "string" && value.length > 0,
		description,
		`${description}: value is empty/undefined`
	);
}
