import type { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import fs from "fs-extra";
import YAML from "yaml";

interface TemplateManifest {
  name: string;
  displayName: string;
  description: string;
  version: string;
  tags: string[];
  features: string[];
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  environment?: {
    required?: string[];
    optional?: string[];
  };
  scripts: Record<string, string>;
  routes?: {
    public?: Array<{ path: string; description: string; method?: string }>;
    auth?: Array<{ path: string; description: string; method?: string; protected?: boolean }>;
    protected?: Array<{ path: string; description: string; method?: string; auth?: string }>;
  };
  setup?: {
    steps?: string[];
  };
  oauth2?: Record<string, any>;
  production?: {
    considerations?: string[];
  };
}

interface TemplateOptions {
  name: string;
  displayName: string;
  description: string;
  author: string;
  features: string[];
  includeAuth: boolean;
  includeReact: boolean;
  includeOAuth2: boolean;
  outputDir: string;
}

/**
 * Register the template command
 */
export function templateCommand(program: Command): void {
  const template = program.command("template").description("Template management commands");

  // Create template command
  template
    .command("create")
    .description("Create a new template interactively")
    .argument("[name]", "Template name")
    .option("-o, --output <dir>", "Output directory", ".")
    .option("-y, --yes", "Skip prompts and use defaults")
    .action(async (name, options) => {
      await createTemplate(name, options);
    });

  // List templates command
  template
    .command("list")
    .description("List available templates")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      await listTemplates(options);
    });

  // Validate template command
  template
    .command("validate")
    .description("Validate a template")
    .argument("<path>", "Path to template directory")
    .action(async (templatePath) => {
      await validateTemplate(templatePath);
    });

  // Info command
  template
    .command("info")
    .description("Show detailed information about a template")
    .argument("<name>", "Template name")
    .action(async (templateName) => {
      await showTemplateInfo(templateName);
    });
}

/**
 * Create a new template interactively
 */
async function createTemplate(name?: string, options: any = {}): Promise<void> {
  console.log(chalk.cyan("🏗️  Creating a new Verb template\n"));

  // Get template options through prompts
  const templateOptions = await promptForTemplateOptions(name, options);

  // Create the template
  await generateTemplate(templateOptions);

  console.log(chalk.green("\n✅ Template created successfully!"));
  console.log("\nNext steps:");
  console.log(chalk.gray(`  cd ${templateOptions.outputDir}/${templateOptions.name}`));
  console.log(chalk.gray("  # Edit src/index.ts with your application code"));
  console.log(chalk.gray("  # Update README.md with documentation"));
  console.log(chalk.gray("  verb template validate ."));
  console.log("\nHappy templating! 🎉");
}

/**
 * Prompt for template options
 */
async function promptForTemplateOptions(
  name?: string,
  options: any = {},
): Promise<TemplateOptions> {
  if (options.yes && name) {
    return {
      name,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      description: `A Verb template named ${name}`,
      author: "Developer",
      features: ["Basic Verb server"],
      includeAuth: false,
      includeReact: false,
      includeOAuth2: false,
      outputDir: options.output || ".",
    };
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Template name (kebab-case):",
      default: name || "my-template",
      validate: (input) => {
        if (/^[a-z0-9-]+$/.test(input)) {
          return true;
        }
        return "Template name must be lowercase letters, numbers, and hyphens only";
      },
    },
    {
      type: "input",
      name: "displayName",
      message: "Display name:",
      default: (answers: { name: string }) =>
        answers.name
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
    },
    {
      type: "input",
      name: "description",
      message: "Description:",
      default: (answers: { displayName: string }) =>
        `A Verb application template for ${answers.displayName.toLowerCase()}`,
    },
    {
      type: "input",
      name: "author",
      message: "Author name:",
      default: "Developer",
    },
    {
      type: "checkbox",
      name: "mainFeatures",
      message: "Select main features:",
      choices: [
        { name: "Authentication", value: "auth" },
        { name: "React SSR", value: "react" },
        { name: "REST API", value: "api" },
        { name: "Static Files", value: "static" },
        { name: "WebSockets", value: "websockets" },
        { name: "Database Integration", value: "database" },
      ],
    },
    {
      type: "confirm",
      name: "includeAuth",
      message: "Include @verb/auth integration?",
      default: (answers: { mainFeatures: string[] }) => answers.mainFeatures.includes("auth"),
      when: (answers) => !answers.mainFeatures.includes("auth"),
    },
    {
      type: "confirm",
      name: "includeOAuth2",
      message: "Include OAuth2 providers (Google, GitHub)?",
      default: true,
      when: (answers) => answers.includeAuth || answers.mainFeatures.includes("auth"),
    },
    {
      type: "confirm",
      name: "includeReact",
      message: "Include React SSR integration?",
      default: (answers: { mainFeatures: string[] }) => answers.mainFeatures.includes("react"),
      when: (answers) => !answers.mainFeatures.includes("react"),
    },
    {
      type: "input",
      name: "outputDir",
      message: "Output directory:",
      default: options.output || ".",
    },
  ]);

  // Process main features into individual flags
  const mainFeatures = answers.mainFeatures || [];
  const features = ["Basic Verb server"];

  if (mainFeatures.includes("auth")) answers.includeAuth = true;
  if (mainFeatures.includes("react")) answers.includeReact = true;

  if (answers.includeAuth) features.push("Authentication system");
  if (answers.includeReact) features.push("React SSR");
  if (answers.includeOAuth2) features.push("OAuth2 integration");
  if (mainFeatures.includes("api")) features.push("REST API endpoints");
  if (mainFeatures.includes("static")) features.push("Static file serving");
  if (mainFeatures.includes("websockets")) features.push("WebSocket support");
  if (mainFeatures.includes("database")) features.push("Database integration");

  return {
    ...answers,
    features,
    includeAuth: answers.includeAuth || mainFeatures.includes("auth"),
    includeReact: answers.includeReact || mainFeatures.includes("react"),
    includeOAuth2: answers.includeOAuth2 || false,
  };
}

