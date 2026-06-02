// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { StepDefinition } from "./stepDefinition.js";

/**
 * A named group of steps that are executed sequentially.
 */
export interface GroupDefinition {
	/**
	 * Display name for the group, shown in console output.
	 */
	group: string;

	/**
	 * Ordered list of steps to run within the group.
	 */
	steps: StepDefinition[];
}
