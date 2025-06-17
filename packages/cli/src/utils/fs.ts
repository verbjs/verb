import fs from "fs-extra";
import path from "node:path";
import { glob } from "glob";

/**
 * File system utilities
 */

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
	try {
		const stat = fs.statSync(filePath);
		return stat.isFile();
	} catch (_error) {
		return false;
	}
}

/**
 * Check if a directory exists
 */
export function dirExists(dirPath: string): boolean {
	try {
		const stat = fs.statSync(dirPath);
		return stat.isDirectory();
	} catch (_error) {
		return false;
	}
}

/**
 * Create a directory if it doesn't exist
 */
export function ensureDir(dirPath: string): void {
	fs.ensureDirSync(dirPath);
}

/**
 * Read a file as text
 */
export function readFile(filePath: string): string {
	return fs.readFileSync(filePath, "utf8");
}

/**
 * Write text to a file
 */
export function writeFile(filePath: string, content: string): void {
	fs.ensureDirSync(path.dirname(filePath));
	fs.writeFileSync(filePath, content);
}

/**
 * Copy a file
 */
export function copyFile(src: string, dest: string): void {
	fs.ensureDirSync(path.dirname(dest));
	fs.copyFileSync(src, dest);
}

/**
 * Copy a directory
 */
export function copyDir(src: string, dest: string): void {
	fs.ensureDirSync(dest);
	fs.copySync(src, dest);
}

/**
 * Remove a file or directory
 */
export function remove(filePath: string): void {
	fs.removeSync(filePath);
}

/**
 * Find files matching a pattern
 */
export async function findFiles(
	pattern: string,
	options?: glob.GlobOptions,
): Promise<string[]> {
	return await glob(pattern, options);
}

/**
 * Read a JSON file
 */
export function readJson<T = Record<string, unknown>>(filePath: string): T {
	return fs.readJsonSync(filePath) as T;
}

/**
 * Write a JSON file
 */
export function writeJson<T = Record<string, unknown>>(
	filePath: string,
	data: T,
	options?: fs.WriteOptions,
): void {
	fs.ensureDirSync(path.dirname(filePath));
	fs.writeJsonSync(filePath, data, { spaces: 2, ...options });
}

/**
 * Get all files in a directory recursively
 */
export function getAllFiles(
	dirPath: string,
	arrayOfFiles: string[] = [],
): string[] {
	const files = fs.readdirSync(dirPath);
	const result = [...arrayOfFiles];

	for (const file of files) {
		const filePath = path.join(dirPath, file);

		if (fs.statSync(filePath).isDirectory()) {
			const nestedFiles = getAllFiles(filePath, result);
			result.length = 0;
			result.push(...nestedFiles);
		} else {
			result.push(filePath);
		}
	}

	return result;
}

/**
 * Get relative path
 */
export function relativePath(from: string, to: string): string {
	return path.relative(from, to);
}

/**
 * Join paths
 */
export function joinPath(...paths: string[]): string {
	return path.join(...paths);
}

/**
 * Resolve path
 */
export function resolvePath(...paths: string[]): string {
	return path.resolve(...paths);
}

// Export as a namespace for backward compatibility
export const FileSystem = {
	fileExists,
	dirExists,
	ensureDir,
	readFile,
	writeFile,
	copyFile,
	copyDir,
	remove,
	findFiles,
	readJson,
	writeJson,
	getAllFiles,
	relativePath,
	joinPath,
	resolvePath,
};

export default FileSystem;
