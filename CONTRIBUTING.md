# Contributing to Verb

Thank you for your interest in contributing to Verb! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

- **Bun** v1.0.0 or later
- **Git** for version control

### Quick Setup

```bash
# Clone the core framework repository
git clone https://github.com/wess/verb.git
cd verb

# Install dependencies
bun install

# Run tests
bun test

# Build the framework
bun run build
```

## Development Setup

### Repository Structure

This repository contains the core Verb framework:

```
verb/
├── src/                    # Core framework source code
├── tests/                 # Framework test suites
├── benchmarks/           # Performance benchmarks
├── examples/              # Basic usage examples
├── types/                # TypeScript type definitions
└── dist/                 # Built framework (generated)
```

### Environment Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/verb.git
   cd verb
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/wess/verb.git
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## How to Contribute

### Types of Contributions

We welcome several types of contributions:

#### 🐛 Bug Reports
- Use the bug report template
- Include minimal reproduction steps
- Provide environment details (Bun version, OS, etc.)
- Check existing issues to avoid duplicates

#### ✨ Feature Requests
- Use the feature request template
- Explain the use case and benefits
- Consider backward compatibility
- Discuss in issues before implementing large features

#### 📝 Documentation
- Fix typos and improve clarity in README and JSDoc comments
- Add examples and use cases for framework features
- Update API documentation in source code
- Improve inline code documentation

#### 🧪 Code Contributions
- Bug fixes
- Performance improvements
- New features (after discussion)
- Test coverage improvements

### Before You Start

1. **Check existing issues** for duplicates
2. **Discuss major changes** in GitHub issues first
3. **Read the code of conduct**
4. **Ensure tests pass** locally

## Pull Request Process

### 1. Preparation

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/description
```

### 2. Development

- Write clean, documented code
- Follow existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Testing

```bash
# Run all tests
bun test

# Run specific test suite
bun test src/server.test.ts

# Run benchmarks (if applicable)
bun run benchmark
```

### 4. Documentation

- Update README if needed
- Add JSDoc comments for new APIs
- Update inline code documentation
- Add usage examples in the examples/ directory

### 5. Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: type(scope): description
git commit -m "feat(server): add HTTP/3 support"
git commit -m "fix(routing): handle edge case in parameter parsing"
git commit -m "docs(api): update createServer examples"
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions/changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

### 6. Submission

```bash
# Push your branch
git push origin feature/description

# Create pull request on GitHub
# Fill out the PR template completely
```

## Code Standards

### TypeScript Guidelines

- Use strict TypeScript settings
- Prefer functional programming patterns
- Avoid `any` types - use proper typing
- Export interfaces and types properly

```typescript
// ✅ Good
interface ServerOptions {
  port: number;
  host?: string;
}

const createServer = (options: ServerOptions): Server => {
  // Implementation
};

// ❌ Avoid
const createServer = (options: any) => {
  // Implementation
};
```

### Code Style

- Use 2 spaces for indentation
- Prefer `const` over `let`
- Use descriptive variable names
- Keep functions small and focused
- Add JSDoc comments for public APIs

```typescript
/**
 * Creates a new Verb server instance
 * @param protocol - The protocol to use (default: HTTP)
 * @param options - Server configuration options
 * @returns A new server instance
 */
export const createServer = (
  protocol: ServerProtocol = ServerProtocol.HTTP,
  options: ServerOptions = {}
): VerbServer => {
  return new VerbServer(protocol, options);
};
```

### Performance Considerations

- Benchmark performance-critical changes
- Use Bun's native APIs when available
- Avoid unnecessary allocations in hot paths
- Profile memory usage for long-running tests

## Testing

### Test Structure

```typescript
// tests/server.test.ts
import { describe, it, expect } from "bun:test";
import { createServer } from "../src/index";

describe("Server Creation", () => {
  it("should create HTTP server by default", () => {
    const server = createServer();
    expect(server.protocol).toBe("HTTP");
  });

  it("should accept custom protocol", () => {
    const server = createServer(ServerProtocol.WEBSOCKET);
    expect(server.protocol).toBe("WEBSOCKET");
  });
});
```

### Test Requirements

- **Unit tests** for all new functions
- **Integration tests** for new features
- **Performance tests** for critical paths
- **Error handling tests** for edge cases

### Running Tests

```bash
# All tests
bun test

# Watch mode
bun test --watch

# Coverage report
bun test --coverage

# Specific pattern
bun test --match="*server*"
```

## Documentation

### API Documentation

- Use JSDoc comments for all public APIs
- Include usage examples in comments
- Document parameters and return types
- Note any side effects or limitations

### Code Examples

Add usage examples in the `examples/` directory:

```bash
# Create a new example
mkdir examples/my-feature
cd examples/my-feature

# Create example files
touch index.ts package.json README.md
```

### Documentation Standards

- Use clear, concise language
- Include practical examples that run without external dependencies
- Keep examples up-to-date with API changes
- Test all code examples with `bun run`

## Community Guidelines

### Communication

- Be respectful and inclusive
- Provide constructive feedback
- Help other contributors
- Share knowledge and experiences

### Getting Help

- **GitHub Issues**: Bug reports and feature requests for the core framework
- **GitHub Discussions**: Questions about framework development and usage
- **Discord**: Real-time community support

### Recognition

Contributors are recognized in:
- Release notes for significant framework contributions
- Framework README contributors section
- GitHub contributor graphs

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

### Release Checklist

For maintainers releasing new framework versions:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run full test suite and benchmarks
4. Build framework: `bun run build`
5. Create release PR
6. Tag release after merge
7. Publish to npm

## Advanced Contributions

### Benchmarking

When making performance-related changes:

```bash
# Run baseline benchmarks
bun run benchmark:baseline

# Make your changes
# ...

# Run comparison benchmarks
bun run benchmark:compare
```

### Cross-Runtime Testing

Test changes across different runtimes:

```bash
# Test with Bun
bun test

# Test with Node.js (compatibility)
npm test

# Test with Deno (if applicable)
deno test
```

### Protocol Implementation

When adding new protocol support:

1. Create protocol-specific implementation
2. Add comprehensive tests
3. Update documentation
4. Add examples
5. Benchmark performance

## Troubleshooting

### Common Issues

**Tests failing locally:**
```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install
bun test
```

**TypeScript errors:**
```bash
# Check TypeScript version
bun --version
tsc --version

# Regenerate types
bun run build:types
```

**Benchmark inconsistencies:**
- Run benchmarks multiple times
- Ensure no other processes are consuming resources
- Use consistent hardware for comparisons

## Questions?

If you have questions about contributing:

1. Check existing GitHub issues and discussions
2. Join our Discord community
3. Create a new GitHub discussion
4. Reach out to maintainers

Thank you for contributing to Verb! 🚀