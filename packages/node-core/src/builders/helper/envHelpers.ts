// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Coerce, GeneralError, Is } from "@twin.org/core";

/**
 * Returns an env var as a string when it holds a non-empty value, falling back to the supplied default.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to read.
 * @param defaultValue The value to return when the env var is absent or empty. Omit to return undefined when absent.
 * @returns The string value, the default, or undefined when absent and no default given.
 */
export function envString<T>(envVars: T, key: keyof T, defaultValue: string): string;
export function envString<T>(envVars: T, key: keyof T): string | undefined;
export function envString<T>(envVars: T, key: keyof T, defaultValue?: string): string | undefined {
	const value = envVars[key];
	return Is.stringValue(value) ? value : defaultValue;
}

/**
 * Returns an env var constrained to one of the supplied choices, falling back to the supplied default.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to read.
 * @param choices The permitted values for the env var.
 * @param defaultValue The value to return when the env var is absent or empty. Omit to return undefined when absent.
 * @returns The matching choice, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but is not one of the choices.
 */
export function envChoice<T, U extends string>(
	envVars: T,
	key: keyof T,
	choices: readonly U[],
	defaultValue: U
): U;
export function envChoice<T, U extends string>(
	envVars: T,
	key: keyof T,
	choices: readonly U[]
): U | undefined;
export function envChoice<T, U extends string>(
	envVars: T,
	key: keyof T,
	choices: readonly U[],
	defaultValue?: U
): U | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	if (!choices.includes(value as U)) {
		throw new GeneralError("node", "invalidEnvVarValue", {
			key,
			value,
			type: choices.join(" | ")
		});
	}
	return value as U;
}

/**
 * Coerces an env var to a boolean, falling back to the supplied default when not set.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The boolean value, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to a boolean.
 */
export function envBoolean<T>(envVars: T, key: keyof T, defaultValue: boolean): boolean;
export function envBoolean<T>(envVars: T, key: keyof T): boolean | undefined;
export function envBoolean<T>(
	envVars: T,
	key: keyof T,
	defaultValue?: boolean
): boolean | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const result = Coerce.boolean(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "boolean" });
	}
	return result;
}

/**
 * Coerces an env var that is already in milliseconds to an integer.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The millisecond value, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMs<T>(envVars: T, key: keyof T, defaultValue: number): number;
export function envMs<T>(envVars: T, key: keyof T): number | undefined;
export function envMs<T>(envVars: T, key: keyof T, defaultValue?: number): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const result = Coerce.integer(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return result;
}

/**
 * Coerces an env var that represents an integer count or size to an integer.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The count, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envCount<T>(envVars: T, key: keyof T, defaultValue: number): number;
export function envCount<T>(envVars: T, key: keyof T): number | undefined;
export function envCount<T>(envVars: T, key: keyof T, defaultValue?: number): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const result = Coerce.integer(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return result;
}

/**
 * Coerces an env var that represents an integer to an actual integer.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The integer, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envInteger<T>(envVars: T, key: keyof T, defaultValue: number): number;
export function envInteger<T>(envVars: T, key: keyof T): number | undefined;
export function envInteger<T>(envVars: T, key: keyof T, defaultValue?: number): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const result = Coerce.integer(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return result;
}

/**
 * Returns an env var as a typed object. Accepts a pre-parsed object, an inline JSON object string,
 * or a value already expanded from a @json: file reference.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent or cannot be parsed.
 * @returns The parsed object, or the default when absent or the value cannot be parsed.
 */
export function envObject<T, U>(envVars: T, key: keyof T, defaultValue: U): U;
/**
 * Returns an env var as a typed object. Accepts a pre-parsed object, an inline JSON object string,
 * or a value already expanded from a @json: file reference.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @returns The parsed object, or undefined when the var is absent or the value cannot be parsed.
 */
