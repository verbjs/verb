---
title: Installation
description: Learn how to install and set up Ledger
---

# Installation

Getting started with Ledger is easy. Follow these steps to install and set up your first Ledger site.

## Prerequisites

Before you begin, make sure you have the following installed:

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- [Node.js](https://nodejs.org/) (v16.0.0 or higher)

## Create a New Project

The easiest way to get started is to create a new project using Bun:

```bash
# Create a new directory for your project
mkdir my-docs
cd my-docs

# Initialize a new Bun project
bun init

# Install Ledger
bun add ledger
```

## Project Structure

A typical Ledger project has the following structure:

```
my-docs/
├── docs/                # Your markdown files
│   ├── index.md         # Home page
│   ├── guide/           # Nested pages
│   │   ├── introduction.md
│   │   └── ...
├── public/              # Static assets
│   ├── favicon.ico
│   └── ...
├── ledger.config.ts     # Configuration file
├── package.json
└── bun.lockb
```

## Configuration

Create a `ledger.config.ts` file in your project root:

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

## Create Your First Page

Create a `docs/index.md` file:

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

## Development Server

Start the development server:

```bash
bun run ledger dev
```

This will start a development server at `http://localhost:3000`.

## Build for Production

To build your site for production:

```bash
bun run ledger build
```

This will generate a static site in the `dist` directory, which you can deploy to any static hosting service.

## Next Steps

Now that you have installed Ledger and created your first page, you can:

- [Configure your site](/guide/configuration)
- [Write content](/guide/writing-content)
- [Customize the theme](/guide/custom-themes)