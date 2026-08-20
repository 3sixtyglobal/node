// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Coerce, GeneralError, Is } from "@twin.org/core";
import type { IEngineEnvironmentVariables } from "../../models/IEngineEnvironmentVariables.js";

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
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The millisecond value, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: number
): number;
export function envMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined;
export function envMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: number
): number | undefined {
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
export function envCount(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: number
): number;
export function envCount(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined;
export function envCount(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: number
): number | undefined {
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
export function envInteger(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: number
): number;
export function envInteger(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined;
export function envInteger(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: number
): number | undefined {
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
export function envObject<T>(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: T
): T;
/**
 * Returns an env var as a typed object. Accepts a pre-parsed object, an inline JSON object string,
 * or a value already expanded from a @json: file reference.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @returns The parsed object, or undefined when the var is absent or the value cannot be parsed.
 */
export function envObject<T>(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): T | undefined;
export function envObject<T>(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: T
): T | undefined {
	const value: unknown = envVars[key];
	if (Is.undefined(value)) {
		return defaultValue;
	}
	return Coerce.object<T>(value) ?? defaultValue;
}

/**
 * Returns an env var as a typed array. Accepts a pre-parsed array, an inline JSON array string,
 * or a value already expanded from a @json: file reference.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent or cannot be parsed.
 * @returns The parsed array, or the default when absent or the value cannot be parsed.
 */
export function envArray<T>(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: T[]
): T[];
/**
 * Returns an env var as a typed array. Accepts a pre-parsed array, an inline JSON array string,
 * or a value already expanded from a @json: file reference.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @returns The parsed array, or undefined when the var is absent or the value cannot be parsed.
 */
export function envArray<T>(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): T[] | undefined;
export function envArray<T>(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: T[]
): T[] | undefined {
	const value: unknown = envVars[key];
	if (Is.undefined(value)) {
		return defaultValue;
	}
	return Coerce.array<T>(value) ?? defaultValue;
}

/**
 * Coerces an env var that is already in seconds to an integer.
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The second value, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envSeconds(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: number
): number;
export function envSeconds(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined;
export function envSeconds(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: number
): number | undefined {
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
export function envMinutes(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: number
): number;
export function envMinutes(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined;
export function envMinutes(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: number
): number | undefined {
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
export function envDateTime(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: string
): string;
export function envDateTime(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): string | undefined;
export function envDateTime(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
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
 * @param envVars The environment variables object.
 * @param key The property name of the env var to coerce.
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The value in milliseconds, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envSecToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: number
): number;
export function envSecToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined;
export function envSecToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: number
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
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
 * @param defaultValue The value to return when the env var is absent. Omit to return undefined when absent.
 * @returns The value in milliseconds, the default, or undefined when absent and no default given.
 * @throws GeneralError if the value is set but cannot be coerced to an integer.
 */
export function envMinToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue: number
): number;
export function envMinToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables
): number | undefined;
export function envMinToMs(
	envVars: IEngineEnvironmentVariables,
	key: keyof IEngineEnvironmentVariables,
	defaultValue?: number
): number | undefined {
	const value = envVars[key];
	if (!Is.stringValue(value)) {
		return defaultValue;
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
