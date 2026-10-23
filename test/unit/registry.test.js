// The registry's store, shared by every copy of the module. A case's page is a fresh copy, imported
// by a URL no other case uses, after the store is removed from the global object.
// Adapted from spike-html-design v0.7.0 (fe75220): test/registry.test.js, on node:test.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const url = new URL("../../src/registry.ts", import.meta.url).href;
const KEY = Symbol.for("spike-html-design.registry");

/** The names v0.7.0's lean and full registration modules list, per facet, in order. */
const LEAN = { color: ["flexoki"], space: ["regular"], type: ["mono"] };
const FULL = {
  color: ["flexoki", "primer", "catppuccin", "everforest"],
  space: ["regular", "compact"],
  type: ["mono", "sans"],
};

/** A copy of the registry by the URL with the query, a module instance of its own. */
const copy = (query) => import(`${url}?${query}`);

let pages = 0;

/** A fresh page: the store removed, its own copy of the registry, and a copy() of that copy. */
async function page() {
  delete globalThis[KEY];
  const name = `page=${++pages}`;
  return { registry: await copy(name), copy: (suffix) => copy(`${name}&${suffix}`) };
}

/** Registers what v0.7.0's modules/register.js does, through the registry given. */
function registerLean({ register }) {
  register("color", "flexoki");
  register("space", "regular");
  register("type", "mono");
}

/** Registers what v0.7.0's modules/register-full.js does, through the registry given. */
function registerFull({ register }) {
  for (const name of ["flexoki", "primer", "catppuccin", "everforest"]) register("color", name);
  for (const name of ["regular", "compact"]) register("space", name);
  for (const name of ["mono", "sans"]) register("type", name);
}

/** The store at its global key, as JSON. */
const STORE = () => JSON.parse(JSON.stringify(globalThis[KEY]));

/** Each facet's names as the registry given lists them. */
const listed = ({ FACETS, profiles }) =>
  Object.fromEntries(FACETS.map((facet) => [facet, profiles(facet)]));

describe("registry", () => {
  test("two copies of the registry from two URLs share one store", async () => {
    // registry.html: copies a and b, the lean module run twice and the full module through the
    // page's copy, and an extension registering twice through a.
    const { registry, copy } = await page();
    const a = await copy("a");
    const b = await copy("b");
    registerLean(registry);
    registerLean(registry);
    registerFull(registry);
    a.register("color", "extension");
    a.register("color", "extension");
    assert.notEqual(a.register, b.register);
    // Copy b lists what the registration modules and copy a registered, each name once though
    // the lean module ran twice and the extension registered twice.
    const expected = { ...FULL, color: [...FULL.color, "extension"] };
    assert.deepEqual(listed(b), expected);
    assert.deepEqual(STORE(), expected);
  });

  test("the store is a plain object of the three facets' name lists", async () => {
    registerLean((await page()).registry);
    const store = globalThis[KEY];
    assert.deepEqual(
      [
        Object.getPrototypeOf(store) === Object.prototype,
        Object.keys(store),
        Object.values(store).every(Array.isArray),
      ],
      [true, ["color", "space", "type"], true],
    );
  });

  test("a copy that finds a store already there uses it, and adds a facet it lacks", async () => {
    // A store an older copy made, with no type facet: the new copy keeps it, and gives type its
    // list on first use.
    delete globalThis[KEY];
    const older = { color: ["flexoki"], space: [] };
    globalThis[KEY] = older;
    const registry = await copy(`page=${++pages}`);
    registry.register("type", "mono");
    assert.equal(globalThis[KEY], older);
    assert.deepEqual(STORE(), { color: ["flexoki"], space: [], type: ["mono"] });
  });

  test("profiles() returns a copy, so changing it changes no store", async () => {
    const { registry } = await page();
    registerLean(registry);
    registry.profiles("color").push("mutated");
    assert.deepEqual(registry.profiles("color"), ["flexoki"]);
    assert.deepEqual(STORE(), LEAN);
  });

  test("register throws on an unknown facet or an empty name, and registers nothing", async () => {
    const { registry } = await page();
    registerLean(registry);
    const thrown = (call) => {
      try {
        call();
        return null;
      } catch (error) {
        return [error.name, error.message];
      }
    };
    assert.deepEqual(
      thrown(() => registry.register("scheme", "dark")),
      ["TypeError", "registry: unknown facet scheme; expected one of color, space, type"],
    );
    assert.deepEqual(
      thrown(() => registry.profiles("palette")),
      ["TypeError", "registry: unknown facet palette; expected one of color, space, type"],
    );
    assert.deepEqual(
      thrown(() => registry.register("color", "")),
      ["TypeError", "registry: a color profile's name must be a non-empty string"],
    );
    assert.deepEqual(STORE(), LEAN);
  });
});
