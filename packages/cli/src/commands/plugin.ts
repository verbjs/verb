import type { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import fs from "fs-extra";
import { execSync } from "node:child_process";

interface CommandOptions {
	yes?: boolean;
	[key: string]: unknown;
}

interface PluginOptions {
	name: string;
	description: string;
	author: string;
	version: string;
}

/**
 * Register the plugin command
 */
export function pluginCommand(program: Command): void {
	const plugin = program
		.command("plugin")
		.description("Plugin management commands");

	// Create a new plugin
	plugin
		.command("create")
		.description("Create a new Verb plugin")
		.argument("[name]", "Plugin name")
		.option("-y, --yes", "Skip prompts and use defaults")
		.action(async (name, options) => {
			await createPlugin(name, options);
		});

	// List installed plugins
	plugin
		.command("list")
		.description("List installed plugins")
		.action(async () => {
			await listPlugins();
		});

	// Install a plugin
	plugin
		.command("install")
		.description("Install a plugin")
		.argument("<plugin>", "Plugin name or GitHub repository")
		.option("-g, --global", "Install globally")
		.action(async (plugin, options) => {
			await installPlugin(plugin, options);
		});

	// Remove a plugin
	plugin
		.command("remove")
		.description("Remove a plugin")
		.argument("<plugin>", "Plugin name")
		.option("-g, --global", "Remove from global plugins")
		.action(async (plugin, options) => {
			await removePlugin(plugin, options);
		});
}

/**
 * Create a new plugin
 */
async function createPlugin(
	name?: string,
	options?: CommandOptions,
): Promise<void> {
	console.log(chalk.cyan("🔌 Creating a new Verb plugin\n"));

	// If no name provided or interactive mode, prompt for details
	const pluginOptions = await promptForPluginOptions(name, options);

	// Create the plugin
	await generatePlugin(pluginOptions);

	console.log(chalk.green("\n✅ Plugin created successfully!"));
	console.log("\nNext steps:");
	console.log(chalk.gray(`  cd ${pluginOptions.name}`));
	console.log(chalk.gray("  bun run dev"));
	console.log("\nTo use your plugin in a Verb project:");
	console.log(
		chalk.gray(`  bun add ${path.resolve(process.cwd(), pluginOptions.name)}`),
	);
	console.log(chalk.gray("  // In your Verb app:"));
	console.log(
		chalk.gray(
			`  import { ${toCamelCase(pluginOptions.name)} } from '${pluginOptions.name}';`,
		),
	);
	console.log(
		chalk.gray(`  app.register(${toCamelCase(pluginOptions.name)}());`),
	);
}

/**
 * Prompt for plugin options
 */
async function promptForPluginOptions(
	name?: string,
	options?: CommandOptions,
): Promise<PluginOptions> {
	// Skip prompts if --yes flag is used and name is provided
	if (options?.yes && name) {
		return {
			name: name,
			description: `A Verb plugin named ${name}`,
			author: "Anonymous",
			version: "0.1.0",
		};
	}

	const answers = await inquirer.prompt([
		{
			type: "input",
			name: "name",
			message: "Plugin name:",
			default: name || "verb-plugin",
			validate: (input) => {
				if (/^[a-z0-9-_]+$/i.test(input)) {
					return true;
				}
				return "Plugin name may only include letters, numbers, underscores and hyphens";
			},
		},
		{
			type: "input",
			name: "description",
			message: "Plugin description:",
			default: (answers: { name?: string }) =>
				`A Verb plugin named ${answers.name || name || "verb-plugin"}`,
		},
		{
			type: "input",
			name: "author",
			message: "Author:",
			default: "Anonymous",
		},
		{
			type: "input",
			name: "version",
			message: "Version:",
			default: "0.1.0",
			validate: (input) => {
				if (/^\d+\.\d+\.\d+$/.test(input)) {
					return true;
				}
				return "Version must be in semver format (e.g., 1.0.0)";
			},
		},
	]);

	return answers as PluginOptions;
}

/**
 * Generate a plugin
 */
async function generatePlugin(options: PluginOptions): Promise<void> {
	const spinner = ora("Creating plugin directory").start();

	try {
		// Create plugin directory
		const pluginDir = path.resolve(process.cwd(), options.name);

		// Check if directory exists
		if (fs.existsSync(pluginDir)) {
			spinner.fail(`Directory ${options.name} already exists`);
			const { overwrite } = await inquirer.prompt([
				{
					type: "confirm",
					name: "overwrite",
					message: "Directory already exists. Overwrite?",
					default: false,
				},
			]);

			if (!overwrite) {
				console.log(chalk.yellow("Plugin creation cancelled"));
				process.exit(0);
			}

			// Remove existing directory
			fs.removeSync(pluginDir);
		}

		// Create directory
		fs.mkdirSync(pluginDir, { recursive: true });
		spinner.succeed("Created plugin directory");

		// Create plugin files
		spinner.text = "Creating plugin files";
		spinner.start();
		await createPluginFiles(options, pluginDir);
		spinner.succeed("Created plugin files");

		// Initialize package.json
		spinner.text = "Creating package.json";
		spinner.start();
		await createPluginPackageJson(options, pluginDir);
		spinner.succeed("Created package.json");

		// Install dependencies
		spinner.text = "Installing dependencies";
		spinner.start();
		await installDependencies(pluginDir);
		spinner.succeed("Installed dependencies");
	} catch (error) {
		spinner.fail(`Failed to create plugin: ${error.message}`);
		throw error;
	}
}

/**
 * Create plugin files
 */
async function createPluginFiles(
	options: PluginOptions,
	pluginDir: string,
): Promise<void> {
	// Create src directory
	fs.mkdirSync(path.join(pluginDir, "src"), { recursive: true });
	fs.mkdirSync(path.join(pluginDir, "tests"), { recursive: true });

	// Create index.ts
	const indexContent = `export { ${toCamelCase(options.name)} } from './plugin';
`;

	fs.writeFileSync(path.join(pluginDir, "src/index.ts"), indexContent);

	// Create plugin.ts
	const pluginContent = `import { createPlugin, type Plugin, type PluginContext } from 'verb';

export interface ${toPascalCase(options.name)}Options {
  // Define your plugin options here
  enabled: boolean;
  // Add more options as needed
}

const defaultOptions: ${toPascalCase(options.name)}Options = {
  enabled: true,
  // Set default values for your options
};

/**
 * ${options.description}
 */
export function ${toCamelCase(options.name)}(options?: Partial<${toPascalCase(options.name)}Options>): Plugin {
  const mergedOptions = { ...defaultOptions, ...options };
  
  return createPlugin(
    {
      name: '${options.name}',
      version: '${options.version}',
      description: '${options.description}',
      tags: ['verb', 'plugin'],
    },
    async (context: PluginContext) => {
      if (!mergedOptions.enabled) {
        context.log('Plugin is disabled, skipping initialization');
        return;
      }
      
      // Register your plugin functionality here
      context.log('Plugin initialized successfully');
      
      // Example: Register a service
      context.registerService('${options.name}:example', () => {
        return { message: 'Hello from ${options.name} plugin!' };
      });
      
      // Example: Add middleware
      context.server.use(async (req, next) => {
        // Your middleware logic here
        return next();
      });
      
      // Example: Add routes
      context.server.get('/${options.name}/status', () => {
        return new Response(JSON.stringify({ status: 'active' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      });
    }
  );
}
`;

	fs.writeFileSync(path.join(pluginDir, "src/plugin.ts"), pluginContent);

	// Create README.md
	const readmeContent = `# ${options.name}

${options.description}

## Installation

\`\`\`bash
bun add ${options.name}
\`\`\`

## Usage

\`\`\`typescript
import { createServer } from 'verb';
import { ${toCamelCase(options.name)} } from '${options.name}';

const app = createServer();

// Register the plugin
app.register(${toCamelCase(options.name)}({
  // options
}));

// Start the server
app.listen(3000);
\`\`\`

## Options

- \`enabled\`: Enable or disable the plugin (default: \`true\`)

## API

### Services

- \`${options.name}:example\`: Example service

### Routes

- \`GET /${options.name}/status\`: Get plugin status

## License

MIT
`;

	fs.writeFileSync(path.join(pluginDir, "README.md"), readmeContent);

	// Create tsconfig.json
	const tsconfigContent = `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
`;

	fs.writeFileSync(path.join(pluginDir, "tsconfig.json"), tsconfigContent);

	// Create test file
	const testContent = `import { describe, test, expect, mock } from 'bun:test';
import { ${toCamelCase(options.name)} } from '../src/plugin';

describe('${options.name} Plugin', () => {
  test('should create a plugin instance', () => {
    const plugin = ${toCamelCase(options.name)}();
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('${options.name}');
    expect(plugin.version).toBe('${options.version}');
  });
  
  test('should respect enabled option', () => {
    const plugin = ${toCamelCase(options.name)}({ enabled: false });
    expect(plugin).toBeDefined();
    
    // Mock context
    const context = {
      log: mock(() => {}),
      registerService: mock(() => {}),
      server: {
        use: mock(() => {}),
        get: mock(() => {})
      }
    };
    
    // Initialize plugin
    plugin.initialize(context);
    
    // Should log that plugin is disabled
    expect(context.log).toHaveBeenCalledWith('Plugin is disabled, skipping initialization');
    
    // Should not register services or routes
    expect(context.registerService).not.toHaveBeenCalled();
    expect(context.server.get).not.toHaveBeenCalled();
  });
});
`;

	fs.writeFileSync(path.join(pluginDir, "tests/plugin.test.ts"), testContent);
}

/**
 * Create package.json for the plugin
 */
async function createPluginPackageJson(
	options: PluginOptions,
	pluginDir: string,
): Promise<void> {
	const packageJson = {
		name: options.name,
		version: options.version,
		description: options.description,
		author: options.author,
		license: "MIT",
		type: "module",
		main: "dist/index.js",
		types: "dist/index.d.ts",
		files: ["dist", "README.md"],
		scripts: {
			dev: "bun run --watch src/index.ts",
			build: "tsc",
			test: "bun test",
			prepublish: "bun run build",
		},
		peerDependencies: {
			verb: "*",
		},
		devDependencies: {
			typescript: "^5.0.0",
			"@types/bun": "latest",
		},
	};

	fs.writeFileSync(
		path.join(pluginDir, "package.json"),
		JSON.stringify(packageJson, null, 2),
	);
}

/**
 * Install dependencies
 */
async function installDependencies(pluginDir: string): Promise<void> {
	try {
		// Change to plugin directory
		process.chdir(pluginDir);

		// Install dependencies
		execSync("bun install", { stdio: "ignore" });
	} catch (error) {
		console.error(`Failed to install dependencies: ${error.message}`);
		console.log(chalk.yellow("You can install them manually by running:"));
		console.log(chalk.gray(`  cd ${path.basename(pluginDir)}`));
		console.log(chalk.gray("  bun install"));
	}
}

/**
 * List installed plugins
 */
async function listPlugins(): Promise<void> {
	console.log(chalk.cyan("📋 Installed Verb plugins\n"));

	const spinner = ora("Scanning for plugins").start();

	try {
		// Check if we're in a Verb project
		if (!isVerbProject()) {
			spinner.warn("Not a Verb project");
			console.log("Run this command in a Verb project directory");
			return;
		}

		// Read package.json
		const packageJsonPath = path.resolve(process.cwd(), "package.json");
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

		// Get dependencies
		const dependencies = {
			...packageJson.dependencies,
			...packageJson.devDependencies,
		};

		// Filter for Verb plugins
		const plugins = [];

		for (const [name, version] of Object.entries(dependencies)) {
			// Check if it's a Verb plugin
			if (
				name.startsWith("verb-plugin-") ||
				(name.includes("verb") && name.includes("plugin"))
			) {
				plugins.push({ name, version });
			}
		}

		spinner.succeed(`Found ${plugins.length} plugins`);

		if (plugins.length === 0) {
			console.log(chalk.yellow("No Verb plugins found"));
			console.log("Install plugins with:");
			console.log(chalk.gray("  vrb plugin install <plugin-name>"));
			return;
		}

		// Display plugins
		console.log(chalk.bold("\nInstalled plugins:"));
		for (const plugin of plugins) {
			console.log(
				`  ${chalk.green(plugin.name)} ${chalk.gray(`(${plugin.version})`)}`,
			);
		}
	} catch (error) {
		spinner.fail(`Failed to list plugins: ${error.message}`);
	}
}

/**
 * Install a plugin
 */
async function installPlugin(
	plugin: string,
	options?: CommandOptions,
): Promise<void> {
	console.log(chalk.cyan(`📦 Installing plugin: ${plugin}\n`));

	const spinner = ora("Installing plugin").start();

	try {
		// Check if we're in a Verb project (unless global)
		if (!options?.global && !isVerbProject()) {
			spinner.fail("Not a Verb project");
			console.log(
				"Run this command in a Verb project directory or use --global flag",
			);
			return;
		}

		// Determine the package name
		let packageName = plugin;

		// If it's a GitHub repository, use the full URL
		if (plugin.includes("/")) {
			if (!plugin.startsWith("http") && !plugin.startsWith("git")) {
				packageName = `github:${plugin}`;
			}
		}

		// Install the plugin
		const command = options?.global
			? `bun add -g ${packageName}`
			: `bun add ${packageName}`;

		execSync(command, { stdio: "inherit" });

		spinner.succeed(`Plugin ${plugin} installed successfully`);
	} catch (error) {
		spinner.fail(`Failed to install plugin: ${error.message}`);
	}
}

/**
 * Remove a plugin
 */
async function removePlugin(
	plugin: string,
	options?: CommandOptions,
): Promise<void> {
	console.log(chalk.cyan(`🗑️  Removing plugin: ${plugin}\n`));

	const spinner = ora("Removing plugin").start();

	try {
		// Check if we're in a Verb project (unless global)
		if (!options?.global && !isVerbProject()) {
			spinner.fail("Not a Verb project");
			console.log(
				"Run this command in a Verb project directory or use --global flag",
			);
			return;
		}

		// Remove the plugin
		const command = options?.global
			? `bun remove -g ${plugin}`
			: `bun remove ${plugin}`;

		execSync(command, { stdio: "inherit" });

		spinner.succeed(`Plugin ${plugin} removed successfully`);
	} catch (error) {
		spinner.fail(`Failed to remove plugin: ${error.message}`);
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
 * Convert a string to camelCase
 */
function toCamelCase(str: string): string {
	return str
		.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
		.replace(/^([A-Z])/, (_, c) => c.toLowerCase())
		.replace(/[^\w]/g, "");
}

/**
 * Convert a string to PascalCase
 */
function toPascalCase(str: string): string {
	const camelCase = toCamelCase(str);
	return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}
