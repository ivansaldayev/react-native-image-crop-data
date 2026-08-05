#!/usr/bin/env node
/**
 * Keeps every mirror of the package name in sync with the single source of truth -
 * package.json's "name" field (brief §5).
 *
 * Mirrors:
 *   - example/package.json  -> the "dependencies" key holding the local `file:..` link
 *   - example/src/lib.ts    -> `export * from "<name>";`
 *   - example/app.json      -> expo.name, expo.slug, ios.bundleIdentifier, android.package
 *
 * Bundle identifiers are DERIVED from the name by their own rule (strip everything but
 * letters/digits, reverse-DNS style) rather than string-matched against it, since an identifier
 * cannot contain hyphens the way an npm package name can.
 *
 * Two modes:
 *   node scripts/sync-name.mjs          - rewrite every drifted mirror, then regenerate README.md
 *   node scripts/sync-name.mjs --check  - report drift; write nothing
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReadme } from "./build-readme.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const EXAMPLE_PACKAGE_JSON_PATH = path.join(ROOT, "example", "package.json");
const EXAMPLE_LIB_PATH = path.join(ROOT, "example", "src", "lib.ts");
const EXAMPLE_APP_JSON_PATH = path.join(ROOT, "example", "app.json");
const README_PATH = path.join(ROOT, "README.md");

const LOCAL_DEPENDENCY_VALUE = "file:..";

const deriveBundleIdentifier = (name) => `com.example.${name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function updateAppJson(mutate) {
  const appJson = readJson(EXAMPLE_APP_JSON_PATH);
  mutate(appJson);
  writeJson(EXAMPLE_APP_JSON_PATH, appJson);
}

function currentLocalDependencyKey() {
  const pkg = readJson(EXAMPLE_PACKAGE_JSON_PATH);
  const dependencies = pkg.dependencies ?? {};
  return Object.keys(dependencies).find((key) => dependencies[key] === LOCAL_DEPENDENCY_VALUE) ?? null;
}

function buildMirrors(name) {
  const expectedDisplayName = `${name} example`;
  const expectedSlug = `${name}-example`;
  const expectedIdentifier = deriveBundleIdentifier(name);
  const expectedLibReexport = `export * from "${name}";\n`;

  return [
    {
      label: "example/package.json dependency key",
      read: () => currentLocalDependencyKey(),
      expected: name,
      write: () => {
        const pkg = readJson(EXAMPLE_PACKAGE_JSON_PATH);
        const dependencies = pkg.dependencies ?? {};
        const currentKey = Object.keys(dependencies).find((key) => dependencies[key] === LOCAL_DEPENDENCY_VALUE);
        if (currentKey) delete dependencies[currentKey];
        dependencies[name] = LOCAL_DEPENDENCY_VALUE;
        pkg.dependencies = dependencies;
        writeJson(EXAMPLE_PACKAGE_JSON_PATH, pkg);
      },
    },
    {
      label: "example/src/lib.ts re-export specifier",
      read: () => fs.readFileSync(EXAMPLE_LIB_PATH, "utf8"),
      expected: expectedLibReexport,
      write: () => fs.writeFileSync(EXAMPLE_LIB_PATH, expectedLibReexport),
    },
    {
      label: "example/app.json expo.name",
      read: () => readJson(EXAMPLE_APP_JSON_PATH).expo?.name ?? null,
      expected: expectedDisplayName,
      write: () => updateAppJson((appJson) => (appJson.expo.name = expectedDisplayName)),
    },
    {
      label: "example/app.json expo.slug",
      read: () => readJson(EXAMPLE_APP_JSON_PATH).expo?.slug ?? null,
      expected: expectedSlug,
      write: () => updateAppJson((appJson) => (appJson.expo.slug = expectedSlug)),
    },
    {
      label: "example/app.json expo.ios.bundleIdentifier",
      read: () => readJson(EXAMPLE_APP_JSON_PATH).expo?.ios?.bundleIdentifier ?? null,
      expected: expectedIdentifier,
      write: () => updateAppJson((appJson) => (appJson.expo.ios.bundleIdentifier = expectedIdentifier)),
    },
    {
      label: "example/app.json expo.android.package",
      read: () => readJson(EXAMPLE_APP_JSON_PATH).expo?.android?.package ?? null,
      expected: expectedIdentifier,
      write: () => updateAppJson((appJson) => (appJson.expo.android.package = expectedIdentifier)),
    },
  ];
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const { name } = readJson(PACKAGE_JSON_PATH);
  const mirrors = buildMirrors(name);

  let drifted = false;
  for (const mirror of mirrors) {
    const actual = mirror.read();
    if (actual === mirror.expected) {
      console.log(`OK: ${mirror.label} is "${mirror.expected}"`);
      continue;
    }
    if (checkOnly) {
      drifted = true;
      console.log(`DRIFT: ${mirror.label} is "${actual}", expected "${mirror.expected}"`);
      continue;
    }
    mirror.write();
    console.log(`FIXED: ${mirror.label} -> "${mirror.expected}"`);
  }

  if (checkOnly) {
    if (drifted) {
      console.error('One or more name mirrors are out of sync with package.json\'s "name" field.');
      console.error("Run `npm run sync:name` to fix, then re-run --check.");
      process.exitCode = 1;
    } else {
      console.log('All name mirrors match package.json\'s "name" field.');
    }
    return;
  }

  const rendered = renderReadme();
  fs.writeFileSync(README_PATH, rendered);
  console.log(`Regenerated README.md (${rendered.length} bytes).`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
