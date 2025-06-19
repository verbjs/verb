import type { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import fs from "fs-extra";
import { spawn } from "node:child_process";
import chokidar from "chokidar";
import { glob } from "glob";

interface SiteOptions {
  input: string;
  output: string;
  watch: boolean;
  serve: boolean;
  port: number;
  open: boolean;
}

/**
 * Register the site command
 */
export function siteCommand(program: Command): void {
  const site = program.command("site").description("Static site generator commands");

  // Generate command
  site
    .command("generate")
    .description("Generate a static site")
    .option("-i, --input <dir>", "Input directory", "content")
    .option("-o, --output <dir>", "Output directory", "dist")
    .option("-w, --watch", "Watch for changes and rebuild")
    .option("-s, --serve", "Serve the generated site")
    .option("-p, --port <port>", "Port for the server", "3000")
    .option("--open", "Open in browser")
    .action(async (options) => {
      const siteOptions: SiteOptions = {
        input: options.input,
        output: options.output,
        watch: options.watch || false,
        serve: options.serve || false,
        port: Number.parseInt(options.port, 10),
        open: options.open || false,
      };

      await generateSite(siteOptions);
    });

  // New site command
  site
    .command("new")
    .description("Create a new static site")
    .argument("<name>", "Site name")
    .option("-t, --template <template>", "Site template (blog, docs, portfolio)", "blog")
    .action(async (name, options) => {
      await createNewSite(name, options.template);
    });

  // Init command
  site
    .command("init")
    .description("Initialize a static site in the current directory")
    .option("-t, --template <template>", "Site template (blog, docs, portfolio)", "blog")
    .action(async (options) => {
      await initSite(options.template);
    });
}

/**
 * Generate a static site
 */
async function generateSite(options: SiteOptions): Promise<void> {
  console.log(chalk.cyan("🏗️  Generating static site\n"));

  // Check if input directory exists
  const inputDir = path.resolve(process.cwd(), options.input);
  if (!fs.existsSync(inputDir)) {
    console.error(chalk.red(`Error: Input directory '${options.input}' does not exist`));
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  const outputDir = path.resolve(process.cwd(), options.output);
  fs.ensureDirSync(outputDir);

  // Check for site configuration
  const configPath = path.resolve(process.cwd(), "site.config.ts");
  const hasConfig = fs.existsSync(configPath);

  // Generate the site
  await buildSite(options, hasConfig);

  // Watch for changes if requested
  if (options.watch) {
    watchForChanges(options, hasConfig);
  }

  // Serve the site if requested
  if (options.serve) {
    serveSite(options);
  }
}

/**
 * Build the static site
 */
async function buildSite(options: SiteOptions, hasConfig: boolean): Promise<void> {
  const spinner = ora("Building site").start();

  try {
    if (hasConfig) {
      // Use the site's build script if it exists
      const packageJsonPath = path.resolve(process.cwd(), "package.json");
      const hasPackageJson = fs.existsSync(packageJsonPath);

      if (hasPackageJson) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

        if (packageJson.scripts?.build) {
          // Use the project's build script
          spinner.text = "Running build script";

          const packageManager = getPackageManager();
          const command =
            packageManager === "npm"
              ? "npm run build"
              : packageManager === "yarn"
                ? "yarn build"
                : packageManager === "pnpm"
                  ? "pnpm build"
                  : "bun run build";

          await execCommand(command);
          spinner.succeed("Site built successfully");
          return;
        }
      }

      // Use the config file directly
      spinner.text = "Building site with configuration";
      await execCommand(`bun run ${path.relative(process.cwd(), configPath)}`);
      spinner.succeed("Site built successfully");
      return;
    }

    // No config file, use default static site generation
    spinner.text = "Building site with default generator";

    // Get all markdown files
    const markdownFiles = await glob(`${options.input}/**/*.md`);

    if (markdownFiles.length === 0) {
      spinner.warn("No markdown files found");
      return;
    }

    // Process each markdown file
    for (const file of markdownFiles) {
      const content = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(options.input, file);
      const outputPath = path.join(options.output, relativePath.replace(/\.md$/, ".html"));

      // Ensure output directory exists
      fs.ensureDirSync(path.dirname(outputPath));

      // Simple markdown to HTML conversion (in a real implementation, use a proper markdown parser)
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${path.basename(file, ".md")}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  ${content
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")}
</body>
</html>`;

      fs.writeFileSync(outputPath, html);
    }

    // Copy static assets if they exist
    const publicDir = path.resolve(process.cwd(), "public");
    if (fs.existsSync(publicDir)) {
      fs.copySync(publicDir, options.output);
    }

    spinner.succeed(`Site built successfully (${markdownFiles.length} files)`);
  } catch (error) {
    spinner.fail(`Failed to build site: ${error.message}`);
    throw error;
  }
}

/**
 * Watch for changes and rebuild
 */
function watchForChanges(options: SiteOptions, hasConfig: boolean): void {
  console.log(chalk.gray("\nWatching for changes..."));

  // Watch input directory and public directory if it exists
  const watchPaths = [options.input];
  const publicDir = path.resolve(process.cwd(), "public");

  if (fs.existsSync(publicDir)) {
    watchPaths.push("public");
  }

  // Add layouts directory if it exists
  const layoutsDir = path.resolve(process.cwd(), "layouts");
  if (fs.existsSync(layoutsDir)) {
    watchPaths.push("layouts");
  }

  // Watch for changes
  const watcher = chokidar.watch(watchPaths, {
    ignored: /(^|[/\\])\../, // Ignore dotfiles
    persistent: true,
  });

  // Debounce rebuild to avoid multiple rebuilds
  let rebuildTimeout: NodeJS.Timeout | null = null;

  watcher.on("change", (changedPath) => {
    console.log(chalk.gray(`File changed: ${changedPath}`));

    // Debounce rebuild
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout);
    }

    rebuildTimeout = setTimeout(() => {
      console.log(chalk.yellow("\nRebuilding site..."));
      buildSite(options, hasConfig).catch((error) => {
        console.error(chalk.red(`Error rebuilding site: ${error.message}`));
      });
    }, 500);
  });

  // Handle process exit
  process.on("SIGINT", () => {
    console.log(chalk.yellow("\nStopping watcher..."));
    watcher.close();
    process.exit(0);
  });
}

/**
 * Serve the generated site
 */
function serveSite(options: SiteOptions): void {
  console.log(chalk.cyan("\n🌐 Starting server for static site"));

  // Create a simple server using Bun
  const serverCode = `
import { serve } from "bun";
import { file } from "bun";
import { join } from "path";

const PORT = ${options.port};
const PUBLIC_DIR = "${path.resolve(process.cwd(), options.output)}";

console.log("Server running at http://localhost:" + PORT);

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    
    // Default to index.html for root path
    if (path === "/") {
      path = "/index.html";
    }
    
    // Handle paths without extensions as potential directories with index.html
    if (!path.includes(".")) {
      const potentialFile = join(PUBLIC_DIR, path, "index.html");
      try {
        const stat = await file(potentialFile).exists();
        if (stat) {
          return new Response(file(potentialFile));
        }
      } catch (e) {
        // Continue to next check
      }
    }
    
    // Try exact path
    try {
      const filePath = join(PUBLIC_DIR, path);
      const exists = await file(filePath).exists();
      
      if (exists) {
        return new Response(file(filePath));
      }
    } catch (e) {
      // Continue to next check
    }
    
    // Try with .html extension
    try {
      const htmlPath = path.endsWith(".html") ? path : path + ".html";
      const filePath = join(PUBLIC_DIR, htmlPath);
      const exists = await file(filePath).exists();
      
      if (exists) {
        return new Response(file(filePath));
      }
    } catch (e) {
      // Continue to 404
    }
    
    // Return 404 if file not found
    return new Response("Not Found", { status: 404 });
  },
});
`;

  // Write the server code to a temporary file
  const tempServerPath = path.join(process.cwd(), ".verb-temp-server.ts");
  fs.writeFileSync(tempServerPath, serverCode);

  // Start the server
  const serverProcess = spawn("bun", ["run", tempServerPath], {
    stdio: "inherit",
  });

  // Clean up on exit
  process.on("SIGINT", () => {
    console.log(chalk.yellow("\nStopping server..."));
    serverProcess.kill();
    fs.removeSync(tempServerPath);
    process.exit(0);
  });

  // Open in browser if requested
  if (options.open) {
    openInBrowser(`http://localhost:${options.port}`);
  }
}

