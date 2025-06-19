#!/usr/bin/env bun

import { readdir, readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import YAML from "yaml";

interface TemplateManifest {
  name: string;
  displayName: string;
  description: string;
  version?: string;
  tags?: string[];
  features?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  environment?: {
    required?: string[];
    optional?: string[];
  };
  scripts?: Record<string, string>;
  routes?: {
    public?: Array<{ path: string; description: string; method?: string }>;
    auth?: Array<{ path: string; description: string; method?: string; protected?: boolean; condition?: string }>;
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

interface ValidationResult {
  template: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_FILES = [
  "manifest.yaml",
  "package.json", 
  "README.md",
  "src/index.ts"
];

const OPTIONAL_FILES = [
  ".env.example",
  "tsconfig.json",
  "manifest.yml" // Allow both .yaml and .yml
];

async function validateTemplate(templatePath: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    template: templatePath,
    valid: true,
    errors: [],
    warnings: []
  };

  try {
    // Check if template directory exists
    const templateDir = join(process.cwd(), "templates", templatePath);
    if (!existsSync(templateDir)) {
      result.errors.push(`Template directory ${templatePath} does not exist`);
      result.valid = false;
      return result;
    }

    // Check required files
    for (const file of REQUIRED_FILES) {
      const filePath = join(templateDir, file);
      if (!existsSync(filePath)) {
        result.errors.push(`Required file missing: ${file}`);
        result.valid = false;
      }
    }

    // Check optional files and warn if missing
    for (const file of OPTIONAL_FILES) {
      const filePath = join(templateDir, file);
      if (!existsSync(filePath)) {
        result.warnings.push(`Optional file missing: ${file}`);
      }
    }

    // Validate manifest.yaml (or manifest.yml)
    const manifestYamlPath = join(templateDir, "manifest.yaml");
    const manifestYmlPath = join(templateDir, "manifest.yml");
    const manifestPath = existsSync(manifestYamlPath) ? manifestYamlPath : 
                        existsSync(manifestYmlPath) ? manifestYmlPath : null;
    
    if (manifestPath) {
      try {
        const manifestContent = await readFile(manifestPath, "utf8");
        const manifest: TemplateManifest = YAML.parse(manifestContent);
        
        // Validate required fields
        if (!manifest.name) {
          result.errors.push("manifest.yaml: missing 'name' field");
          result.valid = false;
        }
        
        if (!manifest.displayName) {
          result.errors.push("manifest.yaml: missing 'displayName' field");
          result.valid = false;
        }
        
        if (!manifest.description) {
          result.errors.push("manifest.yaml: missing 'description' field");
          result.valid = false;
        }

        // Validate name matches directory
        if (manifest.name !== templatePath) {
          result.errors.push(`manifest.yaml: name '${manifest.name}' does not match directory '${templatePath}'`);
          result.valid = false;
        }

        // Check if features are provided
        if (!manifest.features || manifest.features.length === 0) {
          result.warnings.push("manifest.yaml: no features listed");
        }

        // Validate dependencies format
        if (manifest.dependencies) {
          for (const [pkg, version] of Object.entries(manifest.dependencies)) {
            if (typeof version !== "string") {
              result.errors.push(`manifest.yaml: invalid version format for ${pkg}`);
              result.valid = false;
            }
          }
        }

        // Validate environment variables
        if (manifest.environment) {
          if (manifest.environment.required && !Array.isArray(manifest.environment.required)) {
            result.errors.push("manifest.yaml: environment.required must be an array");
            result.valid = false;
          }
          if (manifest.environment.optional && !Array.isArray(manifest.environment.optional)) {
            result.errors.push("manifest.yaml: environment.optional must be an array");
            result.valid = false;
          }
        }

        // Validate routes structure
        if (manifest.routes) {
          const routeSections = ['public', 'auth', 'protected'] as const;
          for (const section of routeSections) {
            const routes = manifest.routes[section];
            if (routes && Array.isArray(routes)) {
              for (const [index, route] of routes.entries()) {
                if (!route.path) {
                  result.errors.push(`manifest.yaml: routes.${section}[${index}] missing 'path' field`);
                  result.valid = false;
                }
                if (!route.description) {
                  result.warnings.push(`manifest.yaml: routes.${section}[${index}] missing 'description' field`);
                }
              }
            }
          }
        }

      } catch (error) {
        result.errors.push(`manifest.yaml: invalid YAML - ${error.message}`);
        result.valid = false;
      }
    }

    // Validate package.json
    const packageJsonPath = join(templateDir, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = await readFile(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        
        // Check for required placeholders
        if (!packageJson.name || !packageJson.name.includes("{{PROJECT_NAME}}")) {
          result.warnings.push("package.json: missing {{PROJECT_NAME}} placeholder in name field");
        }

        // Check for type: module
        if (packageJson.type !== "module") {
          result.warnings.push("package.json: should include 'type: module' for ESM");
        }

        // Check for required scripts
        const requiredScripts = ["dev", "start"];
        for (const script of requiredScripts) {
          if (!packageJson.scripts || !packageJson.scripts[script]) {
            result.warnings.push(`package.json: missing recommended script '${script}'`);
          }
        }

      } catch (error) {
        result.errors.push(`package.json: invalid JSON - ${error.message}`);
        result.valid = false;
      }
    }

    // Validate src/index.ts exists and is not empty
    const indexPath = join(templateDir, "src/index.ts");
    if (existsSync(indexPath)) {
      const indexContent = await readFile(indexPath, "utf8");
      if (indexContent.trim().length === 0) {
        result.errors.push("src/index.ts: file is empty");
        result.valid = false;
      }

      // Check for basic Verb imports
      if (!indexContent.includes("createServer")) {
        result.warnings.push("src/index.ts: does not import createServer from verb");
      }
    }

    // Validate README.md exists and has content
    const readmePath = join(templateDir, "README.md");
    if (existsSync(readmePath)) {
      const readmeContent = await readFile(readmePath, "utf8");
      if (readmeContent.trim().length < 100) {
        result.warnings.push("README.md: appears to be too short (less than 100 characters)");
      }

      // Check for common sections
      const requiredSections = ["## Features", "## Quick Start"];
      for (const section of requiredSections) {
        if (!readmeContent.includes(section)) {
          result.warnings.push(`README.md: missing recommended section '${section}'`);
        }
      }
    }

    // Check TypeScript configuration
    const tsconfigPath = join(templateDir, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      try {
        const tsconfigContent = await readFile(tsconfigPath, "utf8");
        const tsconfig = JSON.parse(tsconfigContent);
        
        if (!tsconfig.compilerOptions?.target) {
          result.warnings.push("tsconfig.json: missing target configuration");
        }

        if (tsconfig.compilerOptions?.target !== "ESNext") {
          result.warnings.push("tsconfig.json: recommended to use 'ESNext' as target");
        }

      } catch (error) {
        result.errors.push(`tsconfig.json: invalid JSON - ${error.message}`);
        result.valid = false;
      }
    }

  } catch (error) {
    result.errors.push(`Validation error: ${error.message}`);
    result.valid = false;
  }

  return result;
}

async function main() {
  console.log("🔍 Validating Verb templates...\n");

  const templatesDir = join(process.cwd(), "templates");
  
  if (!existsSync(templatesDir)) {
    console.error("❌ Templates directory not found");
    process.exit(1);
  }

  const templates = await readdir(templatesDir);
  const results: ValidationResult[] = [];

  for (const template of templates) {
    const templatePath = join(templatesDir, template);
    const stats = await stat(templatePath);
    
    if (stats.isDirectory()) {
      console.log(`📦 Validating template: ${template}`);
      const result = await validateTemplate(template);
      results.push(result);
      
      if (result.valid) {
        console.log(`✅ ${template}: Valid`);
      } else {
        console.log(`❌ ${template}: Invalid`);
      }

      if (result.errors.length > 0) {
        console.log(`   Errors:`);
        for (const error of result.errors) {
          console.log(`   - ${error}`);
        }
      }

      if (result.warnings.length > 0) {
        console.log(`   Warnings:`);
        for (const warning of result.warnings) {
          console.log(`   - ${warning}`);
        }
      }
      console.log();
    }
  }

  // Summary
  const validTemplates = results.filter(r => r.valid);
  const invalidTemplates = results.filter(r => !r.valid);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  console.log("📊 Validation Summary:");
  console.log(`   Valid templates: ${validTemplates.length}`);
  console.log(`   Invalid templates: ${invalidTemplates.length}`);
  console.log(`   Total warnings: ${totalWarnings}`);

  if (invalidTemplates.length > 0) {
    console.log("\n❌ The following templates have errors:");
    for (const result of invalidTemplates) {
      console.log(`   - ${result.template}`);
    }
    process.exit(1);
  } else {
    console.log("\n✅ All templates are valid!");
    if (totalWarnings > 0) {
      console.log(`⚠️  Consider addressing the ${totalWarnings} warning(s) above`);
    }
  }
}

// Run validation
main().catch(error => {
  console.error("💥 Validation failed:", error);
  process.exit(1);
});