// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * CI environments (e.g. GitHub Actions) set TWIN_GPG_KEY_ID for signing.
 * This variable is unknown to the engine's env-var validation, so tests
 * that go through `run()` - which merges process.env - must include it in
 * their TWIN_ENV_ALLOW_LIST to avoid a strict-mode validation failure.
 */
export const CI_ENV_VARS = process.env.CI === "true" ? "TWIN_GPG_KEY_ID" : "";
