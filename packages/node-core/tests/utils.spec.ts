// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { normaliseEmail } from "../src/utils.js";

describe("utils", () => {
	test("normalises an e-mail address to trimmed lower case", () => {
		expect(normaliseEmail("  User@Example.COM ")).toBe("user@example.com");
	});
});
