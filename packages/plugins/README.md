# @verb/plugins

Official plugin registry for the Verb library.

## Installation

```bash
bun add @verb/plugins
```

## Available Plugins

### React Renderer Plugin

Server-side rendering for React components with caching and streaming support.

```typescript
import { createServer } from "@verb/server";
import { createReactRendererPlugin } from "@verb/plugins";

const server = createServer();

// Add React renderer plugin
server.use(createReactRendererPlugin({
  cache: true,
  maxCacheSize: 100,
  defaultOptions: {
    hydrate: true,
    title: "My App"
  }
}));

// Use React components in routes
server.get("/", () => {
  return reactComponent(<MyComponent />, {
    title: "Home Page",
    status: 200
  });
});
```

#### Configuration Options

- `enabled` - Enable/disable the plugin (default: true)
- `cache` - Cache rendered components (default: true)
- `maxCacheSize` - Maximum number of cached components (default: 100)
- `defaultTemplate` - HTML template function or string
- `defaultOptions` - Default render options

#### Render Options

- `status` - HTTP status code
- `headers` - Custom headers
- `title` - Document title
- `meta` - Meta tags array
- `styles` - CSS file links
- `scripts` - JavaScript file links
- `inlineStyles` - Inline CSS
- `inlineScripts` - Inline JavaScript
- `stream` - Use streaming rendering
- `hydrate` - Enable client-side hydration
- `template` - Custom template
- `props` - Props for hydration
- `cacheKey` - Custom cache key

## Contributing

This is the official plugin registry for Verb. To contribute a new plugin:

1. Create a new directory under `src/` for your plugin
2. Implement your plugin following the Plugin interface
3. Export it from the main index file
4. Add documentation and tests
5. Submit a pull request

## Plugin Development

See the [Verb documentation](https://verb.dev/server/plugins) for detailed plugin development guidelines.