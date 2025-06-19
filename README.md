# Verb Library

A modern, high-performance web library for Bun.

## Packages

This monorepo contains the following packages:

- **@verb/server**: The core server library
- **@verb/cli**: Command-line interface for Verb
- **@verb/plugins**: Official plugin registry for Verb
- **@verb/site**: Official website and documentation

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.0 or higher
- [Node.js](https://nodejs.org/) v18 or higher (optional)

### Setup

```bash
# Clone the repository
git clone https://github.com/wess/verb.git
cd verb

# Install dependencies
bun install
```

### Building

```bash
# Build all packages
bun run build

# Build specific packages
bun run build:server
bun run build:cli
bun run build:plugins
bun run build:site
```

### Running the Website

```bash
# Generate and serve the site with live reloading
bun run site:serve
```

## License

MIT
