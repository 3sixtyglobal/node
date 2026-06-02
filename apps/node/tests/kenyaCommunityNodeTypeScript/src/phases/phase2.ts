// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IKenyaContext } from "../context.js";
import { info, ok, phase } from "../logger.js";

/**
 * Phase 2 — sanity-check the seeded state. The actual offer creation is
 * owned by provision-storage.sh; this phase just confirms the dotfile-loaded
 * context carries the seeded ids so subsequent phases don't fail confusingly
 * when an operator forgets to run provision-storage.sh.
 * @param context The scenario context.
 */
export async function runPhase2(context: IKenyaContext): Promise<void> {
	phase(2, "KRA's offer presence (provision-storage.sh seeded it)");

	info(`KRA seeded offer ${context.kraOfferId} for dataset ${context.kraDatasetId}.`);
	info("Skipping a re-seed — Phase 2 is owned by provision-storage.sh.");
	ok("Phase 2 (offer seeding) executed by provision-storage.sh");
}