export function envObject<T, U>(envVars: T, key: keyof T): U | undefined;
export function envObject<T, U>(envVars: T, key: keyof T, defaultValue?: U): U | undefined {
	const value: unknown = envVars[key];
	if (Is.undefined(value)) {
		return defaultValue;
	}
	return Coerce.object<U>(value) ?? defaultValue;
}

/**
 * Returns an env var as a typed array. Accepts a pre-parsed array, an inline JSON array string,
 * or a value already expanded from a @json: file reference.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent or cannot be parsed.
 * @returns The parsed array, or the default when absent or the value cannot be parsed.
 */
export function envArray<T, U>(envVars: T, key: keyof T, defaultValue: U[]): U[];
/**
 * Returns an env var as a typed array. Accepts a pre-parsed array, an inline JSON array string,
 * or a value already expanded from a @json: file reference.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @returns The parsed array, or undefined when the var is absent or the value cannot be parsed.
 */
export function envArray<T, U>(envVars: T, key: keyof T): U[] | undefined;
export function envArray<T, U>(envVars: T, key: keyof T, defaultValue?: U[]): U[] | undefined {
	const value: unknown = envVars[key];
	if (Is.undefined(value)) {
		return defaultValue;
	}
	return Coerce.array<U>(value) ?? defaultValue;
}

/**
 * Coerces an env var that is already in seconds to an integer.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The second value, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envSeconds<T>(envVars: T, key: keyof T, defaultValue: number): number;
export function envSeconds<T>(envVars: T, key: keyof T): number | undefined;
export function envSeconds<T>(envVars: T, key: keyof T, defaultValue?: number): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const result = Coerce.integer(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return result;
}

/**
 * Coerces an env var that is already in minutes to an integer.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The minute value, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMinutes<T>(envVars: T, key: keyof T, defaultValue: number): number;
export function envMinutes<T>(envVars: T, key: keyof T): number | undefined;
export function envMinutes<T>(envVars: T, key: keyof T, defaultValue?: number): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const result = Coerce.integer(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return result;
}

/**
 * Coerces an env var that is a datetime string, throwing when the value is set but not a valid datetime.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The datetime ISO string, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to a datetime.
 */
export function envDateTime<T>(envVars: T, key: keyof T, defaultValue: string): string;
export function envDateTime<T>(envVars: T, key: keyof T): string | undefined;
export function envDateTime<T>(
	envVars: T,
	key: keyof T,
	defaultValue?: string
): string | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const result = Coerce.dateTime(value) ?? Coerce.date(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "datetime" });
	}
	return result.toISOString();
}

/**
 * Coerces an env var to an integer and converts from seconds to milliseconds.
 * Values of zero or less are returned unchanged so sentinels such as -1 keep their meaning.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The value in milliseconds, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envSecToMs<T>(envVars: T, key: keyof T, defaultValue: number): number;
export function envSecToMs<T>(envVars: T, key: keyof T): number | undefined;
export function envSecToMs<T>(envVars: T, key: keyof T, defaultValue?: number): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const n = Coerce.integer(value);
	if (Is.empty(n)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return n <= 0 ? n : n * 1000;
}

/**
 * Coerces an env var to an integer and converts from minutes to milliseconds.
 * Values of zero or less are returned unchanged so sentinels such as -1 keep their meaning.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The value in milliseconds, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMinToMs<T>(envVars: T, key: keyof T, defaultValue: number): number;
export function envMinToMs<T>(envVars: T, key: keyof T): number | undefined;
export function envMinToMs<T>(envVars: T, key: keyof T, defaultValue?: number): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	const n = Coerce.integer(value);
	if (Is.empty(n)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return n <= 0 ? n : n * 60_000;
}

/**
 * Converts a comma separated list to an array.
 * @param envVars The environment variables object.
 * @param key The property name of the env var.
 * @param expectedValues An optional array of expected values.
 * @throws GeneralError if the list contains a value not in the expected values.
 * @returns The array, empty when the env var is absent.
 */
