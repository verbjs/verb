import type { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import fs from "fs-extra";
import { execSync } from "node:child_process";

interface CommandOptions {
	yes?: boolean;
	template?: "basic" | "api" | "fullstack";
	packageManager?: "bun" | "npm" | "yarn" | "pnpm";
	[key: string]: unknown;
}

interface ProjectOptions {
	name: string;
	description: string;
	template: "basic" | "api" | "fullstack";
	packageManager: "bun" | "npm" | "yarn" | "pnpm";
	features: string[];
}

/**
 * Register the init command
 */
export function initCommand(program: Command): void {
	program
		.command("init")
		.description("Initialize a new Verb project")
		.argument("[name]", "Project name")
		.option(
			"-t, --template <template>",
			"Project template (basic, api, fullstack, static)",
			"basic",
		)
		.option("-y, --yes", "Skip prompts and use defaults")
		.option(
			"--package-manager <manager>",
			"Package manager to use (bun, npm, yarn, pnpm)",
			"bun",
		)
		.action(async (name, options) => {
			console.log(chalk.cyan("🚀 Creating a new Verb project\n"));

			// If no name provided or interactive mode, prompt for details
			const projectOptions = await promptForOptions(name, options);

			// Create the project
			await createProject(projectOptions);

			console.log(chalk.green("\n✅ Project created successfully!"));
			console.log("\nNext steps:");
			console.log(chalk.gray(`  cd ${projectOptions.name}`));
			console.log(chalk.gray(`  ${projectOptions.packageManager} run dev`));
			console.log("\nHappy coding! 🎉");
		});
}

/**
 * Prompt for project options if not provided
 */
async function promptForOptions(
	name?: string,
	options?: CommandOptions,
): Promise<ProjectOptions> {
	// Skip prompts if --yes flag is used and name is provided
	if (options?.yes && name) {
		return {
			name,
			description: `A Verb project named ${name}`,
			template: options.template || "basic",
			packageManager: options.packageManager || "bun",
			features: ["routing", "static-files"],
		};
	}

	const answers = await inquirer.prompt([
		{
			type: "input",
			name: "name",
			message: "Project name:",
			default: name || "verb-app",
			validate: (input) => {
				if (/^[a-z0-9-_]+$/i.test(input)) {
					return true;
				}
				return "Project name may only include letters, numbers, underscores and hyphens";
			},
		},
		{
			type: "input",
			name: "description",
			message: "Project description:",
			default: (answers: { name?: string }) =>
				`A Verb project named ${answers.name || name || "verb-app"}`,
		},
		{
			type: "list",
			name: "template",
			message: "Select a project template:",
			default: options?.template || "basic",
			choices: [
				{ name: "Basic (Minimal setup)", value: "basic" },
				{ name: "API (REST API focused)", value: "api" },
				{ name: "Full-stack (API + React frontend)", value: "fullstack" },
				{ name: "Static (Static site generator)", value: "static" },
			],
		},
		{
			type: "list",
			name: "packageManager",
			message: "Select a package manager:",
			default: options?.packageManager || "bun",
			choices: [
				{ name: "Bun", value: "bun" },
				{ name: "npm", value: "npm" },
				{ name: "Yarn", value: "yarn" },
				{ name: "pnpm", value: "pnpm" },
			],
		},
		{
			type: "checkbox",
			name: "features",
			message: "Select additional features:",
			choices: [
				{
					name: "TypeScript configuration",
					value: "typescript",
					checked: true,
				},
				{ name: "ESLint + Prettier", value: "linting" },
				{ name: "Testing setup", value: "testing" },
				{ name: "HTTP/2 support", value: "http2" },
				{ name: "React integration", value: "react" },
				{ name: "Schema validation", value: "validation" },
				{ name: "Session management", value: "sessions" },
				{ name: "Rate limiting", value: "rate-limiting" },
				{ name: "Compression", value: "compression" },
				{ name: "Static file serving", value: "static-files" },
			],
		},
	]);

	return answers as ProjectOptions;
}

/**
 * Create a new project with the given options
 */
async function createProject(options: ProjectOptions): Promise<void> {
	const spinner = ora("Creating project directory").start();

	try {
		// Create project directory
		const projectDir = path.resolve(process.cwd(), options.name);

		// Check if directory exists
		if (fs.existsSync(projectDir)) {
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
				console.log(chalk.yellow("Project creation cancelled"));
				process.exit(0);
			}

			// Remove existing directory
			fs.removeSync(projectDir);
		}

		// Create directory
		fs.mkdirSync(projectDir, { recursive: true });
		spinner.succeed("Created project directory");

		// Copy template files
		spinner.text = "Copying template files";
		spinner.start();
		await copyTemplateFiles(options, projectDir);
		spinner.succeed("Copied template files");

		// Initialize package.json
		spinner.text = "Creating package.json";
		spinner.start();
		await createPackageJson(options, projectDir);
		spinner.succeed("Created package.json");

		// Install dependencies
		spinner.text = "Installing dependencies";
		spinner.start();
		await installDependencies(options, projectDir);
		spinner.succeed("Installed dependencies");

		// Create additional files based on selected features
		spinner.text = "Setting up project features";
		spinner.start();
		await setupFeatures(options, projectDir);
		spinner.succeed("Set up project features");
	} catch (error) {
		spinner.fail(`Failed to create project: ${error.message}`);
		throw error;
	}
}

