# Changelog

All notable changes to Verb will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-12-01

### Changed
- **Simplified Router Architecture** - Consolidated 5 router files (~920 lines) into single `router.ts` (128 lines)
- **Unified Server Base** - Protocol servers now share `base.ts` for common HTTP handling, reducing duplication from ~2400 lines to ~450 lines
- Protocol-specific servers (HTTP, HTTPS, HTTP/2, WebSocket) are now thin wrappers around shared base

### Removed
- Express-style `Router()` factory for mounting sub-routers (use path middleware instead)
- Route namespacing and grouping (`namespace()`, `routeGroup()`)
- Global route caching with mutable state
- `showRoutes` / `logRoutes` debug feature
- Duplicate path-to-regex implementations

### Fixed
- URL-encoded route parameters now properly decoded (e.g., `%40` → `@`)

### Documentation
- Added `docs/book/` - Complete tutorial for building a blog with Verb

## [1.0.0] - 2025-07-10

### Added
- 🎉 Initial release of Verb
- 🌐 Multi-protocol server support (HTTP, HTTPS, HTTP/2, WebSocket, gRPC, UDP, TCP)
- 🎯 Bun-native implementation with optimized APIs
- 📦 Fullstack development with HTML imports and frontend bundling
- 🔒 Built-in security features (CORS, rate limiting, security headers)
- ⚡ High-performance optimizations:
  - Route precompilation and caching (1000+ matches/ms)
  - Schema-based JSON validation (sub-millisecond validation)
  - Optimized header parsing with LRU caching
  - Ultra-fast query string parsing (10,000+ ops/ms)
- 📝 Complete TypeScript support with comprehensive type definitions
- 🛠️ Complete middleware system (global, path-specific, route-specific)
- 🎭 Advanced routing features:
  - Regex parameters
  - Wildcard routes
  - Route arrays and chaining
  - Multiple handler support
- 🔧 Application configuration system with environment detection
- 📁 File upload support with streaming and validation
- 🧪 Content negotiation (Accept headers, encoding, language)
- 🏗️ Sub-applications and virtual host support
- 🔍 Development tools and debugging features
- 📚 Comprehensive documentation and examples
- 🚫 Bun-only enforcement with helpful error messages
- 🔄 Version management scripts

### Core APIs
- `createServer()` - Main server creation function
- `createUnifiedServer()` - Multi-protocol server
- `createProtocolGateway()` - Runtime protocol switching
- `server.http()`, `server.websocket()`, etc. - Fluent API
- `app.withRoutes()` - Bun native routes for fullstack development
- `app.withOptions()` - Server configuration

### Built-in Middleware
- JSON body parsing with schema validation
- URL-encoded form parsing
- Raw and text body parsing
- Static file serving
- CORS with origin validation
- Rate limiting with configurable strategies
- Security headers (Helmet-like functionality)
- File upload handling with progress tracking

### Protocol Features
- **HTTP/HTTPS**: Standard web server with Express.js-like API
- **HTTP/2**: Multiplexing with server push support
- **WebSocket**: Real-time communication with pub/sub
- **gRPC**: Service definitions and method handlers
- **UDP**: Message handling with connection management
- **TCP**: Socket connections with data streaming

### Performance Features
- Route precompilation for maximum matching speed
- JSON schema optimization for validation and serialization
- LRU caching for headers, queries, and schemas
- Memory-efficient streaming for file uploads
- Optimized parsing algorithms throughout

### Developer Experience
- Hot Module Reloading (HMR) support
- Route debugging with colorized output
- Performance monitoring and metrics
- Health check endpoints
- Comprehensive error handling with custom pages
- TypeScript-first development

### Documentation
- Complete API reference in llm.txt
- Examples for all major features
- Best practices and patterns
- Deployment guides
- Performance optimization tips

## [Unreleased]

### Planned Features
- WebRTC support
- Server-Sent Events (SSE)
- Database integrations
- Authentication providers
- Caching layers
- Monitoring and observability
- Plugin system

---

For migration guides and breaking changes, see [MIGRATION.md](MIGRATION.md)