export function envListToArray<T, U>(envVars: T, key: keyof T, expectedValues?: U[]): U[];
/**
 * Converts a comma separated list to an array.
 * @param envVars The environment variables object.
 * @param key The property name of the env var.
 * @param expectedValues An optional array of expected values.
 * @param defaultValue The default value to return when the list is empty or undefined.
 * @throws GeneralError if the list contains a value not in the expected values.
 * @returns The array, or the default when the env var is absent.
 */
export function envListToArray<T, U>(
	envVars: T,
	key: keyof T,
	expectedValues: U[] | undefined,
	defaultValue: U[]
): U[];
/**
 * Converts a comma separated list to an array.
 * @param envVars The environment variables object.
 * @param key The property name of the env var.
 * @param expectedValues An optional array of expected values.
 * @param defaultValue The default value to return when the list is empty or undefined.
 * @throws GeneralError if the list contains a value not in the expected values.
 * @returns The array, or the default when the env var is absent, which may be undefined.
 */
export function envListToArray<T, U>(
	envVars: T,
	key: keyof T,
	expectedValues: U[] | undefined,
	defaultValue: U[] | undefined
): U[] | undefined;
export function envListToArray<T, U>(
	envVars: T,
	key: keyof T,
	expectedValues?: U[],
	defaultValue?: U[]
): U[] | undefined {
	const value = envVars[key];
	const resolvedDefaultValue = arguments.length >= 4 ? defaultValue : [];

	const values = commaSeparatedListToArray<U>(value as string | undefined, resolvedDefaultValue);

	if (values === undefined) {
		return undefined;
	}

	if (Is.arrayValue(expectedValues) && !values.every(item => expectedValues.includes(item))) {
		throw new GeneralError("node", "invalidEnvVarValue", {
			key,
			value,
			type: expectedValues.join(" | ")
		});
	}

	return values;
}

/**
 * Converts a comma separated list to an array.
 * @param value The comma separated list.
 * @returns The array, empty when the list is empty or undefined.
 */
export function commaSeparatedListToArray<U>(value: string | undefined): U[];
/**
 * Converts a comma separated list to an array.
 * @param value The comma separated list.
 * @param defaultValue The default value to return when the list is empty or undefined.
 * @returns The array, or the default when the list is empty or undefined.
 */
export function commaSeparatedListToArray<U>(
	value: string | undefined,
	defaultValue: U[] | undefined
): U[] | undefined;
export function commaSeparatedListToArray<U>(
	value: string | undefined,
	defaultValue?: U[]
): U[] | undefined {
	if (!Is.stringValue(value)) {
		if (arguments.length < 2) {
			return [];
		}
		return defaultValue;
	}
	return value
		.split(",")
		.map(item => item.trim())
		.filter(item => item.length > 0) as U[];
}

/**
 * Gets named key integer pairs from an env var holding comma separated key=integer pairs.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to read.
 * @returns The named key integer pairs, or undefined when the env var is absent or empty.
 * @throws GeneralError if an entry is not a unique name=value pair with an integer value.
 */
export function envKeyIntegerPairs<T>(
	envVars: T,
	key: keyof T
): { [key: string]: number } | undefined {
	const entries = commaSeparatedListToArray<string>(envVars[key] as string | undefined, undefined);
	if (!Is.arrayValue(entries)) {
		return undefined;
	}

	const keyValues: { [name: string]: number } = {};
	for (const entry of entries) {
		const parts = entry.split("=").map(part => part.trim());

		const keyPart = parts[0];
		const valuePart = Coerce.integer(parts[1]);
		if (
			parts.length !== 2 ||
			!Is.stringValue(keyPart) ||
			!Is.integer(valuePart) ||
			!Is.undefined(keyValues[keyPart])
		) {
			throw new GeneralError("node", "invalidEnvVarPair", { key: keyPart, value: entry });
		}
		keyValues[keyPart] = valuePart;
	}

	return keyValues;
}