/**
 * Generate the template files
 */
async function generateTemplate(options: TemplateOptions): Promise<void> {
  const spinner = ora("Creating template structure").start();

  try {
    const templateDir = path.resolve(options.outputDir, options.name);

    // Create template directory
    fs.ensureDirSync(templateDir);
    fs.ensureDirSync(path.join(templateDir, "src"));

    // Generate manifest.yaml
    await generateManifest(templateDir, options);
    spinner.text = "Generated manifest.yaml";

    // Generate package.json
    await generatePackageJson(templateDir, options);
    spinner.text = "Generated package.json";

    // Generate TypeScript config
    await generateTsConfig(templateDir);
    spinner.text = "Generated tsconfig.json";

    // Generate source code
    await generateSourceCode(templateDir, options);
    spinner.text = "Generated source code";

    // Generate README
    await generateReadme(templateDir, options);
    spinner.text = "Generated README.md";

    // Generate environment file
    await generateEnvExample(templateDir, options);
    spinner.text = "Generated .env.example";

    spinner.succeed("Template structure created");
  } catch (error) {
    spinner.fail(`Failed to create template: ${error.message}`);
    throw error;
  }
}

/**
 * Generate manifest.yaml
 */
async function generateManifest(templateDir: string, options: TemplateOptions): Promise<void> {
  const dependencies: Record<string, string> = {
    verb: "github:wess/verb",
  };

  if (options.includeAuth) {
    dependencies["@verb/auth"] = "workspace:*";
  }

  if (options.includeReact) {
    dependencies["@verb/plugins"] = "workspace:*";
    dependencies.react = "^18.2.0";
    dependencies["react-dom"] = "^18.2.0";
  }

  const devDependencies: Record<string, string> = {
    "@types/bun": "latest",
    typescript: "^5.0.0",
  };

  if (options.includeAuth) {
    devDependencies["better-sqlite3"] = "^9.2.2";
  }

  if (options.includeReact) {
    devDependencies["@types/react"] = "^18.2.0";
    devDependencies["@types/react-dom"] = "^18.2.0";
  }

  const environment: { required?: string[]; optional?: string[] } = {};

  if (options.includeAuth) {
    environment.required = ["SESSION_SECRET"];
    if (options.includeOAuth2) {
      environment.optional = [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
      ];
    }
  }

  const routes: TemplateManifest["routes"] = {
    public: [
      { path: "/", description: "Welcome page", method: "GET" },
      { path: "/health", description: "Health check endpoint", method: "GET" },
    ],
  };

  if (options.includeAuth) {
    routes.auth = [
      { path: "/auth/login", description: "User login", method: "POST" },
      { path: "/auth/register", description: "User registration", method: "POST" },
      { path: "/auth/logout", description: "User logout", method: "POST" },
      { path: "/auth/me", description: "Get current user", method: "GET", protected: true },
    ];

    if (options.includeOAuth2) {
      routes.auth.push(
        { path: "/auth/google", description: "Google OAuth2 login", method: "GET" },
        { path: "/auth/github", description: "GitHub OAuth2 login", method: "GET" },
      );
    }

    routes.protected = [
      { path: "/dashboard", description: "User dashboard", method: "GET", auth: "required" },
    ];
  }

  const manifest: TemplateManifest = {
    name: options.name,
    displayName: options.displayName,
    description: options.description,
    version: "1.0.0",
    tags: [
      options.includeAuth ? "auth" : "basic",
      options.includeReact ? "react" : "server",
      "template",
    ].filter(Boolean),
    features: options.features,
    dependencies,
    devDependencies,
    environment: Object.keys(environment).length > 0 ? environment : undefined,
    scripts: {
      dev: "bun run --watch src/index.ts",
      start: "bun run src/index.ts",
      build: "bun build src/index.ts --outdir dist",
      test: "bun test",
    },
    routes,
    setup: {
      steps: [
        "Copy environment variables from .env.example",
        ...(options.includeAuth && options.includeOAuth2
          ? ["Configure OAuth2 providers (optional)"]
          : []),
        "Run bun install",
        "Start development server with bun run dev",
      ],
    },
  };

  if (options.includeAuth && options.includeOAuth2) {
    manifest.oauth2 = {
      google: {
        setup: [
          "Go to Google Cloud Console",
          "Create OAuth2 credentials",
          "Add redirect URI: http://localhost:3000/auth/google/callback",
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
        ],
      },
      github: {
        setup: [
          "Go to GitHub Developer Settings",
          "Create new OAuth App",
          "Set callback URL: http://localhost:3000/auth/github/callback",
          "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET",
        ],
      },
    };
  }

  const yamlContent = YAML.stringify(manifest, { indent: 2, lineWidth: 0 });
  await fs.writeFile(path.join(templateDir, "manifest.yaml"), yamlContent);
}

