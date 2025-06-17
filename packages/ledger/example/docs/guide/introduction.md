---
title: Introduction
description: Introduction to Ledger, a static site generator
---

# Introduction

Ledger is a modern static site generator inspired by VitePress, designed to make it easy to create beautiful documentation sites.

## Why Ledger?

Ledger was created to provide a simple, fast, and flexible way to build documentation sites using modern web technologies:

- **Simple** - Easy to set up and use
- **Fast** - Built with Bun for fast development and build times
- **Flexible** - Customizable with React components and Mantine UI

## How It Works

Ledger works by converting your Markdown files into HTML, then rendering them with React components. The process is as follows:

1. Write your content in Markdown files
2. Configure your site with a `ledger.config.ts` file
3. Run the development server or build command
4. Ledger processes your Markdown files and generates a static site

## Core Concepts

### Pages

Pages are created from Markdown files in your source directory. Each Markdown file becomes a page in your site.

### Frontmatter

You can add metadata to your pages using frontmatter, which is a YAML block at the top of your Markdown files:

```md
---
title: My Page
description: This is my page description
---
```

### Configuration

You can configure your site using a `ledger.config.ts` file in your project root:

```typescript
import { SiteConfig } from 'ledger';

const config: SiteConfig = {
  title: 'My Documentation',
  description: 'A static website built with Ledger',
  // ...
};

export default config;
```

## Next Steps

Now that you understand the basics of Ledger, you can:

- [Install Ledger](/guide/installation)
- [Configure your site](/guide/configuration)
- [Create your first page](/guide/writing-content)