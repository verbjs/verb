---
title: Installation
description: Get started with Verb by installing it in your project
---

# Installation

Verb is designed to work with [Bun](https://bun.sh), a fast all-in-one JavaScript runtime. Before installing Verb, make sure you have Bun installed on your system.

## Prerequisites

- [Bun](https://bun.sh) v1.0 or higher

## Installing Bun

If you don't have Bun installed yet, you can install it with the following command:

```bash
curl -fsSL https://bun.sh/install | bash
```

For Windows users, please follow the [official Bun installation guide](https://bun.sh/docs/installation).

## Creating a New Verb Project

The easiest way to get started with Verb is to use the CLI to create a new project:

```bash
# Install the Verb CLI globally
bun install -g @verb/cli

# Create a new project
verb init my-verb-app

# Navigate to the project directory
cd my-verb-app

# Start the development server
bun run dev
```

This will create a new Verb project with a basic setup, install all dependencies, and start a development server.

## Manual Installation

If you prefer to add Verb to an existing project, you can install it directly:

```bash
# Create a new directory for your project (if needed)
mkdir my-verb-app
cd my-verb-app

# Initialize a new Bun project
bun init

# Install Verb
bun add @verb/server
```

## Creating a Basic Server

After installing Verb, you can create a basic server by adding the following code to your entry file (e.g., `src/index.ts`):

```typescript
import { createServer } from "@verb/server";

const app = createServer({
  port: 3000,
  development: true
});

app.get("/", () => {
  return new Response("Hello from Verb!");
});

console.log("Server running at http://localhost:3000");
```

## Next Steps

Now that you have Verb installed, check out the [Quick Start](/getting-started/quick-start) guide to learn more about building applications with Verb.