/**
 * Copy template files to the project directory
 */
async function copyTemplateFiles(
	options: ProjectOptions,
	projectDir: string,
): Promise<void> {
	// Template directory path
	const _templateDir = path.resolve(
		__dirname,
		"../../templates",
		options.template,
	);

	// For now, we'll create basic files directly
	// In a real implementation, you would copy from template directories

	// Create src directory
	fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });

	// Create a basic index.ts file
	const indexContent = `import { createServer } from "verb";

const app = createServer({ port: 3000 });

app.get("/", () => new Response("Hello from Verb!"));

console.log("Server running at http://localhost:3000");
`;

	fs.writeFileSync(path.join(projectDir, "src/index.ts"), indexContent);

	// Create README.md
	const readmeContent = `# ${options.name}

${options.description}

## Getting Started

\`\`\`bash
# Install dependencies
${options.packageManager} install

# Start development server
${options.packageManager} run dev

# Build for production
${options.packageManager} run build
\`\`\`

## Project Structure

\`\`\`
${options.name}/
├── src/           # Source code
├── public/        # Static assets
├── package.json   # Project configuration
└── README.md      # This file
\`\`\`
`;

	fs.writeFileSync(path.join(projectDir, "README.md"), readmeContent);

	// Create public directory for static files
	fs.mkdirSync(path.join(projectDir, "public"), { recursive: true });

	// Create a simple HTML file for static serving
	const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.name}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #333; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Welcome to ${options.name}</h1>
  <p>This is a Verb project created with the vrb CLI.</p>
  <p><a href="/api">Check the API</a></p>
