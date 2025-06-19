---
title: CLI Overview
description: Learn about the Verb CLI and its capabilities
---

# Verb CLI Overview

The `@verb/cli` package provides a command-line interface for working with Verb projects. It helps you scaffold new projects, manage plugins, and streamline your development workflow.

## Installation

You can install the Verb CLI globally using Bun:

```bash
bun install -g @verb/cli
```

After installation, you can use the `verb` command in your terminal.

## Available Commands

The Verb CLI provides several commands to help you work with Verb projects:

### init

The `init` command creates a new Verb project with a predefined structure:

```bash
verb init my-verb-app
```

Options:
- `-t, --template <template>` - Project template (basic, api, fullstack, static)
- `-y, --yes` - Skip prompts and use defaults
- `--package-manager <manager>` - Package manager to use (bun, npm, yarn, pnpm)

### dev

The `dev` command starts a development server with hot reloading:

```bash
verb dev
```

Options:
- `-p, --port <port>` - Port to run the server on (default: 3000)
- `-h, --host <host>` - Host to bind to (default: localhost)
- `--watch` - Enable file watching and hot reloading (default: true)

### plugin

The `plugin` command helps you manage Verb plugins:

```bash
# List installed plugins
verb plugin list

# Add a plugin
verb plugin add @verb/plugin-name

# Remove a plugin
verb plugin remove @verb/plugin-name

# Create a new plugin
verb plugin create my-plugin
```

## Project Templates

The Verb CLI provides several project templates to help you get started quickly:

### Basic Template

A minimal setup with a simple server and basic routing:

```bash
verb init my-app --template basic
```

### API Template

A template focused on building REST APIs:

```bash
verb init my-api --template api
```

### Full-stack Template

A template that includes both a backend API and a frontend:

```bash
verb init my-fullstack-app --template fullstack
```

### Static Template

A template for building static sites:

```bash
verb init my-static-site --template static
```

## Configuration

The Verb CLI can be configured using a `verb.config.js` or `verb.config.ts` file in your project root:

```typescript
// verb.config.ts
export default {
  // Server configuration
  server: {
    port: 3000,
    hostname: "localhost",
    development: true
  },
  
  // Build configuration
  build: {
    outDir: "dist",
    minify: true,
    sourcemap: true
  },
  
  // Plugin configuration
  plugins: [
    "@verb/plugin-name",
    ["@verb/another-plugin", { option: "value" }]
  ]
};
```

## Next Steps

Now that you understand the basics of the Verb CLI, you can explore more specific topics:

- [Project Creation](/cli/project-creation) - Learn more about creating new projects
- [Development Server](/cli/development-server) - Learn about the development server
- [Plugin Management](/cli/plugin-management) - Learn how to manage plugins