# Ledger

A modern static site generator inspired by VitePress, built with Bun, TypeScript, React, and Mantine.

## Features

- **Markdown Support** - Write your content in Markdown with frontmatter
- **Code Highlighting** - Syntax highlighting for code blocks
- **Dark/Light Theme** - Support for both dark and light themes
- **Search Functionality** - Built-in search for your documentation
- **Sidebar Navigation** - Organize your documentation with a customizable sidebar
- **Hierarchical Structure** - Organize your content in a hierarchical structure

## Installation

```bash
# Create a new directory for your project
mkdir my-docs
cd my-docs

# Initialize a new Bun project
bun init

# Install Ledger
bun add ledger
```

## Quick Start

1. Create a configuration file `ledger.config.ts`:

```typescript
import { SiteConfig } from 'ledger';

const config: SiteConfig = {
  title: 'My Documentation',
  description: 'A static website built with Ledger',
  outDir: 'dist',
  srcDir: 'docs',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' }
    ],
    sidebar: [
      {
        text: 'Introduction',
        link: '/guide/introduction'
      },
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Configuration', link: '/guide/configuration' }
        ]
      }
    ]
  }
};

export default config;
```

2. Create your first page `docs/index.md`:

```md
---
title: Home
description: Welcome to my documentation
---

# Welcome to My Docs

This is my first Ledger site.

## Getting Started

Check out the [Introduction](/guide/introduction) to learn more.
```

3. Start the development server:

```bash
bun run ledger dev
```

4. Build for production:

```bash
bun run ledger build
```

## Documentation

For more detailed documentation, check out the [example](./example) directory.

## License

MIT