/**
 * Create a new static site
 */
async function createNewSite(name: string, template: string): Promise<void> {
  console.log(chalk.cyan(`🚀 Creating a new static site: ${name}\n`));

  // Create project directory
  const projectDir = path.resolve(process.cwd(), name);

  // Check if directory exists
  if (fs.existsSync(projectDir)) {
    console.error(chalk.red(`Error: Directory ${name} already exists`));
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Directory already exists. Overwrite?",
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow("Site creation cancelled"));
      process.exit(0);
    }

    // Remove existing directory
    fs.removeSync(projectDir);
  }

  // Create directory
  fs.mkdirSync(projectDir, { recursive: true });

  // Change to project directory
  process.chdir(projectDir);

  // Initialize the site
  await initSite(template);

  console.log(chalk.green("\n✅ Static site created successfully!"));
  console.log("\nNext steps:");
  console.log(chalk.gray(`  cd ${name}`));
  console.log(chalk.gray("  verb site generate --serve"));
  console.log("\nHappy publishing! 🎉");
}

/**
 * Initialize a static site in the current directory
 */
async function initSite(template: string): Promise<void> {
  console.log(chalk.cyan(`🏗️  Initializing a new ${template} site\n`));

  const spinner = ora("Setting up site structure").start();

  try {
    // Create directory structure
    fs.mkdirSync("content", { recursive: true });
    fs.mkdirSync("layouts", { recursive: true });
    fs.mkdirSync("public", { recursive: true });
    fs.mkdirSync("public/css", { recursive: true });
    fs.mkdirSync("public/js", { recursive: true });
    fs.mkdirSync("public/images", { recursive: true });

    // Create site configuration
    const configContent = `export default {
  site: {
    title: 'My ${capitalizeFirstLetter(template)} Site',
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

    fs.writeFileSync("site.config.ts", configContent);

    // Create default layout
    const layoutContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }} | {{ site.title }}</title>
  <meta name="description" content="{{ description }}">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <div class="container">
      <h1><a href="/">{{ site.title }}</a></h1>
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          ${template === "blog" ? '<li><a href="/blog">Blog</a></li>' : ""}
          ${template === "docs" ? '<li><a href="/docs">Documentation</a></li>' : ""}
          ${template === "portfolio" ? '<li><a href="/projects">Projects</a></li>' : ""}
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>
  
  <main class="container">
    {{ content }}
  </main>
  
  <footer>
    <div class="container">
      <p>&copy; {{ currentYear }} {{ site.title }}</p>
    </div>
  </footer>
  
  <script src="/js/main.js"></script>
</body>
</html>`;

    fs.writeFileSync("layouts/default.html", layoutContent);

    // Create CSS file
    const cssContent = `/* Base styles */
:root {
  --primary-color: #0070f3;
  --secondary-color: #0070f3;
  --background-color: #ffffff;
  --text-color: #333333;
  --light-gray: #f0f0f0;
  --dark-gray: #666666;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--background-color);
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Header */
header {
  background-color: var(--light-gray);
  padding: 1rem 0;
  margin-bottom: 2rem;
}

header h1 {
  margin: 0;
}

header a {
  color: var(--text-color);
  text-decoration: none;
}

header nav {
  margin-top: 1rem;
}

header nav ul {
  display: flex;
  list-style: none;
}

header nav ul li {
  margin-right: 1.5rem;
}

header nav ul li a {
  color: var(--dark-gray);
}

header nav ul li a:hover {
  color: var(--primary-color);
}

/* Main content */
main {
  min-height: 70vh;
  margin-bottom: 2rem;
}

h1, h2, h3, h4, h5, h6 {
  margin: 1.5rem 0 1rem 0;
  line-height: 1.2;
}

p {
  margin-bottom: 1.5rem;
}

a {
  color: var(--primary-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Footer */
footer {
  background-color: var(--light-gray);
  padding: 2rem 0;
  text-align: center;
  color: var(--dark-gray);
}

/* Responsive */
@media (max-width: 768px) {
  header nav ul {
    flex-direction: column;
  }
  
  header nav ul li {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
}`;

    fs.writeFileSync("public/css/style.css", cssContent);

    // Create JavaScript file
    const jsContent = `// Main JavaScript file
document.addEventListener('DOMContentLoaded', () => {
  console.log('Site loaded');
});`;

    fs.writeFileSync("public/js/main.js", jsContent);

    // Create content based on template
    await createTemplateContent(template);

    // Create package.json
    const packageJson = {
      name: path.basename(process.cwd()),
      version: "0.1.0",
      description: `A static ${template} site built with Verb`,
      type: "module",
      scripts: {
        dev: "verb site generate --watch --serve",
        build: "verb site generate",
        clean: "rm -rf dist",
      },
      dependencies: {},
      devDependencies: {},
    };

    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));

    spinner.succeed("Site structure created");
  } catch (error) {
    spinner.fail(`Failed to initialize site: ${error.message}`);
    throw error;
  }
}

