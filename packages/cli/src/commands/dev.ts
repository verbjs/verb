import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import fs from "fs-extra";
import { spawn } from "node:child_process";
import chokidar from "chokidar";

interface DevOptions {
	port: number;
	host: string;
	watch: boolean;
	open: boolean;
}

/**
 * Register the dev command
 */
export function devCommand(program: Command): void {
	program
		.command("dev")
		.description("Start development server with hot reload")
		.option("-p, --port <port>", "Port to run the server on", "3000")
		.option("-h, --host <host>", "Host to run the server on", "localhost")
		.option("--no-watch", "Disable file watching")
		.option("-o, --open", "Open in browser")
		.action(async (options) => {
			const devOptions: DevOptions = {
				port: Number.parseInt(options.port, 10),
				host: options.host,
				watch: options.watch !== false,
				open: options.open || false,
			};

			await startDevServer(devOptions);
		});
}

/**
 * Start the development server
 */
async function startDevServer(options: DevOptions): Promise<void> {
	console.log(chalk.cyan("🚀 Starting development server\n"));

	// Check if we're in a Verb project
	if (!isVerbProject()) {
		console.error(chalk.red("Error: Not a Verb project"));
		console.log(
			"Run this command in a Verb project directory or create a new one with:",
		);
		console.log(chalk.gray("  vrb init my-app"));
		process.exit(1);
	}

	// Find the entry point
	const entryPoint = findEntryPoint();
	if (!entryPoint) {
		console.error(chalk.red("Error: Could not find entry point"));
		console.log("Make sure you have an index.ts file in your src directory");
		process.exit(1);
	}

	// Start the server
	const spinner = ora("Starting server").start();

	try {
		// Start the server process
		const serverProcess = startServer(entryPoint, options);

		// Set up file watching if enabled
		if (options.watch) {
			setupFileWatching(serverProcess, entryPoint, options);
		}

		spinner.succeed(
			`Server running at ${chalk.green(`http://${options.host}:${options.port}`)}`,
		);

		// Open in browser if requested
		if (options.open) {
			openInBrowser(`http://${options.host}:${options.port}`);
		}
	} catch (error) {
		spinner.fail(`Failed to start server: ${error.message}`);
		process.exit(1);
	}
}

/**
 * Check if the current directory is a Verb project
 */
function isVerbProject(): boolean {
	try {
		const packageJsonPath = path.resolve(process.cwd(), "package.json");
		if (!fs.existsSync(packageJsonPath)) {
			return false;
		}

		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

		// Check if verb is a dependency
		return packageJson.dependencies?.verb || packageJson.devDependencies?.verb;
	} catch (_error) {
		return false;
	}
}

/**
 * Find the entry point file
 */
function findEntryPoint(): string | null {
	const possibleEntryPoints = [
		"src/index.ts",
		"src/server.ts",
		"src/app.ts",
		"src/main.ts",
		"index.ts",
		"server.ts",
		"app.ts",
		"main.ts",
	];

	for (const entryPoint of possibleEntryPoints) {
		const fullPath = path.resolve(process.cwd(), entryPoint);
		if (fs.existsSync(fullPath)) {
			return fullPath;
		}
	}

	return null;
}

/**
 * Start the server process
 * @returns The child process instance
 */
function startServer(entryPoint: string, options: DevOptions): import('child_process').ChildProcess {
	// Determine the package manager
	const packageManager = getPackageManager();

	// Build the command
	let command: string;
	let args: string[];

	switch (packageManager) {
		case "npm":
			command = "npm";
			args = ["run", "dev"];
			break;
		case "yarn":
			command = "yarn";
			args = ["dev"];
			break;
		case "pnpm":
			command = "pnpm";
			args = ["dev"];
			break;
		default:
			command = "bun";
			args = ["--watch", entryPoint];
			break;
	}

	// Add port and host if using bun directly
	if (packageManager === "bun") {
		process.env.PORT = options.port.toString();
		process.env.HOST = options.host;
	}

	// Start the process
	const serverProcess = spawn(command, args, {
		stdio: "inherit",
		env: { ...process.env },
	});

	// Handle process exit
	serverProcess.on("exit", (code) => {
		if (code !== 0 && code !== null) {
			console.error(chalk.red(`Server process exited with code ${code}`));
			process.exit(code);
		}
	});

	return serverProcess;
}

/**
 * Set up file watching for hot reload
 */
function setupFileWatching(
	initialServerProcess: import('child_process').ChildProcess,
	entryPoint: string,
	options: DevOptions,
): void {
	// Watch for changes in the src directory
	const watcher = chokidar.watch(["src/**/*", "public/**/*"], {
		ignored: /(^|[/\\])\../, // Ignore dotfiles
		persistent: true,
	});

	// Debounce restart to avoid multiple restarts
	let restartTimeout: NodeJS.Timeout | null = null;
	let isRestarting = false;
	let currentServerProcess = initialServerProcess;

	const restartServer = () => {
		if (isRestarting) {
			return;
		}
		isRestarting = true;

		console.log(chalk.yellow("\nRestarting server..."));

		// Kill the current process
		currentServerProcess.kill();

		// Start a new process
		const newProcess = startServer(entryPoint, options);

		// Update the reference
		currentServerProcess = newProcess;

		isRestarting = false;
	};

	// Watch for changes
	watcher.on("change", (path) => {
		console.log(chalk.gray(`File changed: ${path}`));

		// Debounce restart
		if (restartTimeout) {
			clearTimeout(restartTimeout);
		}

		restartTimeout = setTimeout(restartServer, 500);
	});

	// Handle process exit
	process.on("SIGINT", () => {
		console.log(chalk.yellow("\nStopping server..."));
		watcher.close();
		serverProcess.kill();
		process.exit(0);
	});
}

/**
 * Get the package manager used in the project
 */
function getPackageManager(): "npm" | "yarn" | "pnpm" | "bun" {
	// Check for lockfiles
	if (fs.existsSync(path.resolve(process.cwd(), "bun.lockb"))) {
		return "bun";
	}

	if (fs.existsSync(path.resolve(process.cwd(), "yarn.lock"))) {
		return "yarn";
	}

	if (fs.existsSync(path.resolve(process.cwd(), "pnpm-lock.yaml"))) {
		return "pnpm";
	}

	// Default to npm
	return "npm";
}

/**
 * Open the URL in the default browser
 */
function openInBrowser(url: string): void {
	const { platform } = process;
	let command: string;

	switch (platform) {
		case "darwin":
			command = `open ${url}`;
			break;
		case "win32":
			command = `start ${url}`;
			break;
		default:
			command = `xdg-open ${url}`;
			break;
	}

	try {
		spawn(command, { shell: true, stdio: "ignore" });
	} catch (_error) {
		console.log(chalk.yellow(`Could not open browser. Visit ${url} manually.`));
	}
}
