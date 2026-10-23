// A release's shape: its exports map walked by Node's rules, and a pack of the build checked
// against the sources, package.json's files and exports, and the Apache 2.0 LICENSE its manifest
// declares. test/unit/release.test.js runs it on a pnpm pack.
// Adapted from spike-html-packages (7fb31a8): test/consumers/release.js, cut to one package.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

/** Every file below `dir`, relative to it with / separators, sorted. */
export function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .filter((path) => statSync(join(dir, path)).isFile())
    .map((path) => path.split(sep).join("/"))
    .sort();
}

/** The conditions of an exports entry, as { condition: target }; a bare target is "default", and
 * null, which excludes its subpath, has none. */
export function conditions(entry) {
  return typeof entry === "string" ? { default: entry } : { ...entry };
}

/** A key's or target's parts around its one *, or undefined when it holds none. */
function star(pattern) {
  const at = pattern.indexOf("*");
  return at < 0 ? undefined : { prefix: pattern.slice(0, at), suffix: pattern.slice(at + 1) };
}

/** Node's PATTERN_KEY_COMPARE: the longer prefix before the * first, then the longer key. */
function compareKeys(a, b) {
  const [pa, pb] = [a.indexOf("*"), b.indexOf("*")];
  return pb - pa || b.length - a.length;
}

/** The key a subpath matches and its conditions, the * replaced, by Node's rules, or undefined. */
export function resolveExport(exports, subpath) {
  if (Object.hasOwn(exports, subpath) && !subpath.includes("*")) {
    return { key: subpath, targets: conditions(exports[subpath]) };
  }
  const [key] = Object.keys(exports)
    .filter((candidate) => {
      const parts = star(candidate);
      return (
        parts !== undefined &&
        subpath.length >= candidate.length &&
        subpath.startsWith(parts.prefix) &&
        subpath.endsWith(parts.suffix)
      );
    })
    .sort(compareKeys);
  if (key === undefined) return undefined;
  const parts = star(key);
  const value = subpath.slice(parts.prefix.length, subpath.length - parts.suffix.length);
  const targets = Object.entries(conditions(exports[key])).map(([condition, target]) => [
    condition,
    target.replace("*", value),
  ]);
  return { key, targets: Object.fromEntries(targets) };
}

/** Each { subpath, key, condition } resolving to the file, by a key that wins the subpath. */
export function subpathsOf(exports, file) {
  const path = `./${file}`;
  const found = [];
  for (const [key, entry] of Object.entries(exports)) {
    for (const target of Object.values(conditions(entry))) {
      if (typeof target !== "string") continue;
      const parts = star(target);
      let subpath;
      if (parts === undefined) {
        if (target === path) subpath = key;
      } else if (
        path.length >= parts.prefix.length + parts.suffix.length &&
        path.startsWith(parts.prefix) &&
        path.endsWith(parts.suffix)
      ) {
        subpath = key.replace(
          "*",
          path.slice(parts.prefix.length, path.length - parts.suffix.length),
        );
      }
      if (subpath === undefined || found.some((f) => f.subpath === subpath)) continue;
      const resolved = resolveExport(exports, subpath);
      for (const [condition, resolvedPath] of Object.entries(resolved?.targets ?? {})) {
        if (resolvedPath === path) found.push({ subpath, key: resolved.key, condition });
      }
    }
  }
  return found;
}

/** The dist/ paths a source in src/ ships as. */
export function builtFrom(source) {
  if (source.endsWith(".d.ts") || source.endsWith(".css")) return [`dist/${source}`];
  if (source.endsWith(".ts")) {
    const base = source.slice(0, -".ts".length);
    return [`dist/${base}.js`, `dist/${base}.d.ts`];
  }
  return [];
}

/** The files every pack carries whatever package.json's files lists. */
const always = ["LICENSE", "README.md", "package.json"];

/** The license every release declares, and the text its LICENSE opens with. */
const license = "Apache-2.0";
const licenseHeading = /^\s*Apache License\s+Version 2\.0, January 2004\s/;

/** What keeps root, a pack's package/, from carrying the license its package.json declares, one
 * line each: the declaration and the LICENSE beside package.json. */
export function licenseProblems(root) {
  const problems = [];
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (manifest.license !== license) {
    problems.push(`package.json declares license ${manifest.license}, not ${license}`);
  }
  const path = join(root, "LICENSE");
  if (!existsSync(path)) problems.push("LICENSE is missing");
  else if (!licenseHeading.test(readFileSync(path, "utf8"))) {
    problems.push("LICENSE isn't the Apache License 2.0");
  }
  return problems;
}

/** What keeps root, a pack's package/, from being the release its package.json declares for the
 * sources in `src`, one line each. */
export function releaseProblems(root, src) {
  const problems = licenseProblems(root);
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const { exports = {}, files = [] } = manifest;
  const packed = listFiles(root);
  const built = packed.filter((path) => path.startsWith("dist/"));
  const builtSet = new Set(built);

  // The pack is the build and the files every pack carries, and nothing else.
  if (!packed.includes("README.md")) problems.push("the pack has no README.md");
  for (const path of packed) {
    if (!path.startsWith("dist/") && !always.includes(path)) {
      problems.push(`${path} is packed but isn't the build, ${always.join(", ")}`);
    }
  }

  // The build against the sources: each source's emit or copy is there, and nothing else is.
  const expected = new Set();
  for (const source of listFiles(src)) {
    const outputs = builtFrom(source);
    if (outputs.length === 0) problems.push(`src/${source} isn't a .ts, .d.ts, or .css source`);
    for (const output of outputs) {
      expected.add(output);
      if (!builtSet.has(output)) problems.push(`src/${source} has no built ${output}`);
    }
  }
  for (const path of built) {
    if (!expected.has(path)) problems.push(`${path} is built from no source`);
  }

  // files ships the build: each built file lies under an entry of files.
  const shipped = (path) =>
    files.some(
      (entry) =>
        path === entry.replace(/\/$/, "") || path.startsWith(`${entry.replace(/\/$/, "")}/`),
    );
  for (const path of built) {
    if (!shipped(path)) problems.push(`${path} isn't under package.json's files`);
  }

  // exports: every entry well formed or null, which excludes its subpath, every built file
  // reachable, every pattern key reaching a built file, and every target a reachable subpath or an
  // exact key resolves to built.
  const subpaths = new Set();
  const used = new Set();
  for (const [key, entry] of Object.entries(exports)) {
    if (entry === null) continue;
    const targets = Object.values(conditions(entry));
    if (targets.length === 0 || targets.some((target) => typeof target !== "string")) {
      problems.push(`exports["${key}"] isn't a target or a flat object of condition targets`);
    } else if (!key.includes("*")) {
      subpaths.add(key);
    }
  }
  for (const path of built) {
    const reached = subpathsOf(exports, path);
    if (reached.length === 0) problems.push(`${path} is reachable through no export`);
    for (const { subpath, key } of reached) {
      subpaths.add(subpath);
      used.add(key);
    }
  }
  for (const key of Object.keys(exports)) {
    if (key.includes("*") && !used.has(key))
      problems.push(`exports["${key}"] reaches no built file`);
  }
  for (const subpath of subpaths) {
    for (const [condition, target] of Object.entries(
      resolveExport(exports, subpath)?.targets ?? {},
    )) {
      if (typeof target !== "string") continue;
      const path = target.replace(/^\.\//, "");
      if (!builtSet.has(path)) {
        problems.push(`exports["${subpath}"] ${condition} points at ${target}, which isn't built`);
      }
    }
  }
  return problems;
}
