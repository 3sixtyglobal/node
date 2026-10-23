// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIUtils } from "@3sixty/cli-core";
import { Converter } from "@3sixty/core";
import { readStoreRecords, setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)(
	"identity-verification-method-import in $mode mode",
	({ mode, tenantEnabled }) => {
		const context = setupCliTestContext("identity-verification-method-import", mode, tenantEnabled);

		test("imports the key for a verification method", async () => {
			const identity = await context.createIdentity("identity");
			await context.execute([
				"identity-verification-method-create",
				`--identity=${identity.did}`,
				"--verification-method-id=vm-test",
				`--output-json=${context.dir}verification-method.json`
			]);
			const json = await CLIUtils.readJsonFile<{ privateKeyHex: string }>(
				`${context.dir}verification-method.json`
			);

			await context.execute([
				"identity-verification-method-import",
				`--identity=${identity.did}`,
				"--verification-method-type=assertionMethod",
				"--verification-method-id=vm-test",
				`--private-key-hex=${json?.privateKeyHex}`
			]);

			const keys = await readStoreRecords<{ id: string; privateKey: string }>(
				context.dbDir,
				"vault-key"
			);
			const key = keys.find(k => k.id === `${identity.did}/vm-test`);
			expect(key?.privateKey).toEqual(
				Converter.bytesToBase64(Converter.hexToBytes(json?.privateKeyHex ?? ""))
			);
		});
	}
);