/**
 * Generate package.json
 */
async function generatePackageJson(templateDir: string, options: TemplateOptions): Promise<void> {
  const packageJson = {
    name: "{{PROJECT_NAME}}",
    version: "0.1.0",
    description: "{{PROJECT_DESCRIPTION}}",
    type: "module",
    scripts: {
      dev: "bun run --watch src/index.ts",
      start: "bun run src/index.ts",
      build: "bun build src/index.ts --outdir dist",
      test: "bun test",
    },
    dependencies: {
      verb: "github:wess/verb",
      ...(options.includeAuth && { "@verb/auth": "workspace:*" }),
      ...(options.includeReact && {
        "@verb/plugins": "workspace:*",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      }),
    },
    devDependencies: {
      "@types/bun": "latest",
      typescript: "^5.0.0",
      ...(options.includeAuth && { "better-sqlite3": "^9.2.2" }),
      ...(options.includeReact && {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
      }),
    },
  };

  await fs.writeFile(path.join(templateDir, "package.json"), JSON.stringify(packageJson, null, 2));
}

/**
 * Generate tsconfig.json
 */
async function generateTsConfig(templateDir: string): Promise<void> {
  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "node",
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      outDir: "dist",
      rootDir: "src",
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };

  await fs.writeFile(path.join(templateDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
}

/**
 * Generate source code
 */
async function generateSourceCode(templateDir: string, options: TemplateOptions): Promise<void> {
  let imports = 'import { createServer } from "verb";';
  let setup = "";
  let routes = "";

  if (options.includeAuth) {
    imports += '\nimport { createAuthPlugin } from "@verb/auth";';

    setup = `
// Configure authentication
const authPlugin = createAuthPlugin({
  storage: {
    type: "sqlite",
    database: "./auth.db"
  },
  session: {
    secret: process.env.SESSION_SECRET || "change-this-in-production",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax"
  },${
    options.includeOAuth2
      ? `
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUri: "http://localhost:3000/auth/google/callback"
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      redirectUri: "http://localhost:3000/auth/github/callback"
    }
  },`
      : ""
  }
  registration: {
    enabled: true,
    requireEmailVerification: false
  }
});
`;

    routes = `
// Authentication routes
app.post("/auth/login", authPlugin.handlers.login);
app.post("/auth/register", authPlugin.handlers.register);
app.post("/auth/logout", authPlugin.handlers.logout);
app.get("/auth/me", authPlugin.middleware.requireAuth, authPlugin.handlers.me);
${
  options.includeOAuth2
    ? `
// OAuth2 routes (if configured)
if (process.env.GOOGLE_CLIENT_ID) {
  app.get("/auth/google", authPlugin.handlers.oauth2("google"));
  app.get("/auth/google/callback", authPlugin.handlers.oauth2Callback("google"));
}

if (process.env.GITHUB_CLIENT_ID) {
  app.get("/auth/github", authPlugin.handlers.oauth2("github"));
  app.get("/auth/github/callback", authPlugin.handlers.oauth2Callback("github"));
}`
    : ""
}

// Protected routes
app.get("/dashboard", authPlugin.middleware.requireAuth, (req) => {
  const user = (req as any).user;
  return Response.json({ 
    message: "Welcome to your dashboard!",
    user: { id: user.id, email: user.email, name: user.name }
  });
});
`;
  }

  const indexContent = `${imports}

const app = createServer({ port: 3000 });
${setup}
// Public routes
app.get("/", () => {
  return new Response(\`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${options.displayName}</title>
      <style>
        body { 
          font-family: system-ui, sans-serif; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 2rem;
          line-height: 1.6;
        }
        .feature { margin: 1rem 0; }
        a { color: #0070f3; }
      </style>
    </head>
    <body>
      <h1>🚀 ${options.displayName}</h1>
      <p>${options.description}</p>
      
      <div class="feature">
        <h3>Features:</h3>
        <ul>
          ${options.features.map((feature) => `<li>${feature}</li>`).join("\\n          ")}
        </ul>
      </div>
      
      <div class="feature">
        <h3>API Endpoints:</h3>
        <ul>
          <li><a href="/health">GET /health</a> - Health check</li>${
            options.includeAuth
              ? `
          <li><a href="/auth/me">GET /auth/me</a> - Current user (protected)</li>
          <li><a href="/dashboard">GET /dashboard</a> - Dashboard (protected)</li>`
              : ""
          }
        </ul>
      </div>
      
      ${options.includeAuth ? `<p><strong>Note:</strong> Authentication endpoints are available. See README.md for setup instructions.</p>` : ""}
    </body>
    </html>
  \`, {
    headers: { "Content-Type": "text/html" }
  });
});

app.get("/health", () => {
  return Response.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    template: "${options.name}"
  });
});
${routes}
console.log("🚀 ${options.displayName} running at http://localhost:3000");
console.log("📋 Available routes:");
console.log("  GET  /           - Welcome page");
console.log("  GET  /health     - Health check");${
    options.includeAuth
      ? `
