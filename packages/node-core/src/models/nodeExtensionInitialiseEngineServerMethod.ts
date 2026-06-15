// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineCore, IEngineServer } from "@twin.org/engine-models";

/**
 * The type for the initialise engine server method of an extension module.
 * This is called when the engine server has been constructed but not yet started.
 * @param engineCore The engine core instance.
 * @param engineServer The engine server instance.
 * @returns A promise that resolves when the extension engine-server initialisation is complete.
 */
export type NodeExtensionInitialiseEngineServerMethod = (
	engineCore: IEngineCore,
	engineServer: IEngineServer
) => Promise<void>;
