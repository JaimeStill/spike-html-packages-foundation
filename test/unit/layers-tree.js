// The layer's import cases as one file tree in the repository's shape: a file per forbidden import
// and form, each with the rules that catch it, and the imports the layer may make in the same
// layout. layers.test.js lints it.
// Adapted from spike-html-packages (7fb31a8): test/unit/layers-tree.js, cut to the foundation.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dirname, "../..");

/** The package's manifest as it stands, which the tree carries, so each import is judged against
 * it. */
export const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const foundation = manifest.name;

/** The sibling layers and the one package of spike-html-packages, which the foundation never
 * imports. */
const siblings = ["components", "sdk"].map((layer) => foundation.replace(/foundation$/, layer));
const one = foundation.replace(/-foundation$/, "");

// The rules a case names: the layer table, the two manifest rules, and the CSS module script rule.
export const table = "boundaries/dependencies";
export const extraneous = "import-x/no-extraneous-dependencies";
export const relativePackages = "import-x/no-relative-packages";
export const cssModule = "no-restricted-syntax";
/** The rules the lint flags the tree with, no-unresolved among them, which no case may draw. */
export const watched = [table, extraneous, relativePackages, cssModule, "import-x/no-unresolved"];

/** An edge in each of the four import forms, one file per form, each named for the edge and its
 * form: a side-effect import, a type import, a re-export, and an import(). */
function forms(base, specifier) {
  return {
    [`${base}.ts`]: `import "${specifier}";`,
    [`${base}-type.ts`]: `import type { X } from "${specifier}";`,
    [`${base}-export.ts`]: `export * from "${specifier}";`,
    [`${base}-dynamic.ts`]: `await import("${specifier}");`,
  };
}

/** `files`, each path to its source and the rules that flag it, sorted. */
function by(rules, files) {
  return Object.fromEntries(
    Object.entries(files).map(([path, source]) => [path, { source, rules: [...rules].sort() }]),
  );
}

// Each file holds one import, named for what it imports.
export const violations = {
  // Any package by name: the manifest declares no dependency, and the table allows no package. A
  // devDependency ships nothing, and the package's own name resolves to its build, not its src/.
  ...by([table, extraneous], {
    "src/lit.ts": `import { html } from "lit";`,
    ...forms("src/forms/lit", "lit"),
    ...forms("src/forms/components", `${siblings[0]}/status-badge.js`),
    ...forms("src/forms/sdk", `${siblings[1]}/client.js`),
    "src/one.ts": `import { define } from "${one}/foundation/dom.js";`,
    ...forms("src/forms/typescript", "typescript"),
    ...forms("src/forms/self-name", `${foundation}/dom.js`),
  }),
  // A package by a relative path into node_modules/.
  ...by([table, relativePackages], {
    "src/lit-path.ts": `import "../node_modules/lit/index.js";`,
  }),
  // A value import of a declaration file, in each value form, an inline `type` specifier among
  // them, since verbatimModuleSyntax keeps that import.
  ...by([table], {
    "src/format-value.ts": `import { formatBytes } from "./format.js";`,
    "src/format-side-effect.ts": `import "./format.js";`,
    "src/format-inline-type.ts": `import { type BytesOptions } from "./format.js";`,
    "src/format-export.ts": `export { formatBytes } from "./format.js";`,
    "src/format-export-all.ts": `export * from "./format.js";`,
    "src/format-dynamic.ts": `await import("./format.js");`,
    "src/nested/format-value.ts": `import { formatBytes } from "../format.js";`,
  }),
  // A .css import that isn't a static CSS module script.
  ...by([cssModule], {
    "src/css-side-effect.ts": `import "./x.css";`,
    "src/css-default.ts": `import sheet from "./x.css";`,
    "src/css-json.ts": `import sheet from "./x.css" with { type: "json" };`,
    "src/css-export.ts": `export { default } from "./x.css";`,
    "src/css-export-all.ts": `export * from "./x.css";`,
    "src/css-dynamic.ts": `await import("./x.css");`,
    "src/css-dynamic-json.ts": `await import("./x.css", { with: { type: "json" } });`,
    "src/css-dynamic-module.ts": `await import("./x.css", { with: { type: "css" } });`,
    "src/css-dynamic-quoted.ts": `await import("./x.css", { "with": { "type": "css" } });`,
    "src/css-dynamic-template.ts": "await import(`./x.css`, { with: { type: 'css' } });",
    "src/css-dynamic-computed.ts": "const name = 'x'; await import(`./${name}.css`);",
  }),
};