</body>
</html>`;

	fs.writeFileSync(path.join(projectDir, "public/index.html"), htmlContent);
}

/**
 * Create package.json file
 */
async function createPackageJson(
	options: ProjectOptions,
	projectDir: string,
): Promise<void> {
	const packageJson = {
		name: options.name,
		version: "0.1.0",
		description: options.description,
		type: "module",
		scripts: {
			dev: "bun run --watch src/index.ts",
			start: "bun run src/index.ts",
			build: "bun build src/index.ts --outdir dist",
			test: options.features.includes("testing")
				? "bun test"
				: 'echo "No tests configured"',
		},
		dependencies: {
			verb: "github:wess/verb",
		},
		devDependencies: {
			"@types/bun": "latest",
			typescript: "^5.0.0",
		},
	};

	fs.writeFileSync(
		path.join(projectDir, "package.json"),
		JSON.stringify(packageJson, null, 2),
	);
}

/**
 * Install dependencies
 */
async function installDependencies(
	options: ProjectOptions,
	projectDir: string,
): Promise<void> {
	try {
		// Change to project directory
		process.chdir(projectDir);

		// Install dependencies
		const command = getInstallCommand(options.packageManager);
		execSync(command, { stdio: "ignore" });
	} catch (error) {
		console.error(`Failed to install dependencies: ${error.message}`);
		console.log(chalk.yellow("You can install them manually by running:"));
		console.log(chalk.gray(`  cd ${options.name}`));
		console.log(chalk.gray(`  ${options.packageManager} install`));
	}
}

/**
 * Get the install command for the selected package manager
 */
function getInstallCommand(packageManager: string): string {
	switch (packageManager) {
		case "npm":
			return "npm install";
		case "yarn":
			return "yarn";
		case "pnpm":
			return "pnpm install";
		default:
			return "bun install";
	}
}

/**
 * Set up additional features based on user selection
 */
async function setupFeatures(
	options: ProjectOptions,
	projectDir: string,
): Promise<void> {
	// TypeScript configuration
	if (options.features.includes("typescript")) {
		const tsConfig = {
			compilerOptions: {
				target: "ESNext",
				module: "ESNext",
				moduleResolution: "node",
				esModuleInterop: true,
				strict: true,
				skipLibCheck: true,
				outDir: "dist",
				rootDir: "src",
			},
			include: ["src/**/*"],
			exclude: ["node_modules", "dist"],
		};

		fs.writeFileSync(
			path.join(projectDir, "tsconfig.json"),
			JSON.stringify(tsConfig, null, 2),
		);
	}

	// ESLint + Prettier
	if (options.features.includes("linting")) {
		// Add dev dependencies to package.json
		const packageJsonPath = path.join(projectDir, "package.json");
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

		packageJson.devDependencies = {
			...packageJson.devDependencies,
			eslint: "^8.0.0",
			prettier: "^3.0.0",
		};

		fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

		// Create .eslintrc.json
		const eslintConfig = {
			env: {
				node: true,
				es2022: true,
			},
			extends: ["eslint:recommended"],
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			rules: {},
		};

		fs.writeFileSync(
			path.join(projectDir, ".eslintrc.json"),
			JSON.stringify(eslintConfig, null, 2),
		);

		// Create .prettierrc
		const prettierConfig = {
			semi: true,
			singleQuote: true,
			printWidth: 100,
			tabWidth: 2,
			trailingComma: "es5",
		};

		fs.writeFileSync(
			path.join(projectDir, ".prettierrc"),
			JSON.stringify(prettierConfig, null, 2),
		);
	}

	// Testing setup
	if (options.features.includes("testing")) {
		// Create tests directory
		fs.mkdirSync(path.join(projectDir, "tests"), { recursive: true });

		// Create a sample test file
		const testContent = `import { describe, test, expect } from "bun:test";
import { createServer } from "verb";

describe("Server", () => {
  test("should create a server instance", () => {
    const app = createServer();
    expect(app).toBeDefined();
  });
  
  test("should handle GET requests", async () => {
    const app = createServer();
    app.get("/test", () => new Response("test"));
    
    const response = await app.request.get("/test");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("test");
  });
});
`;

		fs.writeFileSync(
			path.join(projectDir, "tests/server.test.ts"),
			testContent,
		);
	}

	// Create specific files for each template
	switch (options.template) {
		case "api":
			createApiTemplate(projectDir);
			break;
		case "fullstack":
			createFullstackTemplate(projectDir);
			break;
		case "static":
			createStaticTemplate(projectDir);
			break;
		default:
			// Basic template is already created
			break;
	}
}

/**
 * Create API template specific files
 */
function createApiTemplate(projectDir: string): void {
	// Create routes directory
	fs.mkdirSync(path.join(projectDir, "src/routes"), { recursive: true });

	// Create a sample API route
	const usersRouteContent = `import { json, error } from "verb";

// In-memory store (use a real database in production)
const users = new Map();
let nextId = 1;

export function registerUserRoutes(app) {
  // List users
  app.get("/api/users", () => {
    return json(Array.from(users.values()));
  });
  
  // Get user by ID
  app.get("/api/users/:id", (req, params) => {
    const user = users.get(parseInt(params.id));
    if (!user) return error("User not found", 404);
    return json(user);
  });
  
  // Create user
  app.post("/api/users", async (req) => {
    const body = await req.json();
    const user = { id: nextId++, ...body };
    users.set(user.id, user);
    return json(user, 201);
  });
  
  // Update user
  app.put("/api/users/:id", async (req, params) => {
    const id = parseInt(params.id);
    if (!users.has(id)) return error("User not found", 404);
    
    const body = await req.json();
    const user = { id, ...body };
    users.set(id, user);
    return json(user);
  });
  
  // Delete user
  app.delete("/api/users/:id", (req, params) => {
    const id = parseInt(params.id);
    if (!users.delete(id)) return error("User not found", 404);
    return new Response(null, { status: 204 });
  });
}
`;

	fs.writeFileSync(
		path.join(projectDir, "src/routes/users.ts"),
		usersRouteContent,
	);

	// Update the main index.ts file
	const indexContent = `import { createServer, json } from "verb";
