// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	commaSeparatedListToArray,
	envArray,
	envBoolean,
	envCount,
	envDateTime,
	envInteger,
	envKeyIntegerPairs,
	envMinToMs,
	envMinutes,
	envMs,
	envObject,
	envSecToMs,
	envSeconds
} from "../../../src/builders/helper/envHelpers.js";

describe("envBoolean", () => {
	test("returns defaultValue when env var is undefined", () => {
		expect(envBoolean<{ debug?: boolean }>({}, "debug", false)).toBe(false);
		expect(envBoolean<{ debug?: boolean }>({}, "debug", true)).toBe(true);
	});

	test("returns undefined when env var is absent and no default is given", () => {
		expect(envBoolean<{ debug?: boolean }>({}, "debug")).toBeUndefined();
	});

	test("returns true for 'true' string", () => {
		expect(envBoolean({ debug: "true" }, "debug", false)).toBe(true);
	});

	test("returns true for 'true' string with no default", () => {
		expect(envBoolean({ debug: "true" }, "debug")).toBe(true);
	});

	test("returns false for 'false' string", () => {
		expect(envBoolean({ debug: "false" }, "debug", true)).toBe(false);
	});

	test("returns false for 'false' string with no default", () => {
		expect(envBoolean({ debug: "false" }, "debug")).toBe(false);
	});

	test("throws GeneralError for an invalid boolean string", () => {
		expect(() => envBoolean({ debug: "notabool" }, "debug", false)).toThrow();
	});

	test("throws GeneralError for an invalid boolean string with no default", () => {
		expect(() => envBoolean({ debug: "notabool" }, "debug")).toThrow();
	});
});

describe("envMs", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envMs<{ timeout?: number }>({}, "timeout")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envMs<{ timeout?: number }>({}, "timeout", 1000)).toBe(1000);
	});

	test("returns integer value for a valid numeric string", () => {
		expect(envMs({ timeout: "5000" }, "timeout")).toBe(5000);
	});

	test("returns integer value for a valid numeric string when default given", () => {
		expect(envMs({ timeout: "5000" }, "timeout", 1000)).toBe(5000);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envMs({ timeout: "bad" }, "timeout")).toThrow();
	});
});

describe("envCount", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envCount<{ count?: string }>({}, "count")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envCount<{ count?: string }>({}, "count", 50)).toBe(50);
	});

	test("returns integer value for a valid numeric string", () => {
		expect(envCount<{ count?: string }>({ count: "100" }, "count")).toBe(100);
	});

	test("returns integer value for a valid numeric string when default given", () => {
		expect(envCount<{ count?: string }>({ count: "100" }, "count", 50)).toBe(100);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envCount<{ count?: string }>({ count: "xyz" }, "count")).toThrow();
	});
});

describe("envInteger", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envInteger<{ port?: string }>({}, "port")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envInteger<{ port?: string }>({}, "port", 5432)).toBe(5432);
	});

	test("returns integer value for a valid numeric string", () => {
		expect(envInteger({ port: "3306" }, "port")).toBe(3306);
	});

	test("returns integer value for a valid numeric string when default given", () => {
		expect(envInteger({ port: "3306" }, "port", 5432)).toBe(3306);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envInteger({ port: "not-a-port" }, "port")).toThrow();
	});
});

describe("envSeconds", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envSeconds<{ duration?: string }>({}, "duration")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envSeconds<{ duration?: string }>({}, "duration", 60)).toBe(60);
	});

	test("returns raw seconds value for a valid numeric string", () => {
		expect(envSeconds<{ duration?: string }>({ duration: "30" }, "duration")).toBe(30);
	});

	test("returns raw seconds value for a valid numeric string when default given", () => {
		expect(envSeconds<{ duration?: string }>({ duration: "30" }, "duration", 60)).toBe(30);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envSeconds<{ duration?: string }>({ duration: "thirty" }, "duration")).toThrow();
	});
});