/**
 * Create content based on the selected template
 */
async function createTemplateContent(template: string): Promise<void> {
  // Create index.md
  const indexContent = `---
title: Home
description: Welcome to my ${template} site
---

# Welcome to My ${capitalizeFirstLetter(template)} Site

This is a static site built with Verb's static site generator.

## Features

- Fast build times
- Markdown support
- Code syntax highlighting
- Responsive design
`;

  fs.writeFileSync("content/index.md", indexContent);

  // Create about.md
  const aboutContent = `---
title: About
description: About this site
---

# About

This is a static site built with Verb's static site generator.

## About Me

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.
`;

  fs.writeFileSync("content/about.md", aboutContent);

  // Create contact.md
  const contactContent = `---
title: Contact
description: Get in touch
---

# Contact

Feel free to reach out if you have any questions or comments.

- Email: example@example.com
- Twitter: @example
- GitHub: github.com/example
`;

  fs.writeFileSync("content/contact.md", contactContent);

  // Create template-specific content
  switch (template) {
    case "blog":
      createBlogContent();
      break;
    case "docs":
      createDocsContent();
      break;
    case "portfolio":
      createPortfolioContent();
      break;
  }
}

/**
 * Create blog-specific content
 */
function createBlogContent(): void {
  // Create blog directory
  fs.mkdirSync("content/blog", { recursive: true });

  // Create blog index
  const blogIndexContent = `---
title: Blog
description: My latest posts
---

# Blog

Here are my latest posts:

- [Getting Started with Verb](/blog/getting-started)
- [Building Static Sites](/blog/building-static-sites)
- [Advanced Markdown Features](/blog/advanced-markdown)
`;

  fs.writeFileSync("content/blog/index.md", blogIndexContent);

  // Create sample blog posts
  const post1Content = `---
title: Getting Started with Verb
description: Learn how to get started with Verb library
date: ${new Date().toISOString().split("T")[0]}
tags: [verb, tutorial, getting-started]
---

# Getting Started with Verb

This is a sample blog post about getting started with Verb.

## Installation

\`\`\`bash
bun add github:wess/verb
\`\`\`

## Creating a Server

\`\`\`typescript
import { createServer } from "verb";

const app = createServer({ port: 3000 });

app.get("/", () => new Response("Hello, Verb!"));

console.log("Server running at http://localhost:3000");
\`\`\`
`;

  fs.writeFileSync("content/blog/getting-started.md", post1Content);

  const post2Content = `---
title: Building Static Sites
description: Learn how to build static sites with Verb
date: ${new Date().toISOString().split("T")[0]}
tags: [verb, static-sites, tutorial]
---

# Building Static Sites with Verb

This is a sample blog post about building static sites with Verb.

## Getting Started

\`\`\`bash
verb site new my-blog
cd my-blog
verb site generate --serve
\`\`\`

## Adding Content

Create markdown files in the \`content\` directory to add new pages to your site.
`;

  fs.writeFileSync("content/blog/building-static-sites.md", post2Content);

  const post3Content = `---
title: Advanced Markdown Features
description: Explore advanced markdown features
date: ${new Date().toISOString().split("T")[0]}
tags: [markdown, tutorial, advanced]
---

# Advanced Markdown Features

This is a sample blog post about advanced markdown features.

## Code Blocks

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Tables

| Name | Type | Description |
|------|------|-------------|
| id   | number | Unique identifier |
| name | string | User's name |
| email | string | User's email |

## Blockquotes

> This is a blockquote.
> It can span multiple lines.
`;

  fs.writeFileSync("content/blog/advanced-markdown.md", post3Content);
}