import { registerUserRoutes } from "./routes/users.ts";

const app = createServer({ port: 3000 });

// Register routes
registerUserRoutes(app);

// Root endpoint
app.get("/", () => json({ 
  message: "Welcome to the API",
  endpoints: [
    { method: "GET", path: "/api/users" },
    { method: "GET", path: "/api/users/:id" },
    { method: "POST", path: "/api/users" },
    { method: "PUT", path: "/api/users/:id" },
    { method: "DELETE", path: "/api/users/:id" }
  ]
}));

console.log("API server running at http://localhost:3000");
`;

	fs.writeFileSync(path.join(projectDir, "src/index.ts"), indexContent);
}

/**
 * Create Fullstack template specific files
 */
function createFullstackTemplate(projectDir: string): void {
	// Create client directory for React frontend
	fs.mkdirSync(path.join(projectDir, "src/client"), { recursive: true });

	// Create server directory for backend
	fs.mkdirSync(path.join(projectDir, "src/server"), { recursive: true });

	// Create a sample React component
	const appComponentContent = `import React from 'react';

export function App() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching users:', err);
        setLoading(false);
      });
  }, []);
  
  return (
    <div>
      <h1>Users</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {users.length === 0 ? (
            <p>No users found</p>
          ) : (
            users.map(user => (
              <li key={user.id}>
                {user.name} ({user.email})
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
`;

	fs.writeFileSync(
		path.join(projectDir, "src/client/App.tsx"),
		appComponentContent,
	);

	// Create server index file
	const serverIndexContent = `import { createServer, json, error } from "verb";
import { createReactRendererPlugin } from "verb/plugins/react";

const app = createServer({ port: 3000 });

// Register React renderer plugin
app.register(createReactRendererPlugin());

// In-memory store (use a real database in production)
const users = new Map();
let nextId = 1;

// API routes
app.get("/api/users", () => {
  return json(Array.from(users.values()));
});

app.get("/api/users/:id", (req, params) => {
  const user = users.get(parseInt(params.id));
  if (!user) return error("User not found", 404);
  return json(user);
});

app.post("/api/users", async (req) => {
  const body = await req.json();
  const user = { id: nextId++, ...body };
  users.set(user.id, user);
  return json(user, 201);
});

// Serve React app
app.get("/*", async (req) => {
  // In a real app, you would use the React renderer plugin
  // This is a simplified example
  return new Response(
    \`<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fullstack Verb App</title>
    </head>
    <body>
      <div id="root">Loading...</div>
      <script src="/static/client.js"></script>
    </body>
    </html>\`,
    { headers: { "Content-Type": "text/html" } }
  );
});

console.log("Fullstack server running at http://localhost:3000");
`;

	fs.writeFileSync(
		path.join(projectDir, "src/server/index.ts"),
		serverIndexContent,
	);

	// Update the main index.ts file
	const indexContent = `// Entry point for the fullstack application
import "./server/index.ts";
`;

	fs.writeFileSync(path.join(projectDir, "src/index.ts"), indexContent);

	// Update package.json to include React dependencies
	const packageJsonPath = path.join(projectDir, "package.json");
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

	packageJson.dependencies = {
		...packageJson.dependencies,
		react: "^18.2.0",
		"react-dom": "^18.2.0",
	};

	packageJson.devDependencies = {
		...packageJson.devDependencies,
		"@types/react": "^18.2.0",
		"@types/react-dom": "^18.2.0",
	};

	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

/**
 * Create Static template specific files
 */
function createStaticTemplate(projectDir: string): void {
	// Create content directory for markdown files
	fs.mkdirSync(path.join(projectDir, "content"), { recursive: true });

	// Create layouts directory for templates
	fs.mkdirSync(path.join(projectDir, "layouts"), { recursive: true });

	// Create a sample markdown file
	const indexMarkdownContent = `---
title: Welcome to My Static Site
description: A static site built with Verb
---

# Welcome to My Static Site

This is a static site built with Verb's static site generator.

## Features

- Fast build times
- Markdown support
- Code syntax highlighting
- Responsive design
`;

	fs.writeFileSync(
		path.join(projectDir, "content/index.md"),
		indexMarkdownContent,
	);

	// Create another sample page
	const aboutMarkdownContent = `---
title: About
description: About this static site
---

# About

This is a static site built with Verb's static site generator.

## About the Author

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.
`;

	fs.writeFileSync(
		path.join(projectDir, "content/about.md"),
		aboutMarkdownContent,
	);

	// Create a default layout
	const defaultLayoutContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }}</title>
  <meta name="description" content="{{ description }}">
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    nav { margin-bottom: 2rem; }
    nav a { margin-right: 1rem; }
    h1 { color: #333; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
  </nav>
  
  <main>
    {{ content }}
  </main>
  
  <footer>
    <p>&copy; {{ currentYear }} Static Site</p>
  </footer>
</body>
</html>`;

	fs.writeFileSync(
		path.join(projectDir, "layouts/default.html"),
		defaultLayoutContent,
	);

	// Create a config file for the static site generator
	const configContent = `export default {
  site: {
    title: 'My Static Site',
    description: 'A static site built with Verb',
    baseUrl: 'https://example.com',
  },
  build: {
    outDir: 'dist',
    contentDir: 'content',
    layoutsDir: 'layouts',
    defaultLayout: 'default.html',
  },
  markdown: {
    gfm: true,
    smartypants: true,
    highlight: true,
  }
};
`;

	fs.writeFileSync(path.join(projectDir, "site.config.ts"), configContent);

	// Update the main index.ts file
	const indexContent = `import { createServer } from "verb";
import { staticFiles } from "verb";
import { buildSite } from "./build.ts";

// Build the site
await buildSite();

// Create a server to serve the static files
const app = createServer({ port: 3000 });

// Serve static files from the dist directory
app.get("/*", staticFiles("./dist"));

console.log("Static site server running at http://localhost:3000");
`;

	fs.writeFileSync(path.join(projectDir, "src/index.ts"), indexContent);

	// Create a simple build script
	const buildScriptContent = `import fs from 'fs-extra';
import path from 'path';
import config from '../site.config.ts';

export async function buildSite() {
  console.log('Building static site...');
  
  // In a real implementation, this would:
  // 1. Read markdown files from content directory
  // 2. Parse frontmatter and markdown
  // 3. Apply layouts
  // 4. Write HTML files to output directory
  
  // For now, we'll just create a simple index.html
  const outDir = path.resolve(process.cwd(), config.build.outDir);
  
  // Ensure output directory exists
  fs.ensureDirSync(outDir);
  
  // Create a simple index.html
  const indexHtml = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${config.site.title}</title>
  <meta name="description" content="\${config.site.description}">
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    nav { margin-bottom: 2rem; }
    nav a { margin-right: 1rem; }
    h1 { color: #333; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/about.html">About</a>
  </nav>
  
  <main>
    <h1>Welcome to My Static Site</h1>
    <p>This is a static site built with Verb's static site generator.</p>
    
    <h2>Features</h2>
    <ul>
      <li>Fast build times</li>
      <li>Markdown support</li>
      <li>Code syntax highlighting</li>
      <li>Responsive design</li>
    </ul>
  </main>
  
  <footer>
    <p>&copy; \${new Date().getFullYear()} Static Site</p>
  </footer>
</body>
</html>\`;
  
  fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
  
  // Create about page
  const aboutHtml = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About - \${config.site.title}</title>
  <meta name="description" content="About this static site">
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    nav { margin-bottom: 2rem; }
    nav a { margin-right: 1rem; }
    h1 { color: #333; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/about.html">About</a>
  </nav>
  
  <main>
    <h1>About</h1>
    <p>This is a static site built with Verb's static site generator.</p>
    
    <h2>About the Author</h2>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.</p>
  </main>
  
  <footer>
    <p>&copy; \${new Date().getFullYear()} Static Site</p>
  </footer>
</body>
</html>\`;
  
  fs.writeFileSync(path.join(outDir, 'about.html'), aboutHtml);
  
  console.log('Static site built successfully!');
}
`;

	fs.writeFileSync(path.join(projectDir, "src/build.ts"), buildScriptContent);

	// Update package.json to include static site generator scripts
	const packageJsonPath = path.join(projectDir, "package.json");
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

	packageJson.scripts = {
		...packageJson.scripts,
		build: "bun run src/build.ts",
		dev: "bun run src/index.ts",
		"build:watch": "bun run --watch src/build.ts",
	};

	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}
