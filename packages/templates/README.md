# @verb/templates

Official templates for the Verb library CLI. These templates provide starting points for different types of Verb applications.

## Available Templates

### auth-demo
A comprehensive authentication demonstration template featuring:
- Public and protected routes
- Local authentication (username/password)
- OAuth2 integration (Google, GitHub)
- Session management with SQLite
- Interactive HTML interface for testing

**Use case**: Learning authentication patterns, building apps that need user accounts

## Template Structure

Each template follows this structure:
```
templates/
├── template-name/
│   ├── manifest.yaml       # Template metadata
│   ├── package.json        # Project dependencies (with placeholders)
│   ├── README.md          # Template-specific documentation
│   ├── .env.example       # Environment variable examples
│   ├── tsconfig.json      # TypeScript configuration
│   └── src/               # Source code
│       └── index.ts       # Main application file
```

## Template Manifest (manifest.yaml)

Each template includes a `manifest.yaml` file with:
- **name**: Template identifier
- **displayName**: Human-readable name
- **description**: Template description
- **features**: List of included features
- **dependencies**: Required packages
- **environment**: Environment variables (required/optional)
- **scripts**: Bun scripts
- **routes**: API routes documentation
- **setup**: Setup instructions
- **oauth2**: OAuth2 provider configuration

## Using Templates

Templates are designed to be used with the Verb CLI:

```bash
# Create a new project from a template
verb init my-app --template auth-demo

# List available templates
verb template list

# Get template information
verb template info auth-demo
```

## Creating Custom Templates

To create a new template:

1. **Create template directory:**
   ```bash
   mkdir templates/my-template
   ```

2. **Add manifest.yaml:**
   ```yaml
   name: my-template
   displayName: My Custom Template
   description: Description of what this template provides
   features:
     - feature1
     - feature2
   dependencies:
     verb: "github:wess/verb"
   ```

3. **Add package.json with placeholders:**
   ```json
   {
     "name": "{{PROJECT_NAME}}",
     "description": "{{PROJECT_DESCRIPTION}}"
   }
   ```

4. **Create source files** in `src/` directory

5. **Add documentation** in `README.md`

## Template Placeholders

Templates support these placeholders that are replaced during project creation:
- `{{PROJECT_NAME}}` - Project name
- `{{PROJECT_DESCRIPTION}}` - Project description
- `{{AUTHOR_NAME}}` - Author name
- `{{AUTHOR_EMAIL}}` - Author email

## Template Validation

Validate templates before publishing:

```bash
bun run validate
```

This checks:
- Required files exist
- manifest.yaml is valid YAML
- package.json is valid JSON
- Dependencies are available
- Route definitions are properly structured

## Contributing Templates

1. Create your template in the `templates/` directory
2. Test it thoroughly
3. Add comprehensive documentation
4. Submit a pull request

### Template Guidelines

- **Single Purpose**: Each template should have a clear, focused purpose
- **Minimal Setup**: Should work out of the box with minimal configuration
- **Well Documented**: Include clear README with setup instructions
- **Best Practices**: Demonstrate Verb library best practices
- **Dependencies**: Only include necessary dependencies
- **Environment**: Provide `.env.example` for configuration

## Template Categories

Current and planned template categories:

### Basic Templates
- **minimal**: Bare-bones Verb server
- **api**: REST API with routing
- **static**: Static file serving

### Authentication Templates
- **auth-demo**: Comprehensive auth demonstration
- **auth-api**: API with JWT authentication
- **auth-oauth**: OAuth-only authentication

### Full-Stack Templates
- **fullstack-react**: Verb + React SSR
- **fullstack-htmx**: Verb + HTMX
- **fullstack-spa**: Verb API + SPA frontend

### Specialized Templates
- **microservice**: Microservice with health checks
- **realtime**: WebSocket-enabled application
- **database**: Database integration patterns
- **monitoring**: Logging and monitoring setup

## Version Compatibility

Templates are versioned alongside the Verb library:
- Template version matches supported Verb version
- Breaking changes increment major version
- New features increment minor version

## License

All official templates are MIT licensed, same as the Verb library.