/**
 * Create docs-specific content
 */
function createDocsContent(): void {
  // Create docs directory
  fs.mkdirSync("content/docs", { recursive: true });
  fs.mkdirSync("content/docs/getting-started", { recursive: true });
  fs.mkdirSync("content/docs/guides", { recursive: true });
  fs.mkdirSync("content/docs/api", { recursive: true });

  // Create docs index
  const docsIndexContent = `---
title: Documentation
description: Verb library documentation
---

# Documentation

Welcome to the Verb library documentation.

## Getting Started

- [Installation](/docs/getting-started/installation)
- [Quick Start](/docs/getting-started/quick-start)
- [Project Structure](/docs/getting-started/project-structure)

## Guides

- [Routing](/docs/guides/routing)
- [Middleware](/docs/guides/middleware)
- [Static Files](/docs/guides/static-files)

## API Reference

- [Server](/docs/api/server)
- [Request](/docs/api/request)
- [Response](/docs/api/response)
`;

  fs.writeFileSync("content/docs/index.md", docsIndexContent);

  // Create sample docs pages
  const installationContent = `---
title: Installation
description: Installing Verb library
---

# Installation

Verb is a library built for Bun, a fast JavaScript runtime.

## Prerequisites

- Bun v1.0 or higher
- TypeScript v5.0 or higher (recommended)

## Installing Verb

\`\`\`bash
bun add github:wess/verb
\`\`\`

## Creating a New Project

The easiest way to get started is to use the Verb CLI:

\`\`\`bash
bun add -g verb
verb init my-app
cd my-app
bun run dev
\`\`\`
`;

  fs.writeFileSync("content/docs/getting-started/installation.md", installationContent);

  const quickStartContent = `---
title: Quick Start
description: Getting started with Verb
---

# Quick Start

This guide will help you create your first Verb application.

## Creating a Server

\`\`\`typescript
import { createServer, json, text } from "verb";

const app = createServer({ port: 3000 });

app.get("/", () => text("Hello, Verb!"));
app.get("/api/users/:id", (req, params) => json({ id: params.id }));

console.log("Server running at http://localhost:3000");
\`\`\`

## Adding Routes

\`\`\`typescript
// Basic routes
app.get("/users", handler);
app.post("/users", handler);
app.put("/users/:id", handler);
app.delete("/users/:id", handler);

// Route parameters
app.get("/users/:id", (req, params) => {
  return json({ userId: params.id });
});
\`\`\`
`;

  fs.writeFileSync("content/docs/getting-started/quick-start.md", quickStartContent);

  const routingContent = `---
title: Routing
description: Routing in Verb
---

# Routing

Verb provides a simple and intuitive routing system.

## Basic Routes

\`\`\`typescript
app.get("/users", () => json(users));
app.post("/users", async (req) => {
  const user = await req.json();
  users.push(user);
  return json(user, 201);
});
\`\`\`

## Route Parameters

\`\`\`typescript
app.get("/users/:id", (req, params) => {
  const user = users.find(u => u.id === params.id);
  if (!user) return error("User not found", 404);
  return json(user);
});
\`\`\`

## Wildcard Routes

\`\`\`typescript
app.get("/static/*", (req, params) => {
  const filePath = params["*"]; // Everything after /static/
  return text(\`Serving: \${filePath}\`);
});
\`\`\`
`;

  fs.writeFileSync("content/docs/guides/routing.md", routingContent);

  const serverApiContent = `---
title: Server API
description: Server API reference
---

# Server API

The \`createServer\` function is the main entry point for creating a Verb server.

## createServer

\`\`\`typescript
function createServer(options?: ServerOptions): Server;
\`\`\`

### Options

- \`port\`: Port to listen on (default: 3000)
- \`hostname\`: Hostname to bind to (default: "0.0.0.0")
- \`maxRequestBodySize\`: Maximum request body size in bytes (default: 10MB)
- \`http2\`: Enable HTTP/2 support (default: false)
- \`tls\`: TLS options for HTTPS (default: undefined)

### Example

\`\`\`typescript
const app = createServer({
  port: 3000,
  hostname: "0.0.0.0",
  maxRequestBodySize: 10 * 1024 * 1024
});
\`\`\`
`;

  fs.writeFileSync("content/docs/api/server.md", serverApiContent);
}

