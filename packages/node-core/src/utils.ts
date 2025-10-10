// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { execSync } from "node:child_process";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { get as httpsGet } from "node:https";
import path from "node:path";
import { CLIDisplay } from "@twin.org/cli-core";
import {
	BaseError,
	Converter,
	GeneralError,
	I18n,
	Is,
	type ILocaleDictionary
} from "@twin.org/core";
import { Sha256 } from "@twin.org/crypto";
import { ModuleHelper } from "@twin.org/modules";
import type { ICacheMetadata } from "./models/ICacheMetadata";
import type { IModuleProtocol } from "./models/IModuleProtocol";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables";
import type { IProtocolHandlerResult } from "./models/IProtocolHandlerResult";
import { ModuleProtocol } from "./models/moduleProtocol";
import { NodeFeatures } from "./models/nodeFeatures";

/**
 * Initialise the locales for the application.
 * @param localesDirectory The directory containing the locales.
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

/**
 * Parse the protocol from a module name.
 * @param moduleName The module name to parse.
 * @returns The parsed protocol information.
 */
export function parseModuleProtocol(moduleName: string): IModuleProtocol {
	const trimmed = moduleName.trim();

	if (trimmed.startsWith("npm:")) {
		return {
			protocol: ModuleProtocol.Npm,
			identifier: trimmed.slice(4),
			original: trimmed
		};
	}

	if (trimmed.startsWith("https://")) {
		return {
			protocol: ModuleProtocol.Https,
			identifier: trimmed,
			original: trimmed
		};
	}

	if (trimmed.startsWith("http://")) {
		return {
			protocol: ModuleProtocol.Http,
			identifier: trimmed,
			original: trimmed
		};
	}

	if (trimmed.startsWith("file://")) {
		return {
			protocol: ModuleProtocol.Local,
			identifier: trimmed,
			original: trimmed
		};
	}

	if (ModuleHelper.isLocalModule(trimmed)) {
		return {
			protocol: ModuleProtocol.Local,
			identifier: trimmed,
			original: trimmed
		};
	}

	return {
		protocol: ModuleProtocol.Default,
		identifier: trimmed,
		original: trimmed
	};
}

/**
 * Hash a URL to create a safe filename.
 * @param url The URL to hash.
 * @returns A hashed filename safe for the filesystem.
 */
export function hashUrl(url: string): string {
	const urlBytes = Converter.utf8ToBytes(url);
	const hashBytes = Sha256.sum256(urlBytes);
	const hash = Converter.bytesToHex(hashBytes);
	const ext = path.extname(new URL(url).pathname);
	return `${hash}${ext}`;
}

/**
 * Get the extensions cache directory.
 * @param executionDirectory The execution directory.
 * @param protocol The protocol type for subdirectory organization.
 * @param cacheDirectory The cache directory base path.
 * @returns The cache directory path.
 */
export function getExtensionsCacheDir(
	executionDirectory: string,
	protocol: ModuleProtocol,
	cacheDirectory?: string
): string {
	// Resolve to absolute path to ensure consistent behavior
	const absoluteDir = path.resolve(executionDirectory);
	const baseDir = cacheDirectory ?? ".tmp";
	return path.join(absoluteDir, baseDir, "extensions", protocol);
}

/**
 * Handle the npm: protocol by installing the package if needed.
 * @param packageName The npm package name (without npm: prefix).
 * @param executionDirectory The execution directory.
 * @param cacheDirectory The cache directory base path.
 * @returns The resolved path to the installed module.
 */
export async function handleNpmProtocol(
	packageName: string,
	executionDirectory: string,
	cacheDirectory?: string
): Promise<IProtocolHandlerResult> {
	const cacheDir = getExtensionsCacheDir(executionDirectory, ModuleProtocol.Npm, cacheDirectory);
	// Extract just the package name (without version) for the directory
	// e.g. "picocolors@1.0.0" becomes "picocolors"
	// e.g. "@scope/package@1.0.0" becomes "@scope/package"
	const lastAtIndex = packageName.lastIndexOf("@");
	const packageNameOnly = lastAtIndex > 0 ? packageName.slice(0, lastAtIndex) : packageName;
	const packageDir = path.join(cacheDir, "node_modules", packageNameOnly);
	const packageJsonPath = path.join(packageDir, "package.json");

	const exists = await fileExists(packageJsonPath);
	if (exists) {
		const mainFile = await resolvePackageEntryPoint(packageDir, packageNameOnly);
		const modulePath = path.join(packageDir, mainFile);

		return {
			resolvedPath: modulePath,
			cached: true
		};
	}

	await mkdir(cacheDir, { recursive: true });

	CLIDisplay.task(I18n.formatMessage("node.extensionNpmInstalling"), packageName);

	try {
		// Always pipe stdio to comply with env access restrictions in tests/lint
		const stdio: "pipe" | "inherit" | "ignore" = "pipe";
		execSync(`npm install ${packageName} --prefix "${cacheDir}" --no-save --no-package-lock`, {
			cwd: cacheDir,
			stdio
		});
	} catch (err) {
		throw new GeneralError(
			"node",
			"extensionNpmInstallFailed",
			{
				package: packageName
			},
			BaseError.fromError(err)
		);
	}

	const mainFile = await resolvePackageEntryPoint(packageDir, packageNameOnly);
	const modulePath = path.join(packageDir, mainFile);

	return {
		resolvedPath: modulePath,
		cached: false
	};
}

/**
 * Check if a cached file has expired based on TTL and force refresh settings.
 * @param metadataPath Path to the cache metadata file.
 * @param ttlHours Time to live in hours.
 * @param forceRefresh Whether to force refresh regardless of TTL.
 * @returns True if the cache is expired or should be refreshed.
 */
