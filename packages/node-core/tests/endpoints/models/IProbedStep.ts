// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * A request a step sent, recorded so the routes it reached can be checked.
 */
export interface IProbedStep {
	/**
	 * The HTTP method.
	 */
	method: string;

	/**
	 * The path template of the step, with {{varName}} tokens and without a query string.
	 */
	path: string;

	/**
	 * The status the server replied with.
	 */
	status: number;
}
