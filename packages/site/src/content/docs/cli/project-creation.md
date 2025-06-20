---
title: Project Creation
description: Learn how to create new Verb projects using the CLI
---

# Project Creation with Verb CLI

The Verb CLI provides a powerful project scaffolding system that helps you create new projects with a predefined structure and configuration. This guide covers the project creation process in detail.

## Basic Usage

To create a new Verb project, use the `init` command:

```bash
verb init my-verb-app
```

This will create a new directory called `my-verb-app` with a basic Verb project structure.

## Interactive Mode

By default, the `init` command runs in interactive mode, prompting you for various project options:

```bash
verb init
```

The CLI will ask you for:

1. **Project name**: The name of your project
2. **Project description**: A brief description of your project
3. **Project template**: The template to use (basic, api, fullstack, static)
4. **Package manager**: The package manager to use (bun, npm, yarn, pnpm)
5. **Additional features**: Optional features to include (TypeScript, ESLint, testing, etc.)

## Non-Interactive Mode

You can also create a project without prompts using the `--yes` flag:

```bash
verb init my-verb-app --yes
```

This will create a project with default options.

## Template Selection

Verb provides several project templates to help you get started quickly:

```bash
verb init my-app --template <template-name>
```

Available templates:

- **basic**: A minimal setup with a simple server and basic routing
- **api**: A template focused on building REST APIs
- **fullstack**: A template that includes both a backend API and a frontend
- **static**: A template for building static sites

### Basic Template

The basic template provides a minimal setup for a Verb server:

```bash
verb init my-app --template basic
```

Project structure:
```
my-app/
├── src/
│   └── index.ts      # Entry point
├── public/           # Static files
├── package.json      # Project configuration
└── README.md         # Project documentation
```

### API Template

The API template is designed for building REST APIs:

```bash
verb init my-api --template api
```

Project structure:
```
my-api/
├── src/
│   ├── index.ts      # Entry point
│   ├── routes/       # API routes
│   ├── middleware/   # Custom middleware
│   └── utils/        # Utility functions
├── public/           # Static files
├── tests/            # Test files
├── package.json      # Project configuration
└── README.md         # Project documentation
```

### Full-stack Template

The full-stack template includes both a backend API and a frontend:

```bash
verb init my-fullstack-app --template fullstack
```

Project structure:
```
my-fullstack-app/
├── src/
│   ├── index.ts      # Entry point
│   ├── server/       # Backend code
│   │   ├── routes/   # API routes
│   │   └── middleware/
│   └── client/       # Frontend code
│       ├── components/
│       ├── pages/
│       └── styles/
├── public/           # Static files
├── tests/            # Test files
├── package.json      # Project configuration
└── README.md         # Project documentation
```

### Static Template

The static template is designed for building static sites:

```bash
verb init my-static-site --template static
```

Project structure:
```
my-static-site/
├── src/
│   ├── index.ts      # Entry point
│   ├── pages/        # Page templates
│   ├── layouts/      # Layout templates
│   └── styles/       # CSS styles
├── public/           # Static files
├── content/          # Markdown content
├── package.json      # Project configuration
└── README.md         # Project documentation
```

## Package Manager Selection

You can specify which package manager to use:

```bash
verb init my-app --package-manager <manager>
```

Available package managers:
- **bun**: Bun package manager (default)
- **npm**: npm package manager
- **yarn**: Yarn package manager
- **pnpm**: pnpm package manager

## Additional Features

When creating a project in interactive mode, you can select additional features:

- **TypeScript configuration**: Adds TypeScript configuration files
- **ESLint + Prettier**: Adds linting and code formatting
- **Testing setup**: Adds testing configuration and example tests
- **HTTP/2 support**: Adds HTTP/2 server configuration
- **React integration**: Adds React integration for server-side rendering
- **Schema validation**: Adds schema validation using a validation library
- **Session management**: Adds session management
- **Rate limiting**: Adds rate limiting middleware
- **Compression**: Adds response compression
- **Static file serving**: Adds static file serving configuration

## Project Configuration

After creating a project, you can customize it by editing the configuration files:

- **package.json**: Project dependencies and scripts
- **tsconfig.json**: TypeScript configuration (if TypeScript is enabled)
- **.eslintrc.json**: ESLint configuration (if ESLint is enabled)
- **.prettierrc**: Prettier configuration (if Prettier is enabled)
- **verb.config.ts**: Verb-specific configuration

## Next Steps

After creating your project, you can:

1. Navigate to the project directory: `cd my-verb-app`
2. Install dependencies (if not already installed): `bun install`
3. Start the development server: `bun run dev`

For more information on working with your new project, check out:

- [Quick Start](/getting-started/quick-start) - Learn the basics of Verb
- [Development Server](/cli/development-server) - Learn about the development server
- [Server Overview](/server/overview) - Learn about the Verb server