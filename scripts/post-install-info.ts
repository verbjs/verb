#!/usr/bin/env bun

/**
 * Verb Post-Install Information Script
 * 
 * Provides helpful information after installation,
 * especially important if someone bypassed the preinstall check.
 */

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
  reset: '\x1b[0m'
};

function detectRuntime(): string {
  if (typeof Bun !== 'undefined') {
    return 'bun';
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  } else if (typeof Deno !== 'undefined') {
    return 'deno';
  }
  return 'unknown';
}

function main() {
  const runtime = detectRuntime();
  
  console.log(`
${colors.cyan}${colors.bright}🎉 Verb Successfully Installed!${colors.reset}

${colors.bright}Quick Start:${colors.reset}
${colors.green}import { createServer } from "verb";

const app = createServer();
app.get("/", (req, res) => res.json({ message: "Hello Verb!" }));
app.listen(3000);${colors.reset}

${colors.bright}Run your server:${colors.reset}
${colors.green}bun run server.ts${colors.reset}

${colors.bright}Available Features:${colors.reset}
• 🚀 Multi-protocol servers (HTTP, WebSocket, gRPC, UDP, TCP)
• ⚡ High-performance routing and middleware  
• 🔒 Built-in security features
• 📦 HTML imports and frontend bundling
• 🔄 Hot Module Reloading (HMR)
• 🎯 TypeScript-first with complete type safety
`);

  if (runtime !== 'bun') {
    console.log(`${colors.yellow}${colors.bright}⚠️  Important Notice:${colors.reset}
You're currently running with ${runtime}, but Verb is optimized for Bun runtime.

${colors.bright}For best performance and full feature support:${colors.reset}
1. Install Bun: ${colors.blue}https://bun.sh${colors.reset}
2. Run with Bun: ${colors.green}bun run your-server.ts${colors.reset}

${colors.bright}Some features require Bun:${colors.reset}
• HTML imports and bundling
• WebSocket pub/sub
• Optimized file serving  
• Native HTTP/2 support
`);
  } else {
    console.log(`${colors.green}${colors.bright}✅ Perfect! You're using Bun runtime.${colors.reset}
All Verb features are available and optimized for maximum performance.
`);
  }

  console.log(`${colors.bright}Documentation:${colors.reset}
• 📚 Getting Started: ${colors.blue}https://github.com/wess/verb#readme${colors.reset}
• 🔗 API Reference: Check the llm.txt file for comprehensive docs
• 💡 Examples: See the examples/ directory

${colors.bright}Community:${colors.reset}
• 🐛 Issues: ${colors.blue}https://github.com/wess/verb/issues${colors.reset}
• 💬 Discussions: ${colors.blue}https://github.com/wess/verb/discussions${colors.reset}

Happy coding with Verb! 🚀
`);
}

// Skip in CI or test environments
if (process.env.CI !== 'true' && process.env.NODE_ENV !== 'test') {
  main();
}