describe("envMinutes", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envMinutes<{ interval?: string }>({}, "interval")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envMinutes<{ interval?: string }>({}, "interval", 5)).toBe(5);
	});

	test("returns raw minutes value for a valid numeric string", () => {
		expect(envMinutes<{ interval?: string }>({ interval: "15" }, "interval")).toBe(15);
	});

	test("returns raw minutes value for a valid numeric string when default given", () => {
		expect(envMinutes<{ interval?: string }>({ interval: "15" }, "interval", 5)).toBe(15);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envMinutes<{ interval?: string }>({ interval: "fifteen" }, "interval")).toThrow();
	});
});

describe("envDateTime", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envDateTime<{ dt?: string }>({}, "dt")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envDateTime<{ dt?: string }>({}, "dt", "2020-01-01T00:00:00.000Z")).toBe(
			"2020-01-01T00:00:00.000Z"
		);
	});

	test("returns the ISO string for a valid datetime input", () => {
		expect(envDateTime({ dt: "2024-01-15T10:30:00Z" }, "dt")).toBe("2024-01-15T10:30:00.000Z");
	});

	test("returns midnight UTC ISO string for a date-only input", () => {
		expect(envDateTime({ dt: "2024-01-15" }, "dt")).toBe("2024-01-15T00:00:00.000Z");
	});

	test("throws GeneralError for a non-datetime string", () => {
		expect(() => envDateTime({ dt: "not-a-date" }, "dt")).toThrow();
	});
});

describe("envSecToMs", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envSecToMs<{ secs?: string }>({}, "secs")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envSecToMs<{ secs?: string }>({}, "secs", 3000)).toBe(3000);
	});

	test("converts seconds to milliseconds", () => {
		expect(envSecToMs<{ secs?: string }>({ secs: "5" }, "secs")).toBe(5000);
	});

	test("converts seconds to milliseconds when default given", () => {
		expect(envSecToMs<{ secs?: string }>({ secs: "5" }, "secs", 3000)).toBe(5000);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envSecToMs<{ secs?: string }>({ secs: "five" }, "secs")).toThrow();
	});
});

describe("envMinToMs", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envMinToMs<{ mins?: string }>({}, "mins")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		expect(envMinToMs<{ mins?: string }>({}, "mins", 60_000)).toBe(60_000);
	});

	test("converts minutes to milliseconds", () => {
		expect(envMinToMs<{ mins?: string }>({ mins: "2" }, "mins")).toBe(120_000);
	});

	test("converts minutes to milliseconds when default given", () => {
		expect(envMinToMs<{ mins?: string }>({ mins: "2" }, "mins", 60_000)).toBe(120_000);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envMinToMs<{ mins?: string }>({ mins: "two" }, "mins")).toThrow();
	});
});

describe("envObject", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envObject<{ rules?: string }, {}>({}, "rules")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		const def = { allow: [] };
		expect(envObject<{ rules?: string }, {}>({}, "rules", def)).toBe(def);
	});

	test("returns the parsed object when the var holds a pre-parsed object", () => {
		const rules = { allow: ["read"] };
		expect(
			envObject<{ rules?: string }, {}>({ rules: rules as unknown as string }, "rules")
		).toEqual(rules);
	});

	test("parses a JSON object string", () => {
		expect(envObject<{ rules?: string }, { x: number }>({ rules: '{"x":1}' }, "rules")).toEqual({
			x: 1
		});
	});

	test("returns undefined for a non-object string when no default given", () => {
		expect(envObject<{ rules?: string }, {}>({ rules: "not-json" }, "rules")).toBeUndefined();
	});

	test("returns defaultValue for a non-object string when default given", () => {
		const def = { allow: [] };
		expect(envObject<{ rules?: string }, {}>({ rules: "not-json" }, "rules", def)).toBe(def);
	});
});

