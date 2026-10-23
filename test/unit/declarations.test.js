// The foundation's formatters are declarations alone, and tsc, under tsconfig.json, refuses runtime
// code in a declaration file, run against scratch trees.
// From spike-html-conventions (a88828a): test/declarations.test.js.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = join(import.meta.dirname, "../..");
// The check's own tsc, mise.toml's TypeScript-Go pin, not the typescript package in node_modules.
const tsc = "tsc";

/** Each "path code" tsc reports, sorted, for `files` (paths under layers/ to sources) in scratch. */
function check(files) {
  const scratch = mkdtempSync(join(tmpdir(), "declarations-"));
  try {
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(join(scratch, "layers", path, ".."), { recursive: true });
      writeFileSync(join(scratch, "layers", path), `${source}\n`);
    }
    writeFileSync(
      join(scratch, "tsconfig.json"),
      JSON.stringify({ extends: join(root, "tsconfig.json"), include: ["layers"] }),
    );
    const run = spawnSync(tsc, ["--noEmit", "-p", "."], { cwd: scratch, encoding: "utf8" });
    assert.equal(run.error, undefined, `tsc didn't run: ${run.error}`);
    const errors = [...run.stdout.matchAll(/^layers\/(\S+)\(\d+,\d+\): error (TS\d+)/gm)];
    // An error outside the scratch layers/ (a config tsc can't read, say) would leave the list
    // empty and pass the cases that expect none, so every error tsc reports must be one of these.
    assert.equal(run.stdout.match(/error TS\d+/g)?.length ?? 0, errors.length, run.stdout);
    return errors.map(([, path, code]) => `${path} ${code}`).sort();
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const runtime = {
  "statement.d.ts": `export interface A {}\nconsole.log("runs");`,
  "body.d.ts": `export declare function f(): number;\nexport function g(): number { return 1; }`,
  "binding.d.ts": `let count = 0;`,
  "method.d.ts": `export declare class C { m(): void { } }`,
  "format.d.ts": `export declare function formatBytes(bytes: number): string;\nformatBytes(1);`,
};

// skipLibCheck off is the guard: with it on, tsc skips every .d.ts, and these errors with them.
describe("formatter declarations", () => {
  // A source beside format.d.ts (format.ts, format.js, ...) is what an import of format.js would
  // resolve to, past the declaration and the check's type-import rule, so none may stand there.
  test("the formatters are a declaration file alone", () => {
    const formats = readdirSync(join(root, "src")).filter((name) => name.startsWith("format."));
    assert.deepEqual(formats, ["format.d.ts"]);
  });

  test("tsc, under tsconfig.json, refuses runtime code in a declaration file", () => {
    assert.deepEqual(check(runtime), [
      "binding.d.ts TS1039",
      "binding.d.ts TS1046",
      "body.d.ts TS1183",
      "format.d.ts TS1036",
      "method.d.ts TS1183",
      "statement.d.ts TS1036",
    ]);
  });

  test("tsc, under tsconfig.json, checks a declaration file's types", () => {
    assert.deepEqual(check({ "types.d.ts": `export type A = Missing;` }), ["types.d.ts TS2304"]);
  });

  test("tsc accepts declarations alone", () => {
    assert.deepEqual(
      check({
        "ok.d.ts": [
          `export type BytesOptions = Omit<Intl.NumberFormatOptions, "style" | "unit">;`,
          `export interface RelativeOptions extends Intl.RelativeTimeFormatOptions { now?: Date }`,
          `export declare const a: BytesOptions;`,
          `export declare function f(x: number): string;`,
        ].join("\n"),
      }),
      [],
    );
  });
});
