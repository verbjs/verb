#!/usr/bin/env bun

/**
 * Verb Package Manager Enforcement Script
 * 
 * This script ensures that Verb is only installed and used with Bun,
 * as the framework is built specifically for Bun runtime and uses
 * Bun-specific APIs that are not available in Node.js.
 */

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m',
  reset: '\x1b[0m'
};

function printError(message: string) {
  console.error(`${colors.red}${colors.bright}❌ ${message}${colors.reset}`);
}

function printSuccess(message: string) {
  console.log(`${colors.green}${colors.bright}✅ ${message}${colors.reset}`);
}

function printWarning(message: string) {
  console.warn(`${colors.yellow}${colors.bright}⚠️  ${message}${colors.reset}`);
}

function printInfo(message: string) {
  console.log(`${colors.blue}${colors.bright}ℹ️  ${message}${colors.reset}`);
}

function printHeader(message: string) {
  console.log(`${colors.cyan}${colors.bright}🔧 ${message}${colors.reset}`);
}

function detectPackageManager(): string {
  // Check npm_config_user_agent which is set by package managers
  const userAgent = process.env.npm_config_user_agent || '';
  
  if (userAgent.includes('bun')) {
    return 'bun';
  } else if (userAgent.includes('npm')) {
    return 'npm';
  } else if (userAgent.includes('yarn')) {
    return 'yarn';
  } else if (userAgent.includes('pnpm')) {
    return 'pnpm';
  }
  
  // Fallback: check npm_execpath
  const execPath = process.env.npm_execpath || '';
  if (execPath.includes('bun')) {
    return 'bun';
  } else if (execPath.includes('npm')) {
    return 'npm';
  } else if (execPath.includes('yarn')) {
    return 'yarn';
  } else if (execPath.includes('pnpm')) {
    return 'pnpm';
  }
  
  // Check if we're running under Bun
  if (typeof Bun !== 'undefined') {
    return 'bun';
  }
  
  return 'unknown';
}

function showInstallationInstructions() {
  console.log(`
${colors.cyan}${colors.bright}📦 Verb Installation Instructions${colors.reset}

${colors.bright}1. Install Bun (if not already installed):${colors.reset}
   ${colors.green}curl -fsSL https://bun.sh/install | bash${colors.reset}
   
   Or visit: ${colors.blue}https://bun.sh${colors.reset}

${colors.bright}2. Install Verb with Bun:${colors.reset}
   ${colors.green}bun add verb${colors.reset}

${colors.bright}3. Use Verb in your project:${colors.reset}
   ${colors.green}import { createServer } from "verb";
   
   const app = createServer();
   app.get("/", (req, res) => res.json({ message: "Hello Bun!" }));
   app.listen(3000);${colors.reset}

${colors.bright}4. Run with Bun:${colors.reset}
   ${colors.green}bun run server.ts${colors.reset}

${colors.yellow}${colors.bright}Why Bun Only?${colors.reset}
• Verb uses Bun's native APIs (Bun.serve, Bun.file, etc.)
• Optimized for Bun's performance characteristics  
• HTML imports and frontend bundling require Bun
• WebSocket and HTTP/2 implementations use Bun-specific features
`);
}

function main() {
  printHeader("Verb Package Manager Check");
  
  const packageManager = detectPackageManager();
  
  if (packageManager === 'bun') {
    printSuccess("Using Bun - perfect! 🚀");
    printInfo("Verb is optimized for Bun and will run at peak performance.");
    return;
  }
  
  // Not using Bun - show error and exit
  printError("Verb requires Bun as the package manager and runtime!");
  console.log("");
  
  if (packageManager !== 'unknown') {
    printWarning(`Detected package manager: ${packageManager}`);
    console.log("");
  }
  
  printError("Verb is built specifically for Bun and uses Bun-native APIs that");
  printError("are not available in Node.js environments (npm, yarn, pnpm).");
  console.log("");
  
  printInfo("Features requiring Bun:");
  console.log(`  ${colors.yellow}•${colors.reset} Native HTTP/WebSocket/HTTP2 servers`);
  console.log(`  ${colors.yellow}•${colors.reset} HTML imports and frontend bundling`);
  console.log(`  ${colors.yellow}•${colors.reset} Bun.file() for optimized file handling`);
  console.log(`  ${colors.yellow}•${colors.reset} Bun.serve() for maximum performance`);
  console.log(`  ${colors.yellow}•${colors.reset} Hot Module Reloading (HMR)`);
  console.log("");
  
  showInstallationInstructions();
  
  // Exit with error code to prevent installation
  process.exit(1);
}

// Only run the check if this is an actual install (not during development)
// Skip check if we're in a CI environment or if explicitly disabled
const skipCheck = process.env.VERB_SKIP_PACKAGE_MANAGER_CHECK === 'true' ||
                  process.env.CI === 'true' ||
                  process.env.NODE_ENV === 'test';

if (skipCheck) {
  printWarning("Package manager check skipped (CI or test environment)");
} else {
  main();
}