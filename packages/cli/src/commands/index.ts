import type { Command } from "commander";
import { initCommand } from "./init";
import { devCommand } from "./dev";
import { pluginCommand } from "./plugin";
import { siteCommand } from "./site";
import { templateCommand } from "./template";

/**
 * Register all CLI commands with the Commander program
 */
export function registerCommands(program: Command): void {
  // Project initialization command
  initCommand(program);

  // Development server command
  devCommand(program);

  // Plugin management command
  pluginCommand(program);

  // Template management command
  templateCommand(program);

  // Static site generator command
  siteCommand(program);
}
