---
title: API Reference
description: Complete reference documentation for the Verb library
---

# Verb API Reference

Welcome to the Verb API Reference. This section provides comprehensive documentation for all the APIs and components in the Verb library.

## Core Components

The Verb library consists of several core components:

### [Server API](/api-reference/server)

The Server API is the foundation of Verb, providing a high-performance HTTP server with routing, middleware, and various utilities for building web applications.

Key features:
- HTTP/1.1 and HTTP/2 server creation
- WebSocket support
- UDP server support
- Request and response handling
- Streaming responses
- File serving

[View Server API Reference →](/api-reference/server)

### [Router API](/api-reference/router)

The Router API handles URL routing, matching HTTP requests to handlers, and executing middleware.

Key features:
- Manual and filesystem-based routing
- Dynamic route parameters
- Route pattern matching
- Middleware integration
- Application mounting

[View Router API Reference →](/api-reference/router)

### [Middleware & Plugins API](/api-reference/middleware-plugins)

The Middleware & Plugins API allows extending the functionality of Verb applications with reusable components.

Key features:
- Middleware system
- Plugin architecture
- Built-in middleware
- Custom middleware creation
- Plugin lifecycle hooks

[View Middleware & Plugins API Reference →](/api-reference/middleware-plugins)

### [Security API](/api-reference/security)

The Security API provides features to secure your Verb applications against common web vulnerabilities.

Key features:
- Security headers
- CSRF protection
- Input sanitization
- Rate limiting
- Error handling
- Schema validation

[View Security API Reference →](/api-reference/security)

## API Organization

The Verb API is organized into logical groups:

1. **Server Creation and Configuration**: Functions for creating and configuring HTTP servers
2. **Request Handling**: Functions for parsing and processing HTTP requests
3. **Response Generation**: Functions for creating various types of HTTP responses
4. **Routing**: Functions for defining routes and handling URL patterns
5. **Middleware**: Functions for processing requests and responses
6. **Security**: Functions for securing applications against common vulnerabilities
7. **Plugins**: Functions for extending application functionality

## Using the API Reference

Each API reference page includes:

- **Function signatures**: The TypeScript type definitions for each function
- **Parameters**: Detailed descriptions of function parameters
- **Return values**: What each function returns
- **Examples**: Code examples showing how to use the function
- **Related functions**: Links to related functions and concepts

## API Stability

Verb follows semantic versioning:

- **Stable APIs**: Functions exported from the main entry points are stable and follow semver
- **Experimental APIs**: Functions marked as experimental may change between minor versions
- **Internal APIs**: Functions not documented in the API reference are considered internal and may change at any time

## API Versioning

The API reference always documents the latest version of Verb. For previous versions, refer to the documentation for that specific version.

## Contributing to the API Reference

If you find any issues or have suggestions for improving the API reference, please [open an issue](https://github.com/verb/verb/issues) or submit a pull request.

## Next Steps

- [Getting Started](/getting-started/quick-start): Learn how to create your first Verb application
- [Guides](/guides): Explore guides for common tasks and patterns
- [Examples](/examples): See example applications built with Verb