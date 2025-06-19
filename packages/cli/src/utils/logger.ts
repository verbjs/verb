import chalk from "chalk";

/**
 * Logger utility for the CLI
 */
export class Logger {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Set verbose mode
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    console.log(chalk.blue("info"), message);
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    console.log(chalk.green("success"), message);
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    console.log(chalk.yellow("warning"), message);
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    console.error(chalk.red("error"), message);
  }

  /**
   * Log a debug message (only in verbose mode)
   */
  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray("debug"), message);
    }
  }

  /**
   * Log a message with a custom label
   */
  log(label: string, message: string, color?: chalk.ChalkFunction): void {
    const colorFn = color || chalk.white;
    console.log(colorFn(label), message);
  }

  /**
   * Log a blank line
   */
  blank(): void {
    console.log();
  }

  /**
   * Log a section header
   */
  section(title: string): void {
    this.blank();
    console.log(chalk.bold(chalk.cyan(title)));
    console.log(chalk.cyan("─".repeat(title.length)));
    this.blank();
  }
}

// Export a default instance
export default new Logger();
