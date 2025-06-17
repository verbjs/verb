/**
 * Test cleanup utilities
 * 
 * This module provides utilities for cleaning up temporary files and resources
 * created during tests.
 */
import fs from 'node:fs';
import path from 'node:path';

// Keep track of files to clean up
const tempFiles: string[] = [];

/**
 * Register a file for cleanup
 * @param filePath Path to the file that should be cleaned up
 */
export function registerTempFile(filePath: string): void {
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);
  
  if (!tempFiles.includes(absolutePath)) {
    tempFiles.push(absolutePath);
  }
}

/**
 * Create a temporary file for testing
 * @param filePath Path where the file should be created
 * @param content Content to write to the file
 * @returns The absolute path to the created file
 */
export async function createTempFile(filePath: string, content: string | Uint8Array): Promise<string> {
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);
  
  await Bun.write(absolutePath, content);
  registerTempFile(absolutePath);
  
  return absolutePath;
}

/**
 * Clean up all registered temporary files
 */
export async function cleanupTempFiles(): Promise<void> {
  for (const filePath of tempFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to clean up temporary file ${filePath}:`, error);
    }
  }
  
  // Clear the array
  tempFiles.length = 0;
}

/**
 * Run a function with automatic cleanup
 * @param fn Function to run
 * @returns Result of the function
 */
export async function withCleanup<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    await cleanupTempFiles();
  }
}