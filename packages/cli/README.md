# verb - Verb CLI

Command-line interface for the Verb library, providing project scaffolding, development tools, and a static site generator.

## Installation

```bash
# Install globally
bun add -g verb

# Or use directly with npx
bunx verb
```

## Usage

```bash
verb [command] [options]
```

## Commands

### Project Initialization

Create a new Verb project:

```bash
# Create a new project
verb init my-app

# Create a project with a specific template
verb init my-api --template api

# Skip prompts and use defaults
verb init my-app -y
```

### Development Server

Start a development server with hot reload:

```bash
# Start the development server
verb dev

# Specify port and host
verb dev --port 8080 --host 0.0.0.0

# Open in browser
verb dev --open
```

### Static Site Generator

Generate and manage static sites:

```bash
# Create a new static site
verb site new my-site

# Initialize a static site in the current directory
verb site init

# Generate a static site
verb site generate

# Generate and serve the site
verb site generate --serve

# Watch for changes and rebuild
verb site generate --watch --serve
```

### Plugin Management

Create and manage Verb plugins:

```bash
# Create a new plugin
verb plugin create my-plugin

# List installed plugins
verb plugin list

# Install a plugin
verb plugin install verb-plugin-example

# Install from GitHub
verb plugin install username/verb-plugin-example

# Remove a plugin
verb plugin remove verb-plugin-example
```

## Options

- `-v, --verbose`: Enable verbose output
- `--no-color`: Disable colored output
- `-h, --help`: Display help information
- `-V, --version`: Display version information

## Templates

The CLI includes several project templates:

- **basic**: Minimal setup for a Verb server
- **api**: REST API focused setup
- **fullstack**: API + React frontend
- **static**: Static site generator setup

## Static Site Generator

The built-in static site generator supports:

- Markdown content with frontmatter
- Customizable layouts
- Asset handling
- Development server with hot reload
- Multiple site templates (blog, docs, portfolio)

## Plugin System

Create and share reusable plugins for Verb:

- Standardized plugin structure
- Easy distribution via npm
- Simple integration with Verb applications

## License

MIT
