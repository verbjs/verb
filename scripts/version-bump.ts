#!/usr/bin/env bun

import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { glob } from "glob";

type VersionBumpType = "patch" | "minor" | "major" | "sync";

interface PackageJson {
  name: string;
  version: string;
  [key: string]: any;
}

function bumpVersion(currentVersion: string, bumpType: VersionBumpType): string {
  const [major, minor, patch] = currentVersion.split(".").map(Number);
  
  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

async function readVersionFile(): Promise<string> {
  try {
    const versionContent = await readFile("VERSION", "utf8");
    return versionContent.trim();
  } catch (error) {
    throw new Error("Failed to read VERSION file. Make sure it exists in the project root.");
  }
}

async function updateVersionFile(newVersion: string): Promise<void> {
  await writeFile("VERSION", newVersion + "\n");
  console.log(`✅ VERSION file updated to ${newVersion}`);
}

async function updatePackageVersion(packageJsonPath: string, newVersion: string): Promise<void> {
  if (!existsSync(packageJsonPath)) {
    console.warn(`⚠️  No package.json found at ${packageJsonPath}`);
    return;
  }

  const content = await readFile(packageJsonPath, "utf8");
  const packageJson: PackageJson = JSON.parse(content);
  
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  
  console.log(`✅ ${packageJson.name}: ${oldVersion} → ${newVersion}`);
}

async function syncAllPackageVersions(targetVersion: string): Promise<void> {
  console.log(`🔄 Syncing all packages to version ${targetVersion}...\n`);

  // Find all package.json files in packages/*
  const packageJsonFiles = await glob("packages/*/package.json");
  
  for (const packageJsonPath of packageJsonFiles) {
    await updatePackageVersion(packageJsonPath, targetVersion);
  }
}

async function main() {
  const bumpType = process.argv[2] as VersionBumpType;
  
  if (!["patch", "minor", "major", "sync"].includes(bumpType)) {
    console.error("❌ Usage: bun run version:bump <patch|minor|major|sync>");
    console.error("   patch: Increment patch version (0.0.1 → 0.0.2)");
    console.error("   minor: Increment minor version (0.0.1 → 0.1.0)");
    console.error("   major: Increment major version (0.0.1 → 1.0.0)");
    console.error("   sync:  Sync all packages to current VERSION file");
    process.exit(1);
  }

  try {
    // Read current version from VERSION file
    const currentVersion = await readVersionFile();
    console.log(`📄 Current version from VERSION file: ${currentVersion}`);

    let targetVersion: string;

    if (bumpType === "sync") {
      // Just sync to current VERSION file content
      targetVersion = currentVersion;
      console.log(`🔄 Syncing all packages to VERSION file version: ${targetVersion}\n`);
    } else {
      // Bump version and update VERSION file
      targetVersion = bumpVersion(currentVersion, bumpType);
      console.log(`🔄 Bumping ${bumpType} version: ${currentVersion} → ${targetVersion}\n`);
      
      // Update VERSION file first
      await updateVersionFile(targetVersion);
    }

    // Update all package.json files
    await syncAllPackageVersions(targetVersion);

    console.log(`\n✅ All packages updated to version ${targetVersion}`);
    
    if (bumpType !== "sync") {
      console.log("\nNext steps:");
      console.log("1. Review changes: git diff");
      console.log(`2. Commit changes: git add . && git commit -m "chore: bump version to ${targetVersion}"`);
      console.log(`3. Create tag: git tag v${targetVersion}`);
      console.log("4. Build and publish: bun run publish:all");
    } else {
      console.log("\nPackages synced to VERSION file. Review changes with: git diff");
    }

  } catch (error) {
    console.error("❌ Failed to update versions:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);