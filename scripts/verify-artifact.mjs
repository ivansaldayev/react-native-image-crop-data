#!/usr/bin/env node
/**
 * Build & artifact validation for react-native-image-crop-data (plan step S9).
 *
 * Every gate below is meant to fail loudly and specifically instead of requiring a human to
 * eyeball a build log or a tarball. Run with `npm run verify`.
 *
 * Gates:
 *   1. Build produces ESM, CommonJS and .d.ts; every package.json entry point resolves to a
 *      real, non-empty file.
 *   2. T1 - the "worklet"; directive is the first statement of getDisplaySize's, clamp's and
 *      getMaxScale's function body, in both lib/module/ and lib/commonjs/.
 *   3. T1 - the reanimated/worklets babel plugin is not part of the library's own build.
 *   4. publint - no errors.
 *   5. attw --pack . - no problems, no suppressions.
 *   6. Real packed-tarball file listing - only lib/, src/, README.md (if present), LICENSE,
 *      package.json: no tests, no example/type-tests, no stray config files.
 *   7. No undeclared runtime dependency reaches the artifact (this library advertises being
 *      expo-free with an injectable renderer; the packaging promise gets checked structurally,
 *      not by grepping for the word "expo" - a third-party renderer name has every legitimate
 *      reason to appear in this library's own docs/JSDoc).
 *   8. Package-name single source (package.json's "name" field).
 *   9. Provenance hygiene: no private/internal network markers, no leftover config for a
 *      different CI system than the one this package ships with.
 */

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const failures = [];

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function fail(gate, message) {
  failures.push(`[${gate}] ${message}`);
  console.log(`FAIL: ${message}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });
}

function bin(name) {
  return path.join(ROOT, "node_modules", ".bin", name);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gate 1 - build produces ESM, CommonJS and .d.ts.
// ---------------------------------------------------------------------------
section("Gate 1/9 - build produces ESM, CommonJS and .d.ts");
{
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = run(npmCmd, ["run", "build"], { stdio: "inherit" });
  if (build.status !== 0) {
    fail("build", "`npm run build` exited non-zero; see output above.");
  } else {
    const exportsNode = pkg.exports?.["."];
    const mustExist = [
      ["lib/module/index.js", "ESM entry (lib/module/index.js)"],
      ["lib/commonjs/index.js", "CommonJS entry (lib/commonjs/index.js)"],
      [pkg.module, 'package.json "module" field target'],
      [pkg.types, 'package.json "types" field target'],
      [exportsNode?.import?.types, "exports['.'].import.types"],
      [exportsNode?.import?.default, "exports['.'].import.default"],
      [exportsNode?.require?.types, "exports['.'].require.types"],
      [exportsNode?.require?.default, "exports['.'].require.default"],
    ];
    for (const [rel, label] of mustExist) {
      if (!rel) {
        fail("build", `${label} is not declared in package.json`);
        continue;
      }
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
        fail("build", `${label} missing or empty: ${rel}`);
      } else {
        ok(`${label} present: ${rel}`);
      }
    }

    const moduleSrc = fs.readFileSync(path.join(ROOT, "lib/module/index.js"), "utf8");
    const cjsSrc = fs.readFileSync(path.join(ROOT, "lib/commonjs/index.js"), "utf8");
    if (!/\bexport\b/.test(moduleSrc)) {
      fail("build", "lib/module/index.js does not look like ESM output (no `export` keyword found)");
    } else {
      ok("lib/module/index.js contains ESM `export` syntax");
    }
    if (!/\brequire\(/.test(cjsSrc) || !/\bexports\b/.test(cjsSrc)) {
      fail("build", "lib/commonjs/index.js does not look like CommonJS output (no `require(`/`exports` found)");
    } else {
      ok("lib/commonjs/index.js contains CommonJS `require(`/`exports` usage");
    }
  }
}

// ---------------------------------------------------------------------------
// Gate 2 - T1: "worklet"; is the first statement of getDisplaySize's, clamp's and
// getMaxScale's body, in both lib/module/ and lib/commonjs/. Checked by position in the AST,
// not by substring presence anywhere in the file.
// ---------------------------------------------------------------------------
section('Gate 2/9 - T1: "worklet"; is the first statement of getDisplaySize/clamp/getMaxScale');

function findFunctionBody(sourceFile, fnName) {
  let body = null;
  const visit = (node) => {
    if (body) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === fnName && node.body) {
      body = node.body;
      return;
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === fnName && node.initializer) {
      const init = node.initializer;
      if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && ts.isBlock(init.body)) {
        body = init.body;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return body;
}

function assertWorkletFirst(relPath, fnName) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    fail("worklet-directive", `${relPath} does not exist (the build gate above should already have failed)`);
    return;
  }
  const text = fs.readFileSync(abs, "utf8");
  const sourceFile = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const body = findFunctionBody(sourceFile, fnName);
  if (!body) {
    fail("worklet-directive", `${relPath}: could not locate the "${fnName}" function body`);
    return;
  }
  const first = body.statements[0];
  const isWorkletDirective =
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteralLike(first.expression) &&
    first.expression.text === "worklet";
  if (!isWorkletDirective) {
    const preview = first ? first.getText(sourceFile).slice(0, 60) : "(empty body)";
    fail(
      "worklet-directive",
      `${relPath}: first statement of "${fnName}"'s body is not the "worklet"; directive (found: ${preview})`,
    );
  } else {
    ok(`${relPath}: "worklet"; is the first statement of "${fnName}"'s body`);
  }
}

for (const variant of ["module", "commonjs"]) {
  assertWorkletFirst(`lib/${variant}/core/getDisplaySize.js`, "getDisplaySize");
  assertWorkletFirst(`lib/${variant}/core/clamp.js`, "clamp");
  assertWorkletFirst(`lib/${variant}/core/getMaxScale.js`, "getMaxScale");
}

// ---------------------------------------------------------------------------
// Gate 3 - T1: the reanimated/worklets babel plugin is NOT part of the library's own build.
// Checked at four levels: our own babel config (none should exist), our bob target options
// (must not opt into reading one), bob's own installed default preset (the one actually used),
// and the compiled output (must carry no trace of the plugin having run).
// ---------------------------------------------------------------------------
section("Gate 3/9 - T1: reanimated/worklets babel plugin is not part of the library's own build");

const PLUGIN_MENTION = /reanimated|worklet/i;

const rootBabelConfigNames = [
  "babel.config.js",
  "babel.config.cjs",
  "babel.config.mjs",
  "babel.config.json",
  ".babelrc",
  ".babelrc.js",
  ".babelrc.cjs",
  ".babelrc.json",
];
let anyRootBabelConfig = false;
for (const name of rootBabelConfigNames) {
  const abs = path.join(ROOT, name);
  if (fs.existsSync(abs)) {
    anyRootBabelConfig = true;
    const content = fs.readFileSync(abs, "utf8");
    if (PLUGIN_MENTION.test(content)) {
      fail(
        "no-reanimated-in-build",
        `${name} (package root) references reanimated/worklets - it must not apply to the library's own build`,
      );
    } else {
      ok(`${name} exists at the package root but does not reference reanimated/worklets`);
    }
  }
}
if (!anyRootBabelConfig) {
  ok("no project-level babel config file at the package root (bob uses its own bundled preset)");
}

if (pkg.babel !== undefined) {
  if (PLUGIN_MENTION.test(JSON.stringify(pkg.babel))) {
    fail("no-reanimated-in-build", 'package.json "babel" field references reanimated/worklets');
  } else {
    ok('package.json has a "babel" field but it does not reference reanimated/worklets');
  }
} else {
  ok('package.json has no "babel" field');
}

const bobConfig = pkg["react-native-builder-bob"];
for (const target of bobConfig?.targets ?? []) {
  const [name, options] = Array.isArray(target) ? target : [target, {}];
  if (name === "module" || name === "commonjs") {
    if (options?.babelrc === true || options?.configFile === true) {
      fail(
        "no-reanimated-in-build",
        `bob target "${name}" sets babelrc/configFile to true, which would make bob read a project babel config`,
      );
    } else {
      ok(`bob target "${name}" does not opt into reading a project babel config (babelrc/configFile default to false)`);
    }
  }
}

let bobPresetPath = null;
try {
  const bobPkgPath = require.resolve("react-native-builder-bob/package.json", { paths: [ROOT] });
  bobPresetPath = path.join(path.dirname(bobPkgPath), "lib/src/configs/babel-preset.cjs");
} catch {
  bobPresetPath = null;
}
if (!bobPresetPath || !fs.existsSync(bobPresetPath)) {
  fail(
    "no-reanimated-in-build",
    "could not locate react-native-builder-bob's default babel preset file to inspect (its internal layout may have " +
      "changed) - re-verify manually against the installed bob version",
  );
} else {
  const presetContent = fs.readFileSync(bobPresetPath, "utf8");
  if (PLUGIN_MENTION.test(presetContent)) {
    fail("no-reanimated-in-build", `bob's default babel preset (${bobPresetPath}) references reanimated/worklets`);
  } else {
    ok(`bob's default babel preset (the one actually used, since babelrc/configFile are false) has no reanimated/worklets plugin`);
  }
}

let compiledPluginTrace = [];
for (const variant of ["module", "commonjs"]) {
  const libDir = path.join(ROOT, "lib", variant);
  if (!fs.existsSync(libDir)) continue;
  for (const file of walk(libDir).filter((f) => f.endsWith(".js"))) {
    const content = fs.readFileSync(file, "utf8");
    if (/react-native-reanimated\/plugin|react-native-worklets\/plugin/.test(content)) {
      compiledPluginTrace.push(path.relative(ROOT, file));
    }
  }
}
if (compiledPluginTrace.length > 0) {
  fail(
    "no-reanimated-in-build",
    `compiled output references the reanimated/worklets babel plugin:\n  ${compiledPluginTrace.join("\n  ")}`,
  );
} else {
  ok("compiled lib/ output carries no trace of the reanimated/worklets babel plugin having run");
}

// ---------------------------------------------------------------------------
// Gate 4 - publint, no errors. No --ignore-rules, no --profile (packaging decision, keep as is).
// ---------------------------------------------------------------------------
section("Gate 4/9 - publint (no errors, no suppressions)");
{
  const result = run(bin("publint"), [], { stdio: "inherit" });
  if (result.status !== 0) {
    fail("publint", "publint exited non-zero (errors found; see output above)");
  } else {
    ok("publint: no errors (exit code 0)");
  }
}

// ---------------------------------------------------------------------------
// Gate 5 - attw --pack ., no problems, no suppressions.
// ---------------------------------------------------------------------------
section("Gate 5/9 - attw --pack . (no problems, no suppressions)");
{
  const result = run(bin("attw"), ["--pack", "."], { stdio: "inherit" });
  if (result.status !== 0) {
    fail("attw", "attw --pack . exited non-zero (problems found; see output above)");
  } else {
    ok("attw --pack .: no problems (exit code 0)");
  }
}

// ---------------------------------------------------------------------------
// Gates 6, 7 & 9 all need the REAL packed tarball (not --dry-run: bytes on disk to extract),
// so it is packed and extracted once here and reused by all three.
// ---------------------------------------------------------------------------
let packageDir = null;
let allFiles = [];
{
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rncrop-verify-"));
  const packDestination = path.join(tmpRoot, "pack");
  const extractDestination = path.join(tmpRoot, "extracted");
  fs.mkdirSync(packDestination, { recursive: true });
  fs.mkdirSync(extractDestination, { recursive: true });

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const packResult = run(npmCmd, ["pack", "--silent", `--pack-destination=${packDestination}`], {
    stdio: "inherit",
  });
  if (packResult.status !== 0) {
    fail("pack", "`npm pack` exited non-zero");
  } else {
    const scopelessName = pkg.name.replace(/^@/, "").replace("/", "-");
    const tarballName = `${scopelessName}-${pkg.version}.tgz`;
    const tarballPath = path.join(packDestination, tarballName);
    if (!fs.existsSync(tarballPath)) {
      fail("pack", `expected tarball not found at ${tarballPath}`);
    } else {
      const extract = run("tar", ["-xzf", tarballPath, "-C", extractDestination]);
      if (extract.status !== 0) {
        fail("pack", `failed to extract ${tarballName}: ${extract.stderr}`);
      } else {
        packageDir = path.join(extractDestination, "package");
        allFiles = walk(packageDir).map((f) => path.relative(packageDir, f).split(path.sep).join("/"));
      }
    }
  }
}

function readPackedFile(relPath) {
  try {
    return fs.readFileSync(path.join(packageDir, relPath), "utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gate 6 - real packed tarball file listing: only lib/, src/, README.md (if present), LICENSE,
// package.json - no tests, no example/type-tests, no stray config files.
// ---------------------------------------------------------------------------
section("Gate 6/9 - real packed tarball: file listing");
if (!packageDir) {
  fail("pack-contents", "tarball unavailable (pack/extract step above failed)");
} else {
  const isAllowedTopLevel = (rel) =>
    rel === "package.json" || rel === "LICENSE" || rel === "README.md" || rel.startsWith("lib/") || rel.startsWith("src/");
  const unexpectedTopLevel = allFiles.filter((f) => !isAllowedTopLevel(f));
  if (unexpectedTopLevel.length > 0) {
    fail("pack-contents", `tarball contains paths outside lib/, src/, README.md, LICENSE, package.json:\n  ${unexpectedTopLevel.join("\n  ")}`);
  } else {
    ok(
      `tarball top level is exactly lib/, src/, package.json, LICENSE` +
        (allFiles.includes("README.md") ? ", README.md" : " (README.md not written yet)"),
    );
  }

  const forbiddenPathChecks = [
    [/(^|\/)example\//, "an example/ path"],
    [/(^|\/)type-tests\//, "a type-tests/ path"],
    [/(^|\/)node_modules\//, "a node_modules/ path"],
    [/(^|\/)__tests__\//, "a __tests__ path"],
    [/\.test\.tsx?$/, "a .test.ts(x) source file"],
    [/\.test\.jsx?$/, "a .test.js(x) source file"],
    [/(^|\/)(tsconfig[^/]*\.json|tsconfig\.contract\.json|jest\.config\.js|\.editorconfig|\.gitignore|\.npmignore|package-lock\.json|babel\.config\.[cm]?js)$/, "a root config file"],
  ];
  for (const [pattern, label] of forbiddenPathChecks) {
    const hits = allFiles.filter((f) => pattern.test(f));
    if (hits.length > 0) {
      fail("pack-contents", `tarball must not contain ${label}, found:\n  ${hits.join("\n  ")}`);
    }
  }
  if (forbiddenPathChecks.every(([pattern]) => allFiles.filter((f) => pattern.test(f)).length === 0)) {
    ok("tarball contains no example/, type-tests/, node_modules/, tests, or root config files");
  }
}

// ---------------------------------------------------------------------------
// Gate 7 - no undeclared runtime dependency reaches the artifact. This library's whole point is
// an injectable renderer so it never depends on any specific one (e.g. expo-image); that
// packaging promise is checked structurally (dependency fields, import/require specifiers in
// the compiled output), not by grepping for the word "expo" - a third-party renderer name has
// every legitimate reason to appear in this library's own JSDoc/README (it is a documented,
// intentional compatibility example, not a leak), so a blind substring match would be both
// wrong (flags expected content) and pointless (does not test the actual promise).
// ---------------------------------------------------------------------------
section("Gate 7/9 - no undeclared runtime dependency (e.g. expo) reaches the artifact");
if (!packageDir) {
  fail("dependency-leak", "tarball unavailable (pack/extract step above failed)");
} else {
  const expoDependencyKeys = Object.keys({
    ...(pkg.dependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
    ...(pkg.peerDependenciesMeta ?? {}),
  }).filter((k) => k.startsWith("expo"));
  if (expoDependencyKeys.length > 0) {
    fail("dependency-leak", `dependencies/peerDependencies/peerDependenciesMeta contain expo package(s): ${expoDependencyKeys.join(", ")}`);
  } else {
    ok("no expo* package in dependencies/peerDependencies/peerDependenciesMeta");
  }

  const importSpecifierPattern = /(?:require\(\s*['"]|from\s+['"]|import\(\s*['"])expo[^'"]*['"]/;
  const expoImportHits = allFiles.filter((f) => {
    if (!f.startsWith("lib/")) return false;
    const content = readPackedFile(f);
    return content !== null && importSpecifierPattern.test(content);
  });
  if (expoImportHits.length > 0) {
    fail("dependency-leak", `compiled output imports/requires an expo* package:\n  ${expoImportHits.join("\n  ")}`);
  } else {
    ok("no lib/ file imports or requires an expo* package");
  }

  const expoProseHits = allFiles.filter((f) => {
    const content = readPackedFile(f);
    return content !== null && /\bexpo\b/i.test(content);
  });
  if (expoProseHits.length > 0) {
    console.log(
      `NOTE: a third-party renderer name is mentioned in prose/JSDoc (expected - it is a documented compatible ` +
        `renderer, not a dependency), not a failure:\n  ${expoProseHits.join("\n  ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Gate 8 - package-name single source.
// ---------------------------------------------------------------------------
section("Gate 8/9 - package-name single source");
{
  const NAME = "react-native-image-crop-data";
  if (pkg.name !== NAME) {
    fail("package-name", `package.json name is "${pkg.name}", expected "${NAME}"`);
  } else {
    ok(`package.json name is "${NAME}"`);
  }

  // Scope: this gate is specifically about package.json - the file BUILD owns - being the one
  // authored source of truth for the name, per the S9 task spec ("exactly one authored
  // occurrence of the package name (package.json -> name)"). It deliberately does NOT sweep the
  // rest of the repo: once the name legitimately appears in README prose, example/package.json's
  // dependency key, example/src/lib.ts's barrel, example/app.json's display name, etc. (brief
  // §5), telling an expected mirror/prose mention apart from a stale duplicate requires the
  // context DOCS's `sync-name.mjs --check` and the pre-publication sweep are built for -
  // duplicating a partial version of that here produced exactly the false positives it was
  // meant to avoid.
  // The GitHub linkage fields (repository.url, homepage, bugs.url) necessarily embed the name -
  // the repo is named after the package, and npm needs these fields to rewrite the README's
  // relative links/images on the package page. They are not a second *authored* source: each one
  // is validated below as exactly the URL derived from the name (one owner, taken from
  // repository.url; repo segment strictly equal to NAME) and only then excluded from the
  // occurrence count. A hand-edited or drifted URL still fails the gate.
  const pkgJsonText = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");
  let countedText = pkgJsonText;
  const linkageFields = [
    ["repository.url", pkg.repository?.url, (owner) => `git+https://github.com/${owner}/${NAME}.git`],
    ["homepage", pkg.homepage, (owner) => `https://github.com/${owner}/${NAME}#readme`],
    ["bugs.url", pkg.bugs?.url, (owner) => `https://github.com/${owner}/${NAME}/issues`],
  ].filter(([, value]) => value !== undefined);
  if (linkageFields.length > 0) {
    const ownerMatch = /^git\+https:\/\/github\.com\/([^/]+)\/(.+)\.git$/.exec(pkg.repository?.url ?? "");
    if (!ownerMatch || ownerMatch[2] !== NAME) {
      fail(
        "package-name",
        `repository.url is "${pkg.repository?.url}"; the GitHub linkage fields require it to be ` +
          `"git+https://github.com/<owner>/${NAME}.git" so the owner for the other URLs has one source`,
      );
    } else {
      const owner = ownerMatch[1];
      for (const [label, value, derive] of linkageFields) {
        const expected = derive(owner);
        if (value === expected) {
          ok(`${label} is exactly the URL derived from the package name`);
          countedText = countedText.split(value).join("");
        } else {
          fail("package-name", `${label} is "${value}", expected "${expected}" (derived from the name)`);
        }
      }
    }
  }
  const occurrencesInPkgJson = countedText.split(NAME).length - 1;
  if (occurrencesInPkgJson !== 1) {
    fail(
      "package-name",
      `package.json contains "${NAME}" ${occurrencesInPkgJson} time(s); expected exactly 1 (the "name" field)`,
    );
  } else {
    ok('package.json contains the package name exactly once (the "name" field)');
  }
}

// ---------------------------------------------------------------------------
// Gate 9 - packaging hygiene: private/internal network markers have no legitimate reason to
// appear in any published package, and a leftover config for a different CI system than the one
// this package ships with is ordinary OSS hygiene (a package migrating CI providers should not
// leave the old provider's file behind).
// ---------------------------------------------------------------------------
section("Gate 9/9 - provenance hygiene (no private network markers, no foreign CI config)");
{
  const PRIVATE_IPV4 =
    /\b(?:127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/;
  const PROVENANCE_CHECKS = [
    { name: "private IPv4 address (RFC1918/loopback)", test: (t) => PRIVATE_IPV4.test(t) },
    {
      name: "non-public hostname (.internal/.intranet/localhost)",
      test: (t) => /\b[\w-]+\.(?:internal|intranet)\b/i.test(t) || /\blocalhost\b/i.test(t),
    },
  ];

  if (!packageDir) {
    fail("provenance", "tarball unavailable (pack/extract step above failed)");
  } else {
    const provenanceHits = [];
    for (const file of allFiles) {
      const content = readPackedFile(file);
      if (content === null) continue;
      for (const check of PROVENANCE_CHECKS) {
        if (check.test(content)) {
          provenanceHits.push(`${file}: ${check.name}`);
        }
      }
    }
    if (provenanceHits.length > 0) {
      fail("provenance", `private network markers found in the packed tarball:\n  ${provenanceHits.join("\n  ")}`);
    } else {
      ok("no private-network markers (RFC1918/loopback IPs, non-public hostnames) in the packed tarball");
    }
  }

  if (pkg.publishConfig?.registry && !/^https:\/\/registry\.npmjs\.org\/?$/.test(pkg.publishConfig.registry)) {
    fail("provenance", `package.json publishConfig.registry points at a non-public registry: ${pkg.publishConfig.registry}`);
  } else {
    ok("no private publishConfig.registry declared in package.json");
  }

  // Source-tree check (CI configs are never part of the npm `files` allowlist, so the tarball
  // has nothing to say here): a package should carry exactly one CI system's config.
  const foreignCiConfigPaths = [
    ".travis.yml",
    ".circleci/config.yml",
    "Jenkinsfile",
    "azure-pipelines.yml",
    ".gitlab-ci.yml",
    "bitbucket-pipelines.yml",
    "appveyor.yml",
    ".drone.yml",
  ];
  const foundForeignCi = foreignCiConfigPaths.filter((rel) => fs.existsSync(path.join(ROOT, rel)));
  if (foundForeignCi.length > 0) {
    fail(
      "provenance",
      `found configuration for a CI system other than the one this package ships with (.github/workflows): ${foundForeignCi.join(", ")}`,
    );
  } else {
    ok("no leftover configuration for a different CI system alongside .github/workflows");
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
section("Summary");
if (failures.length > 0) {
  console.log(`${failures.length} gate check(s) failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log("All gates passed.");
  process.exit(0);
}
