---
title: Development Server
description: Learn how to use the Verb development server for rapid development
---

# Development Server

The Verb CLI includes a development server that provides features like hot reloading, error reporting, and more to streamline your development workflow. This guide covers the development server in detail.

## Starting the Development Server

To start the development server, use the `dev` command:

```bash
verb dev
```

This will start a development server that watches your files for changes and automatically restarts the server when changes are detected.

## Command Options

The `dev` command accepts several options:

```bash
# Start the server on a specific port
verb dev --port 8080

# Bind to a specific host
verb dev --host 0.0.0.0

# Disable file watching
verb dev --no-watch

# Specify the entry file
verb dev --entry src/custom-entry.ts

# Enable verbose logging
verb dev --verbose
```

## Hot Reloading

The development server automatically restarts when you make changes to your code. This is known as hot reloading and it helps you see your changes immediately without manually restarting the server.

By default, the server watches all files in your project directory except for:
- `node_modules`
- `.git`
- Test files (`.test.ts`, `.spec.ts`)
- Build output directories

You can customize which files are watched using command line options.

## Error Reporting

The development server provides detailed error reporting to help you debug issues:

- **Syntax Errors**: If your code contains syntax errors, the server will display the error message and location.
- **Runtime Errors**: If your code throws an error at runtime, the server will display the error message and stack trace.
- **Type Errors**: If you're using TypeScript, the server will display type errors.

## Environment Variables

The development server automatically loads environment variables from a `.env` file in your project root:

```
# .env
PORT=3000
HOST=localhost
DEBUG=true
```

You can access these variables in your code using `process.env`:

```typescript
const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";
const debug = process.env.DEBUG === "true";
```

## Static File Serving

The development server automatically serves static files from the `public` directory:

```
my-app/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── src/
│   └── index.ts
└── package.json
```

In this example, the files in the `public` directory will be served at the root path (`/`).

## HTTPS

HTTPS support for the development server is planned for a future release.

## Custom Middleware

Support for adding custom middleware to the development server is planned for a future release.

## Development vs. Production

The development server is designed for development use only. For production, you should build your application and run it using a production server.

To build your application for production:

```bash
verb build
```

This will create a production-ready build of your application in the `dist` directory.

To run the production build:

```bash
node dist/index.js
```

Or with Bun:

```bash
bun dist/index.js
```

## Debugging

You can debug your application using the development server:

```bash
# Start the server in debug mode
verb dev --debug
```

This will start the server with the `--inspect` flag, allowing you to connect a debugger.

You can then connect to the debugger using Chrome DevTools or your IDE's debugger.

## Performance Optimization

The development server includes several performance optimizations:

- **Incremental Compilation**: Only recompiles changed files
- **Caching**: Caches compilation results to speed up restarts
- **Lazy Loading**: Only loads modules when they're needed

## Best Practices

- **Use TypeScript**: TypeScript provides better error reporting and code completion
- **Organize Your Code**: Keep your code organized in a clear directory structure
- **Use Environment Variables**: Store configuration in environment variables
- **Write Tests**: Write tests for your code to catch issues early
- **Use Version Control**: Keep your code in version control to track changes

## Next Steps

Now that you understand the development server, you can explore related topics:

- [Project Creation](/cli/project-creation) - Learn how to create new projects
- [Plugin Management](/cli/plugin-management) - Learn how to manage plugins
- [Server Overview](/server/overview) - Learn about the Verb server