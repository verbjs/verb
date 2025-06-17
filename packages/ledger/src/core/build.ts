import { resolve, relative, dirname } from 'path';
import { SiteConfig, BuildOptions } from './types';
import { processMarkdown } from '../utils/markdown';
import { glob } from 'glob';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { generateRoutes } from '../utils/routes';

export async function build(config: SiteConfig) {
  const options: BuildOptions = {
    outDir: resolve(process.cwd(), config.outDir || 'dist'),
    srcDir: resolve(process.cwd(), config.srcDir || 'docs'),
    base: config.base || '/',
    config
  };

  console.log(`Building site...`);
  console.log(`Source directory: ${options.srcDir}`);
  console.log(`Output directory: ${options.outDir}`);

  try {
    // Create output directory
    mkdirSync(options.outDir, { recursive: true });

    // Find all markdown files
    const files = await glob(`${options.srcDir}/**/*.md`);
    
    console.log(`Found ${files.length} markdown files`);
    
    // Process each file
    const pages = await Promise.all(files.map(async (file) => {
      const content = readFileSync(file, 'utf-8');
      const relativePath = relative(options.srcDir, file);
      const { html, data } = await processMarkdown(content);
      
      // Create output file path
      const outputPath = resolve(options.outDir, relativePath.replace(/\.md$/, '.html'));
      
      // Create directory if it doesn't exist
      mkdirSync(dirname(outputPath), { recursive: true });
      
      // Write HTML file
      writeFileSync(outputPath, html);
      
      return {
        path: relativePath.replace(/\.md$/, '.html'),
        content: html,
        data
      };
    }));

    // Generate routes
    const routes = generateRoutes(pages, options.config);
    
    // Create client entry point
    const clientEntry = `
      // Simple client-side rendering script
      document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('app');
        const routes = window.__LEDGER_ROUTES__;
        const config = window.__LEDGER_CONFIG__;
        
        // Find the current route
        const path = window.location.pathname;
        const route = routes.find(r => r.path === path) || routes.find(r => r.path === '/index');
        
        if (route) {
          // Set document title
          document.title = route.meta.title || config.title;
          
          // Create page header
          const header = document.createElement('header');
          header.innerHTML = \`
            <h1>\${route.meta.title || ''}</h1>
            <p>\${route.meta.description || ''}</p>
          \`;
          
          // Create content container
          const content = document.createElement('div');
          content.id = 'content';
          
          // Fetch the HTML content
          fetch('/' + route.component)
            .then(response => response.text())
            .then(html => {
              content.innerHTML = html;
              
              // Create page layout
              app.innerHTML = '';
              app.appendChild(header);
              app.appendChild(content);
            })
            .catch(error => {
              console.error('Error loading content:', error);
              content.innerHTML = '<p>Error loading content</p>';
            });
        } else {
          app.innerHTML = '<h1>Page not found</h1>';
        }
      });
    `;

    // Write client entry
    writeFileSync(`${options.outDir}/client.js`, clientEntry);
    
    // Write routes
    writeFileSync(
      `${options.outDir}/routes.js`,
      `export const routes = ${JSON.stringify(routes, null, 2)};`
    );
    
    // Write config
    writeFileSync(
      `${options.outDir}/config.js`,
      `export const siteConfig = ${JSON.stringify(options.config, null, 2)};`
    );
    
    // Create index.html
    const indexHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.config.title}</title>
        <meta name="description" content="${options.config.description}">
        ${(options.config.head || []).map(item => {
          if (item.content) {
            return `<${item.tag}${Object.entries(item.attrs || {}).map(([key, value]) => ` ${key}="${value}"`).join('')}>${item.content}</${item.tag}>`;
          } else {
            return `<${item.tag}${Object.entries(item.attrs || {}).map(([key, value]) => ` ${key}="${value}"`).join('')} />`;
          }
        }).join('\n        ')}
        <script>
          window.__LEDGER_ROUTES__ = ${JSON.stringify(routes)};
          window.__LEDGER_CONFIG__ = ${JSON.stringify(options.config)};
        </script>
        <script type="module" src="/client.js"></script>
      </head>
      <body>
        <div id="app"></div>
      </body>
      </html>
    `;
    
    writeFileSync(`${options.outDir}/index.html`, indexHtml);
    
    console.log(`Build complete!`);
    
  } catch (error) {
    console.error('Error building site:', error);
    process.exit(1);
  }
}