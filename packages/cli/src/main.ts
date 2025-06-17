#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { registerCommands } from "./commands";

// CLI version - should match the package version
const VERSION = "0.1.0";

async function main() {
  const program = new Command();

  program.name("vrb").description("Verb CLI - A toolkit for Verb framework").version(VERSION);

  // Register all commands
  registerCommands(program);

  // Add global options
  program
    .option("-v, --verbose", "Enable verbose output")
    .option("--no-color", "Disable colored output");

  // Custom help
  program.on("--help", () => {
    console.log("");
    console.log(chalk.cyan("Examples:"));
    console.log("");
    console.log(chalk.gray("  # Create a new Verb project"));
    console.log("  $ vrb init my-app");
    console.log("");
    console.log(chalk.gray("  # Generate a static site"));
    console.log("  $ vrb site generate");
    console.log("");
    console.log(chalk.gray("  # Start development server"));
    console.log("  $ vrb dev");
    console.log("");
  });

  // Handle unknown commands
  program.on("command:*", (operands) => {
    console.error(chalk.red(`Error: Unknown command '${operands[0]}'`));
    console.log("");
    console.log(chalk.cyan("Available commands:"));
    program.commands.map((cmd) => {
      console.log(`  ${chalk.green(cmd.name())}\t${cmd.description()}`);
    });
    console.log("");
    console.log(`Run ${chalk.cyan("vrb --help")} for more information.`);
    process.exit(1);
  });

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
