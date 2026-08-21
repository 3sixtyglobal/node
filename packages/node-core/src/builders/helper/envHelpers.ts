// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Coerce, GeneralError, Is } from "@twin.org/core";
import type { IEngineEnvironmentVariables } from "../../models/IEngineEnvironmentVariables.js";
import type { IEngineServerEnvironmentVariables } from "../../models/IEngineServerEnvironmentVariables.js";

/**
 * Coerces an env var to a boolean, falling back to the supplied default when not set.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The boolean value, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to a boolean.
 */
export function envBoolean(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: boolean
): boolean;
export function envBoolean(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): boolean | undefined;
export function envBoolean(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
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
 * @returns The millisecond value, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
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
 * @returns The count, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envCount(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
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
 * @returns The integer, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envInteger(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
	}
	const result = Coerce.integer(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return result;
}

/**
 * Coerces an env var that is already in seconds to an integer.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @returns The second value, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envSeconds(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
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
 * @returns The minute value, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMinutes(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
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
 * @returns The datetime string, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to a datetime.
 */
export function envDateTime(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): string | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
	}
	const result = Coerce.dateTime(value) ?? Coerce.date(value);
	if (Is.empty(result)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "datetime" });
	}
	return result.toISOString();
}

/**
 * Coerces an env var to an integer and converts from seconds to milliseconds.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @returns The value in milliseconds, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envSecToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
	}
	const n = Coerce.integer(value);
	if (Is.empty(n)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return n * 1000;
}

/**
 * Coerces an env var to an integer and converts from minutes to milliseconds.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @returns The value in milliseconds, or undefined when not set.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMinToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return undefined;
	}
	const n = Coerce.integer(value);
	if (Is.empty(n)) {
		throw new GeneralError("node", "invalidEnvVarValue", { key, value, type: "integer" });
	}
	return n * 60_000;
}

/**
 * Converts a comma separated list to an array.
 * @param value The comma separated list.
 * @param defaultValue The default value to return when the list is empty or undefined.
 * @returns The array.
 */
export function commaSeparatedListToArray<T>(
	value: string | undefined,
	defaultValue: T[] | undefined = []
): T[] {
	if (!Is.stringValue(value)) {
		return defaultValue;
	}
	return value
		.split(",")
		.map(item => item.trim())
		.filter(item => item.length > 0) as T[];
}

/**
 * Gets named byte limits from an env var holding comma separated name=bytes pairs.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to read.
 * @returns The named byte limits, or undefined when the env var is absent or empty.
 * @throws GeneralError if an entry is not a unique name=bytes pair with an integer value.
 */
export function envByteLimits(
	envVars: IEngineServerEnvironmentVariables,
	key: keyof IEngineServerEnvironmentVariables
): { [name: string]: number } | undefined {
	const entries = commaSeparatedListToArray<string>(envVars[key], undefined);
	if (!Is.arrayValue(entries)) {
		return undefined;
	}

	const byteLimits: { [name: string]: number } = {};
	for (const entry of entries) {
		const parts = entry.split("=").map(part => part.trim());
		const bytes = Coerce.number(parts[1]);
		if (
			parts.length !== 2 ||
			!Is.stringValue(parts[0]) ||
			!Is.integer(bytes) ||
			!Is.undefined(byteLimits[parts[0]])
		) {
			throw new GeneralError("node", "invalidEnvVarPair", { key, value: entry });
		}
		byteLimits[parts[0]] = bytes;
	}

	return byteLimits;
}