console.log("  POST /auth/login - User login");
console.log("  POST /auth/register - User registration");
console.log("  GET  /dashboard  - User dashboard (protected)");`
      : ""
  }
`;

  await fs.writeFile(path.join(templateDir, "src/index.ts"), indexContent);
}

/**
 * Generate README.md
 */
async function generateReadme(templateDir: string, options: TemplateOptions): Promise<void> {
  const readmeContent = `# ${options.displayName}

${options.description}

## Features

${options.features.map((feature) => `- ${feature}`).join("\n")}

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   bun install
   \`\`\`

2. **Set up environment:**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. **Start the development server:**
   \`\`\`bash
   bun run dev
   \`\`\`

4. **Visit http://localhost:3000**

## API Routes

### Public Routes
- \`GET /\` - Welcome page
- \`GET /health\` - Health check endpoint
${
  options.includeAuth
    ? `
### Authentication Routes
- \`POST /auth/login\` - User login
- \`POST /auth/register\` - User registration
- \`POST /auth/logout\` - User logout
- \`GET /auth/me\` - Get current user info (protected)
${
  options.includeOAuth2
    ? `
### OAuth2 Routes (if configured)
- \`GET /auth/google\` - Google OAuth2 login
- \`GET /auth/google/callback\` - Google OAuth2 callback
- \`GET /auth/github\` - GitHub OAuth2 login
- \`GET /auth/github/callback\` - GitHub OAuth2 callback`
    : ""
}

### Protected Routes
- \`GET /dashboard\` - User dashboard (requires authentication)`
    : ""
}

## Configuration
${
  options.includeAuth
    ? `
### Authentication
This template uses \`@verb/auth\` for authentication. Configure the following environment variables:

- \`SESSION_SECRET\` - Secret for session encryption (required)
${
  options.includeOAuth2
    ? `
### OAuth2 Providers (Optional)
- \`GOOGLE_CLIENT_ID\` and \`GOOGLE_CLIENT_SECRET\` - Google OAuth2
- \`GITHUB_CLIENT_ID\` and \`GITHUB_CLIENT_SECRET\` - GitHub OAuth2

See the OAuth2 setup section in the manifest.yaml for detailed instructions.`
    : ""
}`
    : `
