import { resolve } from 'path';
import { SiteConfig, PreviewOptions } from './types';

export async function preview(config: SiteConfig) {
  const options: PreviewOptions = {
    outDir: resolve(process.cwd(), config.outDir || 'dist'),
    srcDir: resolve(process.cwd(), config.srcDir || 'docs'),
    base: config.base || '/',
    config,
    port: 3000,
    host: 'localhost'
  };

  console.log(`Starting preview server...`);
  console.log(`Serving files from: ${options.outDir}`);
  
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
            return new Response(file);
          }
        } catch (error) {
          console.error(`Error serving file: ${error}`);
        }
      }
      
      // Fallback to index.html for SPA routing
      try {
        const indexPath = resolve(options.outDir, 'index.html');
        const file = Bun.file(indexPath);
        return new Response(file);
      } catch (error) {
        console.error(`Error serving index.html: ${error}`);
        return new Response('Not found', { status: 404 });
      }
    }
  });

  console.log(`Server running at http://${options.host}:${options.port}`);

  // Handle process termination
  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
}