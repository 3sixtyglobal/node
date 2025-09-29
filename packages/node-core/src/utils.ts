// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/* eslint-disable no-console */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { I18n, Is, type ILocaleDictionary } from "@twin.org/core";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables";
import { NodeFeatures } from "./models/nodeFeatures";

/**
 * Initialise the locales for the application.
 * @param localesDirectory The directory containing the locales.
 */
export async function initialiseLocales(localesDirectory: string): Promise<void> {
	const localesFile = path.resolve(path.join(localesDirectory, "en.json"));
	console.info("Locales File:", localesFile);
	if (await fileExists(localesFile)) {
		const enLangContent = await readFile(localesFile, "utf8");
		I18n.addDictionary("en", JSON.parse(enLangContent) as ILocaleDictionary);
	} else {
		console.warn(`Locales file not found: ${localesFile}`);
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
 * @returns The contents of the text file if it could not be loaded.
 */
export async function loadTextFile(filename: string): Promise<string> {
	return readFile(filename, "utf8");
}

/**
 * Load the JSON file.
 * @param filename The filename of the JSON file to load.
 * @returns The contents of the JSON file or null if it could not be loaded.
 */
export async function loadJsonFile<T>(filename: string): Promise<T> {
	const content = await loadTextFile(filename);
	return JSON.parse(content) as T;
}

/**
 * Get the features that are enabled on the node.
 * @param env The environment variables for the node.
 * @returns The features that are enabled on the node.
 */
export function getFeatures(env: INodeEnvironmentVariables): NodeFeatures[] {
	if (Is.empty(env.features)) {
		return [];
	}

	const features: NodeFeatures[] = [];
	const allFeatures = Object.values(NodeFeatures);

	const splitFeatures = env.features.split(",");
	for (const feature of splitFeatures) {
		const featureTrimmed = feature.trim() as NodeFeatures;
		if (allFeatures.includes(featureTrimmed)) {
			features.push(featureTrimmed);
		}
	}

	return features;
}
