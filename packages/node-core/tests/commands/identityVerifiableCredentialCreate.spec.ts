// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { writeFile } from "node:fs/promises";
import { setupCliTestContext, TENANT_MODES } from "./cliTestHelper.js";

describe.each(TENANT_MODES)(
	"identity-verifiable-credential-create in $mode mode",
	({ mode, tenantEnabled }) => {
		const context = setupCliTestContext(
			"identity-verifiable-credential-create",
			mode,
			tenantEnabled
		);

		let identity = "";

		beforeAll(async () => {
			identity = (await context.createIdentity("issuer")).did;
			await context.execute([
				"identity-verification-method-create",
				`--identity=${identity}`,
				"--verification-method-id=vm-test"
			]);
		});

		test("creates a verifiable credential", async () => {
			const subjectFile = `${context.dir}subject.json`;
			await writeFile(
				subjectFile,
				JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: "Test" })
			);
			await context.execute([
				"identity-verifiable-credential-create",
				`--identity=${identity}`,
				"--verification-method-id=vm-test",
				`--subject-json=${subjectFile}`
			]);
		});

		test("throws when the subject file cannot be loaded", async () => {
			await expect(
				context.execute([
					"identity-verifiable-credential-create",
					`--identity=${identity}`,
					"--verification-method-id=vm-test",
					`--subject-json=${context.dir}missing.json`
				])
			).rejects.toThrow("subjectJsonLoadFailed");
		});
	}
);