/** `cases`, each path to its source alone. */
export const sources = (cases) =>
  Object.fromEntries(Object.entries(cases).map(([path, { source }]) => [path, source]));

// Every import the layer may make, in each form, with names that hold dots, which a rule must tell
// from . and .. segments.
export const allowed = {
  "src/dom.ts": `export { x } from "./events.ts";`,
  "src/nested/own.ts": `import type { X } from "../dom.ts";\nawait import("../dom.ts");`,
  "src/nested/index.ts": `import "..";\nexport * from "./";`,
  "src/dotted.ts": `import "./..x/y.ts";\nimport "./.well-known/a.ts";`,
  "src/format-type.ts": `import type { formatBytes } from "./format.js";`,
  "src/format-export-type.ts": `export type { BytesOptions } from "./format.js";`,
  "src/format-typeof.ts": `import type { formatBytes } from "./format.js";\nexport type F = typeof formatBytes;`,
  "src/css-module.ts": `import sheet from "./x.css" with { type: "css" };`,
  "src/css-quoted.ts": `import sheet from "./x.css" with { "type": "css" };`,
  "src/css-export-module.ts": `export { default } from "./x.css" with { type: "css" };`,
};

/** The files the cases import that no case is: the modules, the declaration, the stylesheet, and
 * the package's build, which its own name resolves to. */
const targets = {
  "src/events.ts": "export const x = 1;",
  "src/index.ts": "export {};",
  "src/..x/y.ts": "export {};",
  "src/.well-known/a.ts": "export {};",
  "src/format.d.ts": [
    "export type BytesOptions = Omit<Intl.NumberFormatOptions, 'style' | 'unit'>;",
    "export declare function formatBytes(bytes: number): string;",
  ].join("\n"),
  "src/x.css": ".x {}",
  "dist/dom.js": "export {};",
  "dist/dom.d.ts": "export interface X {}",
};

/** The packages the cases name, as stubs in node_modules/: lit, the siblings, the one package,
 * and typescript, a devDependency, each a module and its types at every subpath. */
const externals = ["lit", ...siblings, one, "typescript"];
const stub = (name) => ({
  "package.json": JSON.stringify({
    name,
    type: "module",
    exports: {
      ".": { types: "./index.d.ts", default: "./index.js" },
      "./*": { types: "./index.d.ts", default: "./index.js" },
    },
  }),
  "index.js": "export const html = () => {};\nexport const define = () => {};",
  "index.d.ts": [
    "export declare const html: () => void;",
    "export declare const define: () => void;",
    "export interface X {}",
  ].join("\n"),
});

/** Writes `files` under `dir` with the manifest, the targets, the externals, and a link to the
 * package itself, as an install of its own name lays it out, so every import resolves and the lint
 * judges it. Returns the code files written under src/. */
export function writeTree(dir, files) {
  const written = { ...files, ...targets, "package.json": JSON.stringify(manifest) };
  for (const name of externals) {
    for (const [path, source] of Object.entries(stub(name))) {
      written[join("node_modules", name, path)] = source;
    }
  }
  for (const [path, source] of Object.entries(written)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), `${source}\n`);
  }
  const self = join(dir, "node_modules", foundation);
  mkdirSync(dirname(self), { recursive: true });
  symlinkSync(relative(dirname(self), dir), self);
  return Object.keys(written).filter((path) => path.startsWith("src/") && /\.(js|ts)$/.test(path));
}

/** ESLint's JSON report on the tree under `dir`'s src/. -c takes the repo's config, whose patterns
 * then match from the working directory, the tree, and whose plugins load from the repo's
 * node_modules. Throws when ESLint doesn't run or exits other than 0 or 1. */
export function lint(dir) {
  const eslint = join(root, "node_modules", ".bin", "eslint");
  const run = spawnSync(eslint, ["-c", join(root, "eslint.config.js"), "-f", "json", "src"], {
    cwd: dir,
    encoding: "utf8",
  });
  if (run.error) throw new Error(`eslint didn't run: ${run.error}`);
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(`eslint exited ${run.status}: ${run.stderr}`);
  }
  return JSON.parse(run.stdout);
}
