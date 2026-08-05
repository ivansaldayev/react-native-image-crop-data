#!/usr/bin/env node
/**
 * Generates README.md from README.template.md (plan step S11).
 *
 * Every code sample the README shows is lifted mechanically from the example app: the template
 * never spells out a recipe that runs there directly. Instead it carries an `include-snippet`
 * directive naming a file and a marker name; this script reads that file, extracts the text
 * between `// --- snippet:<name> ---` and `// --- /snippet:<name> ---`, rewrites the example's
 * local `"../lib"` / `"./lib"` import specifier to the real package name (read once, from
 * package.json, so the name has a single source), and inlines the result as a fenced code
 * block. `{{PACKAGE_NAME}}` tokens elsewhere in the template are substituted the same way.
 *
 * Two modes:
 *   node scripts/build-readme.mjs          - regenerate README.md
 *   node scripts/build-readme.mjs --check  - regenerate in memory, fail if README.md would change
 *
 * Recipes not exercised by the example app are written by hand, directly in the template, and
 * are never routed through this mechanism - doing so would misrepresent them as verified.
 *
 * The template lives at scripts/README.template.md, not the package root: npm unconditionally
 * force-includes any root-level file whose name starts with "readme" (case-insensitively) in
 * every published tarball, regardless of the package.json "files" allowlist - confirmed against
 * npm 10.9.3's own packing logic (npm-packlist's hardcoded `!/readme{,.*[^~$]}` strict rule,
 * which is layered with higher precedence than "files" and cannot be overridden by it). A
 * template at the package root named README.*.md would therefore ship alongside README.md
 * itself. The forced rule only anchors to the root, so nesting the template one directory down
 * avoids it without changing its filename.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE_PATH = path.join(ROOT, "scripts", "README.template.md");
const OUTPUT_PATH = path.join(ROOT, "README.md");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

const PACKAGE_NAME_TOKEN = "{{PACKAGE_NAME}}";
const INCLUDE_DIRECTIVE = /<!--\s*include-snippet\s+([\s\S]*?)\s*-->/g;
const ATTRIBUTE = /(\w+)="([^"]*)"/g;

function parseAttributes(raw) {
  const attributes = {};
  for (const match of raw.matchAll(ATTRIBUTE)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function extractSnippet(relativeFilePath, snippetName) {
  const absolutePath = path.join(ROOT, relativeFilePath);
  const text = fs.readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  const startMarker = `// --- snippet:${snippetName} ---`;
  const endMarker = `// --- /snippet:${snippetName} ---`;
  const startIndex = lines.findIndex((line) => line.trim() === startMarker);
  const endIndex = lines.findIndex((line) => line.trim() === endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(
      `Snippet "${snippetName}" not found in ${relativeFilePath} (expected markers "${startMarker}" / "${endMarker}").`,
    );
  }

  return lines.slice(startIndex + 1, endIndex).join("\n");
}

function rewriteLibImport(code, packageName) {
  return code.replace(
    /(from\s+|require\(\s*)(["'])\.\.?\/lib\2/g,
    (_match, prefix, quote) => `${prefix}${quote}${packageName}${quote}`,
  );
}

function renderIncludes(template, packageName) {
  return template.replace(INCLUDE_DIRECTIVE, (_match, rawAttributes) => {
    const { file, name, lang } = parseAttributes(rawAttributes);
    if (!file || !name || !lang) {
      throw new Error(`Malformed include-snippet directive (need file, name, lang attributes): ${rawAttributes}`);
    }
    const snippet = rewriteLibImport(extractSnippet(file, name), packageName);
    return "```" + lang + "\n" + snippet + "\n```";
  });
}

/** Regenerates the README content in memory, without touching disk. Reused by sync-name.mjs. */
export function renderReadme() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const withName = template.split(PACKAGE_NAME_TOKEN).join(pkg.name);
  return renderIncludes(withName, pkg.name);
}

function firstDifferingLine(existingText, renderedText) {
  const existingLines = existingText.split("\n");
  const renderedLines = renderedText.split("\n");
  let index = 0;
  while (
    index < existingLines.length &&
    index < renderedLines.length &&
    existingLines[index] === renderedLines[index]
  ) {
    index += 1;
  }
  return { index, existingLine: existingLines[index], renderedLine: renderedLines[index] };
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const rendered = renderReadme();

  if (!checkOnly) {
    fs.writeFileSync(OUTPUT_PATH, rendered);
    console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${rendered.length} bytes).`);
    return;
  }

  const existing = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, "utf8") : null;

  if (existing === rendered) {
    console.log("OK: README.md matches README.template.md + the example snippets.");
    return;
  }

  if (existing === null) {
    console.error("FAIL: README.md does not exist. Run `npm run docs:build` to generate it.");
  } else {
    const { index, existingLine, renderedLine } = firstDifferingLine(existing, rendered);
    console.error("FAIL: README.md is stale (does not match README.template.md + the example snippets).");
    console.error(`First difference at line ${index + 1}:`);
    console.error(`  README.md: ${existingLine ?? "(end of file)"}`);
    console.error(`  generated: ${renderedLine ?? "(end of file)"}`);
  }
  process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
