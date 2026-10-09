// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@3sixty/cli-core";
import { I18n, NativeModules } from "@3sixty/core";
import { initialiseNativeModules } from "../src/utils.js";

describe("Protocol Parsing Utilities", () => {
	describe("initialiseNativeModules", () => {
		test("registers a working specifier so getModule resolves it", async () => {
			await initialiseNativeModules(["node:crypto"]);

			// eslint-disable-next-line @typescript-eslint/consistent-type-imports
			const nodeCrypto = NativeModules.getModule<typeof import("node:crypto")>("node:crypto");
			expect(nodeCrypto?.createHash).toBeTypeOf("function");
		});

		test("warns but does not throw for a specifier that fails to load", async () => {
			const warnSpy = vi.spyOn(CLIDisplay, "warning").mockImplementation(() => {});
			const formatSpy = vi.spyOn(I18n, "formatMessage");

			try {
				await initialiseNativeModules(["node:this-module-does-not-exist"]);

				expect(formatSpy).toHaveBeenCalledWith(
					"warn.node.nativeModuleUnavailable",
					expect.objectContaining({ specifier: "node:this-module-does-not-exist" })
				);
				expect(warnSpy).toHaveBeenCalledOnce();
				expect(NativeModules.getModule("node:this-module-does-not-exist")).toBeUndefined();
			} finally {
				warnSpy.mockRestore();
				formatSpy.mockRestore();
			}
		});
	});
});
