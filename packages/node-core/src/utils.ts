// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CLIDisplay } from "@twin.org/cli-core";
import { I18n, Is, NativeModules, type ILocaleDictionary } from "@twin.org/core";

/**
 * Initialise the locales for the application.
 * @param localesDirectory The directory containing the locales.
 * @returns A promise that resolves when the locale dictionary has been loaded.
 */
export async function initialiseLocales(localesDirectory: string): Promise<void> {
	const localesFile = path.resolve(path.join(localesDirectory, "en.json"));
	CLIDisplay.value("Locales File", localesFile);
	if (await fileExists(localesFile)) {
		const enLangContent = await readFile(localesFile, "utf8");
		I18n.addDictionary("en", JSON.parse(enLangContent) as ILocaleDictionary);
	} else {
		CLIDisplay.error(`Locales file not found: ${localesFile}`);
	}
}

/**
 * Register the native modules the framework classes prefer over their pure JavaScript fallbacks.
 * @param modules The module specifiers to register.
 * @returns A promise that resolves when registration has been attempted for every specifier.
 */
export async function initialiseNativeModules(modules: string[]): Promise<void> {
	const failures = await NativeModules.init(modules);
	for (const specifier of Object.keys(failures)) {
		CLIDisplay.warning(
			I18n.formatMessage("warn.node.nativeModuleUnavailable", {
				specifier,
				error: failures[specifier].message
			})
		);
	}
}

/**
 * Get the directory where the application is being executed.
 * @returns The execution directory.
 */
export function getExecutionDirectory(): string {
	return process.cwd();
}

/**
 * Get the directory where the script is located.
 * @param args The command line arguments.
 * @returns The directory containing the entry-point script, or the current working directory if not determinable.
 */
export function getScriptDirectory(args?: string[]): string {
	if (Is.array<string>(args) && args.length >= 2 && args[1].includes("index.js")) {
		return path.resolve(path.join(path.dirname(args[1]), ".."));
	}
	return process.cwd();
}

/**
 * Does the specified file exist.
 * @param filename The filename to check for existence.
 * @returns True if the file exists.
 */
export async function fileExists(filename: string): Promise<boolean> {
	try {
		const stats = await stat(filename);
		return stats.isFile();
	} catch {
		return false;
	}
}

/**
 * Does the specified directory exist.
 * @param directory The directory to check for existence.
 * @returns True if the directory exists.
 */
export async function directoryExists(directory: string): Promise<boolean> {
	try {
		const stats = await stat(directory);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

/**
 * Get the sub folders for the folder.
 * @param directory The directory to get the sub folders.
 * @returns The list of sub folders.
 */
export async function getSubFolders(directory: string): Promise<string[]> {
	try {
		const dir = await readdir(directory);
		const folders: string[] = [];
		for (const dirEntry of dir) {
			const fullPath = path.join(directory, dirEntry);
			const stats = await stat(fullPath);
			if (stats.isDirectory()) {
				folders.push(fullPath);
			}
		}
		return folders;
	} catch {
		return [];
	}
}

/**
 * Get the files in the directory.
 * @param directory The directory to get the files from.
 * @returns The list of files in the directory.
 */
export async function getFiles(directory: string): Promise<string[]> {
	try {
		const dir = await readdir(directory);
		const files: string[] = [];
		for (const dirEntry of dir) {
			const fullPath = path.join(directory, dirEntry);
			const stats = await stat(fullPath);
			if (stats.isFile()) {
				files.push(fullPath);
			}
		}
		return files;
	} catch {
		return [];
	}
}

/**
 * Load the text file.
 * @param filename The filename of the text file to load.
 * @returns The contents of the text file as a UTF-8 string.
 */
export async function loadTextFile(filename: string): Promise<string> {
	return readFile(filename, "utf8");
}

/**
 * Load the JSON file.
 * @param filename The filename of the JSON file to load.
 * @returns The parsed JSON content of the file.
 */
export async function loadJsonFile<T>(filename: string): Promise<T> {
	const content = await loadTextFile(filename);
	return JSON.parse(content) as T;
}
