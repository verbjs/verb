#!/usr/bin/env bun
import { resolve } from 'path';
import { existsSync } from 'fs';
import { dev } from './core/dev';
import { build } from './core/build';
import { preview } from './core/preview';

const args = process.argv.slice(2);
const command = args[0];
const cwd = process.cwd();

// Default config file path
const configPath = resolve(cwd, 'ledger.config.ts');

async function main() {
  // Check if config file exists
  if (!existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.log('Create a ledger.config.ts file in your project root.');
    process.exit(1);
  }

  // Import config
  const config = await import(configPath);
  
  // Execute command
  switch (command) {
    case 'dev':
      await dev(config.default);
      break;
    case 'build':
      await build(config.default);
      break;
    case 'preview':
      await preview(config.default);
      break;
    default:
      console.log('Usage: ledger [dev|build|preview]');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});