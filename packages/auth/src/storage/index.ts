import type { StorageAdapter, StorageConfig } from "../types.js";
import { SQLiteStorageAdapter } from "./sqlite.js";
import { PostgreSQLStorageAdapter } from "./postgresql.js";
import { YAMLStorageAdapter } from "./yaml.js";

export { SQLiteStorageAdapter } from "./sqlite.js";
export { PostgreSQLStorageAdapter } from "./postgresql.js";
export { YAMLStorageAdapter } from "./yaml.js";

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case "sqlite":
      return new SQLiteStorageAdapter(config);
    case "postgresql":
      return new PostgreSQLStorageAdapter(config);
    case "yaml":
      return new YAMLStorageAdapter(config);
    default:
      throw new Error(`Unsupported storage type: ${(config as any).type}`);
  }
}