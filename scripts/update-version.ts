#!/usr/bin/env bun

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get the project root directory
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Paths to files
const versionFile = join(projectRoot, "VERSION");
const packageJsonFile = join(projectRoot, "package.json");

// Parse command line arguments
const args = process.argv.slice(2);
const isCheck = args.includes("--check");
const isSet = args.includes("--set");
const showHelp = args.includes("--help") || args.includes("-h");

function checkVersion() {
  // Check if VERSION file exists
  if (!existsSync(versionFile)) {
    console.error("❌ VERSION file not found");
    process.exit(1);
  }

  // Check if package.json exists
  if (!existsSync(packageJsonFile)) {
    console.error("❌ package.json file not found");
    process.exit(1);
  }

  try {
    // Read version from VERSION file
    const versionContent = readFileSync(versionFile, "utf-8").trim();
    
    // Read and parse package.json
    const packageJsonContent = readFileSync(packageJsonFile, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    const currentVersion = packageJson.version;

    console.log(`📄 VERSION file: ${versionContent}`);
    console.log(`📦 package.json:  ${currentVersion}`);
    
    if (currentVersion === versionContent) {
      console.log("✅ Versions are in sync");
      return true;
    } else {
      console.log("⚠️  Versions are out of sync");
      return false;
    }

  } catch (error) {
    console.error(`❌ Error checking versions: ${error.message}`);
    process.exit(1);
  }
}

function setVersion() {
  // Handle both direct call and npm script call
  let newVersion = args.find(arg => !arg.startsWith("--"));
  
  // If no version found in args, check if it's passed after --
  if (!newVersion) {
    const dashIndex = args.indexOf("--");
    if (dashIndex !== -1 && args[dashIndex + 1]) {
      newVersion = args[dashIndex + 1];
    }
  }
  
  if (!newVersion) {
    console.error("❌ Please provide a version number");
    console.error("   Usage: bun run version:set -- 1.2.3");
    console.error("   Or:    bun scripts/update-version.ts --set 1.2.3");
    process.exit(1);
  }

  // Validate version format
  const versionPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
  if (!versionPattern.test(newVersion)) {
    console.error(`❌ Invalid version format: ${newVersion}`);
    console.error("   Expected format: x.y.z (e.g., 1.0.0, 2.1.3-beta.1)");
    process.exit(1);
  }

  try {
    // Update VERSION file
    writeFileSync(versionFile, newVersion + "\n", "utf-8");
    console.log(`✅ Updated VERSION file to: ${newVersion}`);

    // Update package.json
    updateVersion();

  } catch (error) {
    console.error(`❌ Error setting version: ${error.message}`);
    process.exit(1);
  }
}

function updateVersion() {
  // Check if VERSION file exists
  if (!existsSync(versionFile)) {
    console.error("❌ VERSION file not found");
    process.exit(1);
  }

  // Check if package.json exists
  if (!existsSync(packageJsonFile)) {
    console.error("❌ package.json file not found");
    process.exit(1);
  }

  try {
    // Read version from VERSION file
    const versionContent = readFileSync(versionFile, "utf-8").trim();
    
    if (!versionContent) {
      console.error("❌ VERSION file is empty");
      process.exit(1);
    }

    // Validate version format (basic semver check)
    const versionPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    if (!versionPattern.test(versionContent)) {
      console.error(`❌ Invalid version format in VERSION file: ${versionContent}`);
      console.error("   Expected format: x.y.z (e.g., 1.0.0, 2.1.3-beta.1)");
      process.exit(1);
    }

    // Read and parse package.json
    const packageJsonContent = readFileSync(packageJsonFile, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    // Get current version
    const currentVersion = packageJson.version;

    // Check if version is already up to date
    if (currentVersion === versionContent) {
      console.log(`✅ Version is already up to date: ${versionContent}`);
      return;
    }

    // Update version
    packageJson.version = versionContent;

    // Write back to package.json with proper formatting
    const updatedContent = JSON.stringify(packageJson, null, 2) + "\n";
    writeFileSync(packageJsonFile, updatedContent, "utf-8");

    console.log(`✅ Version updated successfully:`);
    console.log(`   From: ${currentVersion}`);
    console.log(`   To:   ${versionContent}`);

  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("❌ Invalid JSON in package.json");
    } else {
      console.error(`❌ Error updating version: ${error.message}`);
    }
    process.exit(1);
  }
}

// Add help text
if (showHelp) {
  console.log(`
🔄 Verb Version Management Script

Usage:
  bun scripts/update-version.ts [OPTIONS] [VERSION]

Options:
  --check        Check if VERSION file and package.json are in sync
  --set VERSION  Set both VERSION file and package.json to specified version
  --help, -h     Show this help message

Description:
  Manages version synchronization between VERSION file and package.json.
  
  Default behavior (no options): Reads VERSION file and updates package.json.
  
Files:
  - VERSION file: Contains the target version
  - package.json: Will be updated with the new version

Package.json Scripts:
  bun run version:check      # Check if versions are in sync
  bun run version:sync       # Sync package.json to VERSION file
  bun run version:set -- 1.2.3 # Set both files to specified version

Examples:
  # Check version sync status
  bun run version:check
  
  # Update package.json from VERSION file
  bun run version:sync
  
  # Set new version in both files
  bun run version:set -- 1.2.3
  
  # Set pre-release version
  bun run version:set -- 1.2.3-beta.1
`);
  process.exit(0);
}

// Main execution logic
if (isCheck) {
  checkVersion();
} else if (isSet) {
  setVersion();
} else {
  // Default behavior: sync package.json to VERSION file
  updateVersion();
}