describe("envArray", () => {
	test("returns undefined when env var is absent and no default given", () => {
		expect(envArray<{ rules?: string }, {}>({}, "rules")).toBeUndefined();
	});

	test("returns defaultValue when env var is absent", () => {
		const def = [{ name: "default" }];
		expect(envArray<{ rules?: string }, {}>({}, "rules", def)).toBe(def);
	});

	test("returns the parsed array when the var holds a pre-parsed array", () => {
		const apps = [{ name: "app1" }];
		expect(envArray<{ rules?: string }, {}>({ rules: apps as unknown as string }, "rules")).toEqual(
			apps
		);
	});

	test("parses a JSON array string", () => {
		expect(envArray<{ rules?: string }, number>({ rules: "[1,2,3]" }, "rules")).toEqual([1, 2, 3]);
	});

	test("returns undefined for a non-array string when no default given", () => {
		expect(envArray<{ rules?: string }, {}>({ rules: "not-an-array" }, "rules")).toBeUndefined();
	});

	test("returns defaultValue for a non-array string when default given", () => {
		const def = [{ name: "fallback" }];
		expect(envArray<{ rules?: string }, {}>({ rules: "not-an-array" }, "rules", def)).toBe(def);
	});
});

describe("commaSeparatedListToArray", () => {
	test("returns empty array for undefined", () => {
		expect(commaSeparatedListToArray(undefined)).toEqual([]);
	});

	test("returns empty array for empty string", () => {
		expect(commaSeparatedListToArray("")).toEqual([]);
	});

	test("returns single-element array for a string with no commas", () => {
		expect(commaSeparatedListToArray("memory")).toEqual(["memory"]);
	});

	test("splits comma-separated values into an array", () => {
		expect(commaSeparatedListToArray("memory,file,dynamodb")).toEqual([
			"memory",
			"file",
			"dynamodb"
		]);
	});

	test("trims whitespace from each element", () => {
		expect(commaSeparatedListToArray("memory, file , dynamodb")).toEqual([
			"memory",
			"file",
			"dynamodb"
		]);
	});

	test("filters out blank entries from double commas", () => {
		expect(commaSeparatedListToArray("memory,,file")).toEqual(["memory", "file"]);
	});
});

describe("envKeyIntegerPairs", () => {
	test("returns undefined when the env var is not set", () => {
		expect(envKeyIntegerPairs<{ limits?: string }>({}, "limits")).toBeUndefined();
	});

	test("returns undefined when the env var is an empty string", () => {
		expect(envKeyIntegerPairs<{ limits?: string }>({ limits: "" }, "limits")).toBeUndefined();
	});

	test("parses a single key=value pair", () => {
		expect(
			envKeyIntegerPairs<{ limits?: string }>({ limits: "large=10485760" }, "limits")
		).toStrictEqual({ large: 10485760 });
	});

	test("parses multiple key=value pairs", () => {
		expect(
			envKeyIntegerPairs<{ limits?: string }>({ limits: "large=10485760,small=1048576" }, "limits")
		).toStrictEqual({ large: 10485760, small: 1048576 });
	});

	test("trims whitespace around keys and values", () => {
		expect(
			envKeyIntegerPairs({ limits: " large = 10485760 , small = 1048576 " }, "limits")
		).toStrictEqual({ large: 10485760, small: 1048576 });
	});

	test("throws GeneralError when an entry has no equals sign", () => {
		expect(() =>
			envKeyIntegerPairs<{ limits?: string }>({ limits: "noequalssign" }, "limits")
		).toThrow(expect.objectContaining({ name: "GeneralError", source: "node" }));
	});

	test("throws GeneralError when an entry has more than one equals sign", () => {
		expect(() => envKeyIntegerPairs<{ limits?: string }>({ limits: "key=1=2" }, "limits")).toThrow(
			expect.objectContaining({ name: "GeneralError", source: "node" })
		);
	});

	test("throws GeneralError when a value is not an integer", () => {
		expect(() =>
			envKeyIntegerPairs<{ limits?: string }>({ limits: "key=notanumber" }, "limits")
		).toThrow(expect.objectContaining({ name: "GeneralError", source: "node" }));
	});

	test("throws GeneralError when a key is duplicated", () => {
		expect(() =>
			envKeyIntegerPairs<{ limits?: string }>({ limits: "key=1,key=2" }, "limits")
		).toThrow(expect.objectContaining({ name: "GeneralError", source: "node" }));
	});

	test("throws GeneralError when a key is empty", () => {
		expect(() => envKeyIntegerPairs<{ limits?: string }>({ limits: "=123" }, "limits")).toThrow(
			expect.objectContaining({ name: "GeneralError", source: "node" })
		);
	});
});
