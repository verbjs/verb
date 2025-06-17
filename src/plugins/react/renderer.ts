import { createPlugin, type Plugin, type PluginContext } from "../../plugin.ts";
import { html } from "../../response.ts";

// Import React and ReactDOMServer
// Note: These would need to be added as dependencies
import type React from "react";
import ReactDOMServer from "react-dom/server";

// React renderer configuration
export interface ReactRendererConfig {
  /** Enable React rendering (default: true) */
  enabled: boolean;
  /** Default document template (default: basic HTML5 template) */
  defaultTemplate: string | ((content: string, options: RenderOptions) => string);
  /** Cache rendered components (default: true) */
  cache: boolean;
  /** Maximum cache size (default: 100) */
  maxCacheSize: number;
  /** Default render options */
  defaultOptions: Partial<RenderOptions>;
}

// Render options for React components
export interface RenderOptions {
  /** HTTP status code */
  status?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Document title */
  title?: string;
  /** Meta tags */
  meta?: Array<Record<string, string>>;
  /** CSS links */
  styles?: string[];
  /** JavaScript scripts */
  scripts?: string[];
  /** Inline CSS */
  inlineStyles?: string;
  /** Inline JavaScript */
  inlineScripts?: string;
  /** Use streaming rendering */
  stream?: boolean;
  /** Enable client-side hydration */
  hydrate?: boolean;
  /** Custom document template */
  template?: string | ((content: string, options: RenderOptions) => string);
  /** Props to serialize for hydration */
  props?: any;
  /** Custom cache key */
  cacheKey?: string;
}

// Default HTML template
const DEFAULT_TEMPLATE = (content: string, options: RenderOptions): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${options.title ? `<title>${options.title}</title>` : ""}
  ${options.meta?.map(meta => `<meta ${Object.entries(meta).map(([k, v]) => `${k}="${v}"`).join(" ")}>`).join("\n  ") || ""}
  ${options.styles?.map(href => `<link rel="stylesheet" href="${href}">`).join("\n  ") || ""}
  ${options.inlineStyles ? `<style>${options.inlineStyles}</style>` : ""}
</head>
<body>
  <div id="root">${content}</div>
  ${options.hydrate && options.props ? `<script>window.__INITIAL_PROPS__ = ${JSON.stringify(options.props)};</script>` : ""}
  ${options.scripts?.map(src => `<script src="${src}"></script>`).join("\n  ") || ""}
  ${options.inlineScripts ? `<script>${options.inlineScripts}</script>` : ""}
</body>
</html>
`.trim();

// Default configuration
const defaultConfig: ReactRendererConfig = {
  enabled: true,
  defaultTemplate: DEFAULT_TEMPLATE,
  cache: true,
  maxCacheSize: 100,
  defaultOptions: {
    status: 200,
    hydrate: false,
    stream: false,
  },
};

// Component render cache
const renderCache = new Map<string, string>();

// React renderer plugin
export const createReactRendererPlugin = (config?: Partial<ReactRendererConfig>): Plugin => {
  const mergedConfig = { ...defaultConfig, ...config };
  
  return createPlugin(
    {
      name: "react-renderer",
      version: "1.0.0",
      description: "React server-side rendering for Verb",
      tags: ["react", "rendering", "ssr"],
    },
    async (context: PluginContext) => {
      if (!mergedConfig.enabled) {
        context.log("React renderer is disabled, skipping initialization");
        return;
      }
      
      // Render React component to string
      const renderToString = (
        component: React.ReactElement,
        options: RenderOptions = {}
      ): string => {
        const mergedOptions = { ...mergedConfig.defaultOptions, ...options };
        
        // Generate cache key if caching is enabled
        let cacheKey: string | undefined;
        if (mergedConfig.cache && !mergedOptions.stream) {
          cacheKey = mergedOptions.cacheKey || 
            `react:${component.type.name}:${JSON.stringify(component.props)}:${JSON.stringify(mergedOptions)}`;
          
          // Check cache
          const cached = renderCache.get(cacheKey);
          if (cached) {
            return cached;
          }
        }
        
        // Render component to string
        let content: string;
        try {
          content = ReactDOMServer.renderToString(component);
        } catch (error) {
          context.log(`Error rendering React component: ${error.message}`);
          content = `<div class="react-error">Error rendering component: ${error.message}</div>`;
        }
        
        // Apply template
        const template = mergedOptions.template || mergedConfig.defaultTemplate;
        const html = typeof template === 'function' 
          ? template(content, mergedOptions)
          : template.replace('{{content}}', content);
        
        // Cache result if caching is enabled
        if (mergedConfig.cache && cacheKey && !mergedOptions.stream) {
          if (renderCache.size >= mergedConfig.maxCacheSize) {
            // Clear oldest entry if cache is full
            const firstKey = renderCache.keys().next().value;
            renderCache.delete(firstKey);
          }
          renderCache.set(cacheKey, html);
        }
        
        return html;
      };
      
      // Render React component to stream
      const renderToStream = (
        component: React.ReactElement,
        options: RenderOptions = {}
      ): ReadableStream => {
        const _mergedOptions = { ...mergedConfig.defaultOptions, ...options };
        
        try {
          // Create a stream from ReactDOMServer
          const nodeStream = ReactDOMServer.renderToNodeStream(component);
          
          // Convert Node.js stream to Web stream
          return new ReadableStream({
            start(controller) {
              nodeStream.on('data', chunk => {
                controller.enqueue(chunk);
              });
              
              nodeStream.on('end', () => {
                controller.close();
              });
              
              nodeStream.on('error', err => {
                controller.error(err);
              });
            }
          });
        } catch (error) {
          context.log(`Error creating React stream: ${error.message}`);
          
          // Return error stream
          const encoder = new TextEncoder();
          return new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(
                `<div class="react-error">Error rendering component: ${error.message}</div>`
              ));
              controller.close();
            }
          });
        }
      };
      
      // Create response from React component
      const react = (
        component: React.ReactElement,
        options: RenderOptions = {}
      ): Response => {
        const mergedOptions = { ...mergedConfig.defaultOptions, ...options };
        const status = mergedOptions.status || 200;
        const headers = {
          "Content-Type": "text/html",
          ...mergedOptions.headers,
        };
        
        // Use streaming if requested
        if (mergedOptions.stream) {
          const stream = renderToStream(component, mergedOptions);
          return new Response(stream, { status, headers });
        }
        
        // Otherwise use string rendering
        const content = renderToString(component, mergedOptions);
        return new Response(content, { status, headers });
      };
      
      // Register services
      context.registerService("react:renderToString", renderToString);
      context.registerService("react:renderToStream", renderToStream);
      context.registerService("react:render", react);
      
      // Add to global response helpers
      if (typeof globalThis !== "undefined") {
        (globalThis as any).reactComponent = react;
      }
      
      context.log("React renderer initialized successfully");
    }
  );
};

// Export a function to clear the render cache (useful for testing)
export const clearRenderCache = (): void => {
  renderCache.clear();
};