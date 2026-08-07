# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

`react-native-image-crop-data` — non-destructive image cropping for React Native. The library
produces a crop as **data** (`CropData`), replayable on any renderer; pixels are only cut on an
explicit export step. Library source lives in `src/`; the demo/consumer app lives in `example/`
(Expo) and depends on the library via `"react-native-image-crop-data": "file:.."`.

## Critical: rebuild after editing library source

**Edits under `src/` do NOT reach the example app until you run `npm run build` at the repo
root.** The `file:..` dependency is a symlink, but the package's `main`/`exports` point at the
built `lib/` output — Metro bundles `lib/commonjs/`, never `src/`. The symptom of forgetting
this is silent: the app runs, pulls a fresh bundle, and behaves exactly as before the edit.

Workflow for verifying a library change in the example app:

1. Edit `src/`.
2. `npm run build` (repo root).
3. Reload the app — `lib/` is inside Metro's `watchFolders`, so a reload picks it up. If it
   seems stale, restart Metro with `npx expo start --host lan --clear` (from `example/`).

## Commands (repo root)

- `npm run typecheck` — TypeScript, no emit.
- `npm test` — Jest (pure-function tests in `src/core/__tests__/`; no gesture/component tests,
  gesture behavior is verified on a device via the example app).
- `npm run build` — clean + `bob build` into `lib/` (commonjs, module, typescript targets).
- `npm run docs:build` / `npm run docs:check` — regenerate / verify README (see below).
- `npm run verify` — artifact gates over the packed tarball.

## README is generated — never edit it directly

`README.md` is generated from `scripts/README.template.md` by `scripts/build-readme.mjs`, which
inlines code snippets lifted from the example app (`include-snippet` directives) and substitutes
`{{PACKAGE_NAME}}`. Edit the template (or the example source the snippets come from), then run
`npm run docs:build`. CI-style check: `npm run docs:check`.

## Example app / Metro

- Start Metro **only from `example/`** (`npx expo start --host lan`), never from the repo root:
  the root deliberately has no babel config (enforced by a verify-artifact gate), so a root
  `expo start` builds a broken bundle and pollutes the root (`tsconfig.json` edit, `.expo/`).
- `example/metro.config.js` deduplicates the library's peer dependencies across the `file:..`
  symlink (watchFolders + blockList + extraNodeModules). Its blockList regexes are built
  segment-by-segment with `[\\/]` and carry **no flags** — Metro requires identical flags
  across all blockList patterns, so never add `i` there.