/**
 * Create portfolio-specific content
 */
function createPortfolioContent(): void {
  // Create projects directory
  fs.mkdirSync("content/projects", { recursive: true });

  // Create projects index
  const projectsIndexContent = `---
title: Projects
description: My portfolio projects
---

# Projects

Here are some of my recent projects:

- [Project One](/projects/project-one)
- [Project Two](/projects/project-two)
- [Project Three](/projects/project-three)
`;

  fs.writeFileSync("content/projects/index.md", projectsIndexContent);

  // Create sample project pages
  const project1Content = `---
title: Project One
description: A sample project
image: /images/project1.jpg
tags: [web, frontend, react]
---

# Project One

A sample project built with React and TypeScript.

## Overview

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.

## Technologies Used

- React
- TypeScript
- CSS Modules
- Webpack

## Screenshots

![Project Screenshot](/images/project1.jpg)
`;

  fs.writeFileSync("content/projects/project-one.md", project1Content);

  const project2Content = `---
title: Project Two
description: Another sample project
image: /images/project2.jpg
tags: [backend, api, node]
---

# Project Two

A sample backend API project built with Node.js.

## Overview

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.

## Technologies Used

- Node.js
- Express
- MongoDB
- JWT Authentication

## API Endpoints

- \`GET /api/users\`: Get all users
- \`GET /api/users/:id\`: Get user by ID
- \`POST /api/users\`: Create a new user
- \`PUT /api/users/:id\`: Update a user
- \`DELETE /api/users/:id\`: Delete a user
`;

  fs.writeFileSync("content/projects/project-two.md", project2Content);

  const project3Content = `---
title: Project Three
description: A third sample project
image: /images/project3.jpg
tags: [mobile, react-native, ios, android]
---

# Project Three

A sample mobile app built with React Native.

## Overview

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.

## Technologies Used

- React Native
- TypeScript
- Redux
- Firebase

## Features

- User authentication
- Real-time data synchronization
- Push notifications
- Offline support
`;

  fs.writeFileSync("content/projects/project-three.md", project3Content);

  // Create placeholder images
  fs.writeFileSync("public/images/project1.jpg", "Placeholder image");
  fs.writeFileSync("public/images/project2.jpg", "Placeholder image");
  fs.writeFileSync("public/images/project3.jpg", "Placeholder image");
}

/**
 * Execute a shell command
 */
async function execCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, { shell: true, stdio: "inherit" });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    process.on("error", (err) => {
      reject(err);
    });
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

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
