// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The type for the shutdown method of an extension module.
 * This is called when the engine is shutting down.
 */
export type NodeExtensionShutdownMethod = () => Promise<void>;
