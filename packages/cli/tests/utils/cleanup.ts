/**
 * Test cleanup utilities
 * 
 * This module provides utilities for cleaning up temporary files and resources
 * created during tests.
 */
import fs from 'fs-extra';
import path from 'path';

// Keep track of files to clean up
const tempFiles: string[] = [];
const tempDirs: string[] = [];

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
 * Register a directory for cleanup
 * @param dirPath Path to the directory that should be cleaned up
 */
export function registerTempDir(dirPath: string): void {
  const absolutePath = path.isAbsolute(dirPath) 
    ? dirPath 
    : path.resolve(process.cwd(), dirPath);
  
  if (!tempDirs.includes(absolutePath)) {
    tempDirs.push(absolutePath);
  }
}

/**
 * Create a temporary file for testing
 * @param filePath Path where the file should be created
 * @param content Content to write to the file
 * @returns The absolute path to the created file
 */
export function createTempFile(filePath: string, content: string | Buffer): string {
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);
  
  // Ensure directory exists
  const dir = path.dirname(absolutePath);
  fs.ensureDirSync(dir);
  
  fs.writeFileSync(absolutePath, content);
  registerTempFile(absolutePath);
  
  return absolutePath;
}

/**
 * Create a temporary directory for testing
 * @param dirPath Path where the directory should be created
 * @returns The absolute path to the created directory
 */
export function createTempDir(dirPath: string): string {
  const absolutePath = path.isAbsolute(dirPath) 
    ? dirPath 
    : path.resolve(process.cwd(), dirPath);
  
  fs.ensureDirSync(absolutePath);
  registerTempDir(absolutePath);
  
  return absolutePath;
}

/**
 * Clean up all registered temporary files and directories
 */
export function cleanupTempFiles(): void {
  // Clean up files first
  for (const filePath of tempFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.removeSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to clean up temporary file ${filePath}:`, error);
    }
  }
  
  // Then clean up directories
  for (const dirPath of tempDirs) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.removeSync(dirPath);
      }
    } catch (error) {
      console.error(`Failed to clean up temporary directory ${dirPath}:`, error);
    }
  }
  
  // Clear the arrays
  tempFiles.length = 0;
  tempDirs.length = 0;
}

/**
 * Run a function with automatic cleanup
 * @param fn Function to run
 * @returns Result of the function
 */
export function withCleanup<T>(fn: () => T): T {
  try {
    return fn();
  } finally {
    cleanupTempFiles();
  }
}