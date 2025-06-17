import { resolve, relative, dirname } from 'path';
import { SiteConfig, DevOptions } from './types';
import { processMarkdown } from '../utils/markdown';
import { glob } from 'glob';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { generateRoutes } from '../utils/routes';

export async function dev(config: SiteConfig) {
  const options: DevOptions = {
    outDir: resolve(process.cwd(), config.outDir || 'dist'),
    srcDir: resolve(process.cwd(), config.srcDir || 'docs'),
    base: config.base || '/',
    config,
    port: 3000,
    host: 'localhost'
  };

  console.log(`Starting development server...`);
  console.log(`Source directory: ${options.srcDir}`);
  
  // Create server
  const server = Bun.serve({
    port: options.port,
    hostname: options.host,
    async fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;
      
      // Handle root path
      if (path === '/') {
        path = '/index.html';
      }
      
      // Handle direct file access
      if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
        try {
          const filePath = resolve(options.outDir, path.slice(1));
          const file = Bun.file(filePath);
          const exists = await file.exists();
          
          if (exists) {
            // Set the correct content type
            const headers = new Headers();
            if (path.endsWith('.html')) {
              headers.set('Content-Type', 'text/html');
            } else if (path.endsWith('.js')) {
              headers.set('Content-Type', 'application/javascript');
            } else if (path.endsWith('.css')) {
              headers.set('Content-Type', 'text/css');
            }
            
            return new Response(file, { headers });
          }
        } catch (error) {
          console.error(`Error serving file: ${error}`);
        }
      }
      
      // Fallback to index.html for SPA routing
      try {
        const indexPath = resolve(options.outDir, 'index.html');
        const file = Bun.file(indexPath);
        const headers = new Headers();
        headers.set('Content-Type', 'text/html');
        return new Response(file, { headers });
      } catch (error) {
        console.error(`Error serving index.html: ${error}`);
        return new Response('Not found', { status: 404 });
      }
    }
  });

  console.log(`Server running at http://${options.host}:${options.port}`);

  // Initial build
  await buildSite(options);

  // Set up a simple polling mechanism for file changes
  console.log(`Watching for changes in ${options.srcDir}`);
  
  let lastBuildTime = Date.now();
  
  // Poll for changes every second
  const watchInterval = setInterval(async () => {
    try {
      // Get the latest modification time of markdown files
      const files = await glob(`${options.srcDir}/**/*.md`);
      const configFile = `${process.cwd()}/ledger.config.ts`;
      
      // Check if any files have been modified since the last build
      let needsRebuild = false;
      
      // Check config file
      const configExists = await Bun.file(configFile).exists();
      if (configExists) {
        const stat = await Bun.file(configFile).stat();
        if (stat && stat.mtime && stat.mtime > lastBuildTime) {
          console.log(`Config file changed`);
          needsRebuild = true;
        }
      }
      
      // Check markdown files
      if (!needsRebuild) {
        for (const file of files) {
          const stat = await Bun.file(file).stat();
          if (stat && stat.mtime && stat.mtime > lastBuildTime) {
            console.log(`File changed: ${file}`);
            needsRebuild = true;
            break;
          }
        }
      }
      
      if (needsRebuild) {
        await buildSite(options);
        console.log('Rebuilt site');
        lastBuildTime = Date.now();
      }
    } catch (error) {
      console.error('Error checking for file changes:', error);
    }
  }, 1000);

  // Handle process termination
  process.on('SIGINT', () => {
    clearInterval(watchInterval);
    server.stop();
    process.exit(0);
  });
}

async function buildSite(options: DevOptions) {
  try {
    // Create output directory
    mkdirSync(options.outDir, { recursive: true });

    // Find all markdown files
    const files = await glob(`${options.srcDir}/**/*.md`);
    
    // Process each file
    const pages = await Promise.all(files.map(async (file) => {
      const content = readFileSync(file, 'utf-8');
      const relativePath = relative(options.srcDir, file);
      const { html, data } = await processMarkdown(content);
      
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
    
  } catch (error) {
    console.error('Error building site:', error);
  }
}