### Environment Variables
See \`.env.example\` for available configuration options.`
}

## Development

\`\`\`bash
# Start development server with hot reload
bun run dev

# Build for production
bun run build

# Run tests
bun run test
\`\`\`

## Production Deployment

1. Set \`NODE_ENV=production\`
2. Configure all required environment variables
3. Use \`bun run start\` to run the production server

## License

MIT

---

Generated with Verb CLI template generator.
`;

  await fs.writeFile(path.join(templateDir, "README.md"), readmeContent);
}

/**
 * Generate .env.example
 */
async function generateEnvExample(templateDir: string, options: TemplateOptions): Promise<void> {
  let envContent = `# Environment Configuration
NODE_ENV=development
`;

  if (options.includeAuth) {
    envContent += `
# Authentication
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
`;

    if (options.includeOAuth2) {
      envContent += `
# Google OAuth2 (optional)
# Get these from https://console.developers.google.com/
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth2 (optional)
# Get these from https://github.com/settings/applications/new
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
`;
    }
  }

  await fs.writeFile(path.join(templateDir, ".env.example"), envContent);
}

/**
 * List available templates
 */
async function listTemplates(options: any = {}): Promise<void> {
  // For now, show placeholder. In future, this would scan templates directory
  const templates = [
    {
      name: "auth-demo",
      displayName: "Authentication Demo",
      description: "Comprehensive authentication demonstration",
      tags: ["auth", "demo", "sqlite", "oauth2"],
    },
  ];

  if (options.json) {
    console.log(JSON.stringify(templates, null, 2));
  } else {
    console.log(chalk.cyan("📦 Available Verb Templates:\n"));
    for (const template of templates) {
      console.log(`${chalk.bold(template.displayName)} (${template.name})`);
      console.log(`  ${template.description}`);
      console.log(`  Tags: ${template.tags.join(", ")}`);
      console.log();
    }
  }
}

/**
 * Validate a template
 */
async function validateTemplate(templatePath: string): Promise<void> {
  console.log(chalk.cyan(`🔍 Validating template at ${templatePath}...\n`));

  // Basic validation checks
  const requiredFiles = ["manifest.yaml", "package.json", "README.md", "src/index.ts"];
  let allValid = true;

  for (const file of requiredFiles) {
    const filePath = path.join(templatePath, file);
    if (fs.existsSync(filePath)) {
      console.log(chalk.green(`✅ ${file}`));
    } else {
      console.log(chalk.red(`❌ ${file} - Missing`));
      allValid = false;
    }
  }

  // Check manifest.yaml structure
  const manifestPath = path.join(templatePath, "manifest.yaml");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifestContent = await fs.readFile(manifestPath, "utf8");
      const manifest = YAML.parse(manifestContent);

      const requiredFields = ["name", "displayName", "description"];
      for (const field of requiredFields) {
        if (manifest[field]) {
          console.log(chalk.green(`✅ manifest.${field}`));
        } else {
          console.log(chalk.red(`❌ manifest.${field} - Missing`));
          allValid = false;
        }
      }
    } catch (error) {
      console.log(chalk.red(`❌ manifest.yaml - Invalid YAML: ${error.message}`));
      allValid = false;
    }
  }

  console.log();
  if (allValid) {
    console.log(chalk.green("✅ Template validation passed!"));
  } else {
    console.log(chalk.red("❌ Template validation failed"));
    process.exit(1);
  }
}

/**
 * Show detailed template information
 */
async function showTemplateInfo(templateName: string): Promise<void> {
  console.log(chalk.cyan(`📋 Template Information: ${templateName}\n`));

  // For now, show placeholder. In future, this would load from templates directory
  if (templateName === "auth-demo") {
    console.log(chalk.bold("Authentication Demo"));
    console.log("A comprehensive authentication demonstration template");
    console.log("\nFeatures:");
    console.log("- Local authentication (username/password)");
    console.log("- OAuth2 providers (Google, GitHub)");
    console.log("- Protected routes");
    console.log("- Session management");
    console.log("- SQLite storage");
  } else {
    console.log(chalk.red(`Template '${templateName}' not found`));
    process.exit(1);
  }
}
