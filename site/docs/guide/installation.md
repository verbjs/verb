# Installation

This guide covers different ways to install and set up Verb in your project.

## System Requirements

- **Bun**: v1.0.0 or higher
- **Node.js**: v18+ (if using Node.js instead of Bun)
- **TypeScript**: v4.5+ (recommended)
- **Operating System**: macOS, Linux, or Windows

## Installing Bun

If you don't have Bun installed, install it first:

### macOS/Linux
```bash
curl -fsSL https://bun.sh/install | bash
```

### Windows
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Verify Installation
```bash
bun --version
```

## Installing Verb

### New Project

Create a new project with Verb:

```bash
# Create project directory
mkdir my-verb-app
cd my-verb-app

# Initialize Bun project
bun init -y

# Install Verb
bun install verb
```

### Existing Project

Add Verb to an existing project:

```bash
# Install Verb
bun install verb

# Install TypeScript (recommended)
bun install -D typescript
bun install -D @types/bun
```

## Project Structure

A typical Verb project structure:

```
my-verb-app/
├── src/
│   ├── server.ts          # Main server file
│   ├── routes/            # Route handlers
│   ├── middleware/        # Custom middleware
│   └── types/             # TypeScript types
├── tests/                 # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## TypeScript Configuration

Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Package.json Scripts

Add useful scripts to your `package.json`:

```json
{
  "name": "my-verb-app",
  "type": "module",
  "scripts": {
    "dev": "bun --hot src/server.ts",
    "start": "bun src/server.ts",
    "build": "bun build src/server.ts --outdir=dist",
    "test": "bun test",
    "lint": "bunx eslint src/**/*.ts",
    "format": "bunx prettier --write src/**/*.ts"
  },
  "dependencies": {
    "verb": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/bun": "latest",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

## Basic Server Setup

Create your first server (`src/server.ts`):

```typescript
import { createServer } from "verb";

const app = createServer();

app.get("/", (req, res) => {
  res.json({ 
    message: "Hello from Verb!",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

const port = process.env.PORT || 3000;
app.listen(port);

console.log(`🚀 Server running on http://localhost:${port}`);
```

## Development Environment

### Environment Variables

Create a `.env` file:

```env
PORT=3000
NODE_ENV=development
DEBUG=true
```

### Hot Reload

For development with automatic reloading:

```bash
bun --hot src/server.ts
```

### Production Build

For production deployment:

```bash
# Build the application
bun build src/server.ts --outdir=dist --minify

# Run production server
bun dist/server.js
```

## Docker Setup

Create a `Dockerfile`:

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
RUN bun install

# Copy source code
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Start server
CMD ["bun", "src/server.ts"]
```

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

## Verification

Test your installation:

```bash
# Run the server
bun src/server.ts

# Test the endpoint (in another terminal)
curl http://localhost:3000
```

You should see:
```json
{
  "message": "Hello from Verb!",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Common Installation Issues

### Bun Not Found
```bash
# Add Bun to PATH
export PATH="$HOME/.bun/bin:$PATH"

# Or reload your shell
source ~/.bashrc  # or ~/.zshrc
```

### Permission Errors
```bash
# Use sudo for global installations (not recommended)
sudo bun install -g verb

# Or use local installation (recommended)
bun install verb
```

### TypeScript Errors
```bash
# Install TypeScript and types
bun install -D typescript @types/bun

# Check TypeScript version
bunx tsc --version
```

### Module Resolution Issues
Make sure your `tsconfig.json` has correct module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true
  }
}
```

## IDE Setup

### VS Code

Install recommended extensions:
- Bun for Visual Studio Code
- TypeScript and JavaScript Language Features
- ESLint
- Prettier

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.runtime": "bun",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### WebStorm/IntelliJ

1. Set TypeScript service: File → Settings → Languages & Frameworks → TypeScript
2. Set Node.js interpreter to Bun: File → Settings → Node.js

## Testing Installation

Create a test file (`tests/server.test.ts`):

```typescript
import { test, expect } from "bun:test";
import { createServer } from "verb";

test("server creation", () => {
  const app = createServer();
  expect(app).toBeDefined();
  expect(app.get).toBeDefined();
  expect(app.listen).toBeDefined();
});

test("basic route", async () => {
  const app = createServer();
  
  app.get("/test", (req, res) => {
    res.json({ test: true });
  });

  const handler = app.createFetchHandler();
  const response = await handler(new Request("http://localhost/test"));
  
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.test).toBe(true);
});
```

Run tests:

```bash
bun test
```

## Next Steps

Now that Verb is installed, check out:

- [Getting Started Guide](/guide/getting-started) - Build your first server
- [Multi-Protocol Support](/guide/multi-protocol) - Learn about different protocols
- [Examples](/examples/) - Real-world examples

## Support

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/verbjs/verb/issues)
2. Review the [documentation](/guide/)
3. Ask questions in [GitHub Discussions](https://github.com/verbjs/verb/discussions)
4. Join the community on Discord