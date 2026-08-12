// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	commaSeparatedListToArray,
	envBoolean,
	envCount,
	envDateTime,
	envInteger,
	envMinToMs,
	envMinutes,
	envMs,
	envSecToMs,
	envSeconds
} from "../../../src/builders/helper/envHelpers.js";

describe("envBoolean", () => {
	test("returns defaultValue when env var is undefined", () => {
		expect(envBoolean({}, "debug", false)).toBe(false);
		expect(envBoolean({}, "debug", true)).toBe(true);
	});

	test("returns undefined when env var is absent and no default is given", () => {
		expect(envBoolean({}, "debug")).toBeUndefined();
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
	test("returns undefined when env var is undefined", () => {
		expect(envMs({}, "entityStorageMutexTimeout")).toBeUndefined();
	});

	test("returns integer value for a valid numeric string", () => {
		expect(envMs({ entityStorageMutexTimeout: "5000" }, "entityStorageMutexTimeout")).toBe(5000);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() =>
			envMs({ entityStorageMutexTimeout: "bad" }, "entityStorageMutexTimeout")
		).toThrow();
	});
});

describe("envCount", () => {
	test("returns undefined when env var is undefined", () => {
		expect(envCount({}, "loggingBatchSize")).toBeUndefined();
	});

	test("returns integer value for a valid numeric string", () => {
		expect(envCount({ loggingBatchSize: "100" }, "loggingBatchSize")).toBe(100);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envCount({ loggingBatchSize: "xyz" }, "loggingBatchSize")).toThrow();
	});
});

describe("envInteger", () => {
	test("returns undefined when env var is undefined", () => {
		expect(envInteger({}, "mySqlPort")).toBeUndefined();
	});

	test("returns integer value for a valid numeric string", () => {
		expect(envInteger({ mySqlPort: "3306" }, "mySqlPort")).toBe(3306);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() => envInteger({ mySqlPort: "not-a-port" }, "mySqlPort")).toThrow();
	});
});

describe("envSeconds", () => {
	test("returns undefined when env var is undefined", () => {
		expect(envSeconds({}, "iotaGasReservationDuration")).toBeUndefined();
	});

	test("returns raw seconds value for a valid numeric string", () => {
		expect(envSeconds({ iotaGasReservationDuration: "30" }, "iotaGasReservationDuration")).toBe(30);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() =>
			envSeconds({ iotaGasReservationDuration: "thirty" }, "iotaGasReservationDuration")
		).toThrow();
	});
});

describe("envMinutes", () => {
	test("returns undefined when env var is undefined", () => {
		expect(envMinutes({}, "immutableProofSweepInterval")).toBeUndefined();
	});

	test("returns raw minutes value for a valid numeric string", () => {
		expect(envMinutes({ immutableProofSweepInterval: "15" }, "immutableProofSweepInterval")).toBe(
			15
		);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() =>
			envMinutes({ immutableProofSweepInterval: "fifteen" }, "immutableProofSweepInterval")
		).toThrow();
	});
});

describe("envDateTime", () => {
	test("returns undefined when env var is undefined", () => {
		expect(envDateTime({}, "immutableProofSweepAssumeRetryableBefore")).toBeUndefined();
	});

	test("returns the ISO string for a valid datetime input", () => {
		expect(
			envDateTime(
				{ immutableProofSweepAssumeRetryableBefore: "2024-01-15T10:30:00Z" },
				"immutableProofSweepAssumeRetryableBefore"
			)
		).toBe("2024-01-15T10:30:00.000Z");
	});

	test("returns midnight UTC ISO string for a date-only input", () => {
		expect(
			envDateTime(
				{ immutableProofSweepAssumeRetryableBefore: "2024-01-15" },
				"immutableProofSweepAssumeRetryableBefore"
			)
		).toBe("2024-01-15T00:00:00.000Z");
	});

	test("throws GeneralError for a non-datetime string", () => {
		expect(() =>
			envDateTime(
				{ immutableProofSweepAssumeRetryableBefore: "not-a-date" },
				"immutableProofSweepAssumeRetryableBefore"
			)
		).toThrow();
	});
});

describe("envSecToMs", () => {
	test("returns undefined when env var is undefined", () => {
		expect(envSecToMs({}, "loggingBatchFlushInterval")).toBeUndefined();
	});

	test("converts seconds to milliseconds", () => {
		expect(envSecToMs({ loggingBatchFlushInterval: "5" }, "loggingBatchFlushInterval")).toBe(5000);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() =>
			envSecToMs({ loggingBatchFlushInterval: "five" }, "loggingBatchFlushInterval")
		).toThrow();
	});
});

describe("envMinToMs", () => {
	test("returns undefined when env var is undefined", () => {
		expect(envMinToMs({}, "loggingRetentionInterval")).toBeUndefined();
	});

	test("converts minutes to milliseconds", () => {
		expect(envMinToMs({ loggingRetentionInterval: "2" }, "loggingRetentionInterval")).toBe(120_000);
	});

	test("throws GeneralError for a non-numeric string", () => {
		expect(() =>
			envMinToMs({ loggingRetentionInterval: "two" }, "loggingRetentionInterval")
		).toThrow();
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