export async function isCacheExpired(
	metadataPath: string,
	ttlHours: number,
	forceRefresh: boolean
): Promise<boolean> {
	if (forceRefresh) {
		return true;
	}

	try {
		const metadata = await loadJsonFile<ICacheMetadata>(metadataPath);
		const ttlMillis = ttlHours * 60 * 60 * 1000;
		const expireTime = metadata.downloadedAt + ttlMillis;
		return Date.now() > expireTime;
	} catch {
		// If metadata doesn't exist or is corrupted, consider expired
		return true;
	}
}

/**
 * Handle the https: protocol by downloading the module if needed.
 * @param url The HTTPS URL to download from.
 * @param executionDirectory The execution directory.
 * @param maxSizeMb The maximum size in MB for the download.
 * @param cacheDirectory The cache directory base path.
 * @param ttlHours TTL in hours for cache expiration.
 * @param forceRefresh Whether to force refresh the cache.
 * @returns The resolved path to the downloaded module.
 */
export async function handleHttpsProtocol(
	url: string,
	executionDirectory: string,
	maxSizeMb: number,
	cacheDirectory?: string,
	ttlHours?: number,
	forceRefresh?: boolean
): Promise<IProtocolHandlerResult> {
	const effectiveTtlHours = ttlHours ?? 24;
	const effectiveForceRefresh = forceRefresh ?? false;
	const cacheDir = getExtensionsCacheDir(executionDirectory, ModuleProtocol.Https, cacheDirectory);
	const filename = hashUrl(url);
	const cachedPath = path.join(cacheDir, filename);
	const metadataPath = `${cachedPath}.meta`;

	const exists = await fileExists(cachedPath);
	if (exists) {
		const expired = await isCacheExpired(metadataPath, effectiveTtlHours, effectiveForceRefresh);
		if (!expired) {
			return {
				resolvedPath: cachedPath,
				cached: true
			};
		}

		if (effectiveForceRefresh) {
			CLIDisplay.warning(I18n.formatMessage("node.extensionForceRefresh", { url }));
		} else {
			CLIDisplay.task(I18n.formatMessage("node.extensionCacheExpired", { url }));
		}
	}

	CLIDisplay.warning(I18n.formatMessage("node.extensionSecurityWarning", { url }));
	CLIDisplay.task(I18n.formatMessage("node.extensionHttpsDownloading"), url);

	await mkdir(cacheDir, { recursive: true });

	const maxSizeBytes = maxSizeMb * 1024 * 1024;
	let downloadedSize = 0;
	const chunks: Buffer[] = [];

	try {
		await new Promise<void>((resolve, reject) => {
			httpsGet(url, response => {
				if (response.statusCode !== 200) {
					reject(
						new GeneralError("node", "extensionDownloadFailed", {
							url,
							status: response.statusCode ?? 0
						})
					);
					return;
				}

				response.on("data", (chunk: Buffer) => {
					downloadedSize += chunk.length;

					if (downloadedSize > maxSizeBytes) {
						response.destroy();
						reject(
							new GeneralError("node", "extensionSizeLimitExceeded", {
								size: downloadedSize,
								limit: maxSizeBytes
							})
						);
						return;
					}

					chunks.push(chunk);
				});

				response.on("end", () => {
					resolve();
				});

				response.on("error", err => {
					reject(BaseError.fromError(err));
				});
			}).on("error", err => {
				reject(BaseError.fromError(err));
			});
		});
	} catch (err) {
		throw new GeneralError(
			"node",
			"extensionDownloadFailed",
			{
				url
			},
			BaseError.fromError(err)
		);
	}

	const tempPath = `${cachedPath}.tmp`;
	await writeFile(tempPath, Buffer.concat(chunks));

	// Atomic move from temp to final location
	await rename(tempPath, cachedPath);

	// Save metadata for TTL tracking
	const metadata: ICacheMetadata = {
		downloadedAt: Date.now(),
		url,
		size: Buffer.concat(chunks).length
	};
	await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

	return {
		resolvedPath: cachedPath,
		cached: false
	};
}

/**
 * Resolve the main entry point from a package directory using Node.js resolution with fallback.
 * Uses require.resolve() when possible for standard Node.js behavior, with manual fallback.
 * @param packagePath The absolute path to the package directory.
 * @param packageName The package name for require.resolve().
 * @param fallback The fallback file name if no entry point is found.
 * @returns The resolved entry point file name (relative to package directory).
 */
export async function resolvePackageEntryPoint(
	packagePath: string,
	packageName: string,
	fallback = "index.js"
): Promise<string> {
	try {
		// Try require.resolve() first - handles exports, main, module automatically
		const resolvedPath = require.resolve(packageName, { paths: [path.dirname(packagePath)] });
		// Convert absolute path back to relative filename within package
		const relativePath = path.relative(packagePath, resolvedPath);
		return relativePath ?? fallback;
	} catch {
		// Fallback to manual package.json parsing if require.resolve fails
		try {
			const packageJsonPath = path.join(packagePath, "package.json");
			const packageJsonContent = await loadJsonFile<{
				module?: string;
				main?: string;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				exports?: any;
			}>(packageJsonPath);

			// Future: Could expand exports field support here
			return packageJsonContent.module ?? packageJsonContent.main ?? fallback;
		} catch {
			return fallback;
		}
	}
}

/**
 * Convert a file path to an import-compatible URL for cross-platform module loading.
 * On Windows, adds the 'file://' protocol prefix required for dynamic imports.
 * On other platforms, returns the path unchanged.
 * @param filePath The absolute file path to convert.
 * @returns A URL string compatible with dynamic import().
 */
export function createModuleImportUrl(filePath: string): string {
	return process.platform === "win32" ? `file://${filePath}` : filePath;
}
