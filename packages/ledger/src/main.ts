// Export core functionality
export { dev } from './core/dev';
export { build } from './core/build';
export { preview } from './core/preview';

// Export types
export * from './core/types';

// Export components
export { App } from './components/App';
export { Layout } from './components/Layout';
export { Page } from './components/Page';
export { Sidebar } from './components/Sidebar';
export { Navbar } from './components/Navbar';

// Export utilities
export { processMarkdown } from './utils/markdown';
export { generateRoutes } from './utils/routes';

// CLI entry point
if (import.meta.main) {
  const { default: cli } = await import('./cli');
  cli();
}