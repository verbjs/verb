/**
 * Global test setup for server package
 */
import { afterAll } from "bun:test";
import { cleanupTempFiles } from "./utils/cleanup.ts";

// Ensure all temporary files are cleaned up after all tests
afterAll(async () => {
  await cleanupTempFiles();
});