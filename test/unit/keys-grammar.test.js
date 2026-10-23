// The keys family's binding grammar, on src/keys-grammar.ts as node runs it.
// Adapted from spike-html-design v0.7.0 (fe75220): test/keys-grammar.test.js, on node:test.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  keyshortcuts,
  labels,
  matches,
  normalize,
  parse,
  problem,
  stringify,
} from "../../src/keys-grammar.ts";

// press builds a parsed press: key, then the modifiers it holds.
const press = (key, held = {}) => ({
  key,
  control: false,
  alt: false,
  meta: false,
  shift: false,
  ...held,
});

// event builds a keydown-like object, a US layout's code for an ASCII letter or digit unless
// given, and no modifier unless given.
function event(key, held = {}) {
  const code = /^[a-z]$/i.test(key)
    ? `Key${key.toUpperCase()}`
    : /^[0-9]$/.test(key)
      ? `Digit${key}`
      : "";
  return { key, code, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...held };
}

// pressed reports whether the first press of binding's first alternative matches e.
const pressed = (binding, e, options) => matches(parse(binding, options)[0][0], e);

describe("keys grammar: parse", () => {
  test("a letter is one press, lowercase, Shift up", () => {
    assert.deepEqual(parse("t"), [[press("t")]]);
    assert.deepEqual(parse("T"), [[press("t")]]);
  });

  test("a space separates the presses of a sequence, and a comma the alternatives", () => {
    assert.deepEqual(parse("g t"), [[press("g"), press("t")]]);
    assert.deepEqual(parse("g  t"), [[press("g"), press("t")]]);
    assert.deepEqual(parse("j, ArrowDown"), [[press("j")], [press("ArrowDown")]]);
  });

  test("+ joins modifiers to one key, their names folding case into normal order", () => {
    const all = press("k", { control: true, alt: true, meta: true, shift: true });
    assert.deepEqual(parse("shift+meta+ALT+control+k"), [[all]]);
    assert.equal(normalize("shift+meta+ALT+control+k"), "Control+Alt+Meta+Shift+K");
  });

  test("Mod is Meta on macOS and Control elsewhere", () => {
    assert.deepEqual(parse("Mod+k", { mac: true }), [[press("k", { meta: true })]]);
    assert.deepEqual(parse("Mod+k"), [[press("k", { control: true })]]);
    assert.equal(normalize("mod+k", { mac: false }), "Control+k");
  });

  test("Shift+T and Shift+t both require Shift", () => {
    assert.deepEqual(parse("Shift+T"), [[press("t", { shift: true })]]);
    assert.deepEqual(parse("Shift+t"), [[press("t", { shift: true })]]);
    assert.equal(normalize("Shift+t"), "Shift+T");
  });

  test("a symbol is the character typed, and Shift is dropped from it", () => {
    assert.deepEqual(parse("?"), [[press("?")]]);
    assert.deepEqual(parse("Shift+?"), [[press("?")]]);
    assert.deepEqual(parse("Alt+Shift+?"), [[press("?", { alt: true })]]);
  });

  test("Plus and Space name those keys, and a named key is its event.key", () => {
    assert.deepEqual(parse("Control+Plus"), [[press("+", { control: true })]]);
    assert.deepEqual(parse("space"), [[press(" ")]]);
    assert.deepEqual(parse("Escape"), [[press("Escape")]]);
    assert.equal(normalize("Control+plus, Shift+Space"), "Control+Plus, Shift+Space");
  });

  const MALFORMED = {
    empty: "",
    blank: "  ",
    "an empty alternative": "a,,b",
    "a trailing comma": "a,",
    "a trailing +": "Control+",
    "a bare +": "+",
    "a + between nothing": "Shift++",
    "two keys in a combination": "a+b",
    "an unknown modifier": "Ctrl+k",
    "a repeated modifier": "Shift+shift+k",
    "Mod and the modifier it resolves to": "Mod+Control+k",
    "a modifier alone": "Shift",
    "Mod alone": "mod",
    "a misspelled named key": "escape",
    "a word that names no key": "Control+key",
  };
  for (const [name, binding] of Object.entries(MALFORMED)) {
    test(`a binding with ${name} is malformed: it parses to null and problem says why`, () => {
      assert.equal(parse(binding), null);
      assert.equal(normalize(binding), null);
      assert.equal(typeof problem(binding), "string");
    });
  }

  test("a binding that isn't a string is malformed", () => {
    assert.equal(parse(undefined), null);
    assert.equal(problem(42), "a binding must be a string");
  });

  test("problem is null for a binding that parses", () => {
    assert.equal(problem("g t, Alt+T, ?"), null);
  });
});

describe("keys grammar: stringify", () => {
  test("writes a binding, a sequence, or a press in normal form", () => {
    const binding = parse("g T, ALT+t, shift+?");
    assert.equal(stringify(binding), "g t, Alt+t, ?");
    assert.equal(stringify(binding[0]), "g t");
    assert.equal(stringify(binding[1][0]), "Alt+t");
  });
});

describe("keys grammar: matches", () => {
  test("a letter matches either case while Shift is up, so caps lock doesn't defeat it", () => {
    assert.equal(pressed("t", event("t")), true);
    assert.equal(pressed("t", event("T")), true);
    assert.equal(pressed("t", event("T", { shiftKey: true })), false);
    assert.equal(pressed("t", event("y")), false);
  });

  test("Shift+T requires Shift, in either case", () => {
    assert.equal(pressed("Shift+T", event("T", { shiftKey: true })), true);
    assert.equal(pressed("Shift+T", event("t", { shiftKey: true })), true);
    assert.equal(pressed("Shift+T", event("t")), false);
    assert.equal(pressed("Shift+T", event("T")), false);
  });

  test("a symbol matches its character with Shift held or not", () => {
    assert.equal(pressed("?", event("?", { code: "Slash", shiftKey: true })), true);
    assert.equal(pressed("?", event("?", { code: "Minus" })), true);
    assert.equal(pressed("?", event("/", { code: "Slash" })), false);
  });

  test("Control, Alt, and Meta must be held exactly as written", () => {
    assert.equal(pressed("t", event("t", { ctrlKey: true })), false);
    assert.equal(pressed("t", event("t", { metaKey: true })), false);
    assert.equal(pressed("t", event("t", { altKey: true })), false);
    assert.equal(pressed("?", event("?", { ctrlKey: true })), false);
    assert.equal(pressed("Control+k", event("k", { ctrlKey: true })), true);
    assert.equal(pressed("Control+k", event("k", { ctrlKey: true, altKey: true })), false);
    assert.equal(pressed("Control+k", event("k")), false);
  });

  test("Mod matches Meta on macOS and Control elsewhere", () => {
    assert.equal(pressed("Mod+k", event("k", { metaKey: true }), { mac: true }), true);
    assert.equal(pressed("Mod+k", event("k", { ctrlKey: true }), { mac: true }), false);
    assert.equal(pressed("Mod+k", event("k", { ctrlKey: true })), true);
    assert.equal(pressed("Mod+k", event("k", { metaKey: true })), false);
  });

  test("with Alt held, letters and digits match by event.code", () => {
    // macOS Option+t types †, and Option+1 types ¡.
    assert.equal(pressed("Alt+t", event("†", { code: "KeyT", altKey: true })), true);
    assert.equal(pressed("Alt+t", event("t", { code: "KeyY", altKey: true })), false);
    assert.equal(pressed("Alt+1", event("¡", { code: "Digit1", altKey: true })), true);
    assert.equal(
      pressed("Alt+Shift+T", event("ˇ", { code: "KeyT", altKey: true, shiftKey: true })),
      true,
    );
    assert.equal(pressed("Alt+Shift+T", event("†", { code: "KeyT", altKey: true })), false);
  });

  test("a letter outside ASCII falls back to event.code, so the Russian layout's о is j", () => {
    assert.equal(pressed("j", event("о", { code: "KeyJ" })), true);
    assert.equal(pressed("j", event("О", { code: "KeyJ" })), true);
    assert.equal(pressed("k", event("о", { code: "KeyJ" })), false);
  });

  test("a digit and a named key match their event.key", () => {
    assert.equal(pressed("1", event("1")), true);
    assert.equal(pressed("1", event("!", { code: "Digit1", shiftKey: true })), false);
    assert.equal(pressed("Escape", event("Escape", { code: "Escape" })), true);
    assert.equal(pressed("Space", event(" ", { code: "Space" })), true);
    assert.equal(pressed("Shift+Enter", event("Enter", { code: "Enter" })), false);
  });
});

describe("keys grammar: formatting", () => {
  // The demo: "g t", "Alt+T", and "?" in every form.
  const FORMATS = {
    "g t": {
      normal: "g t",
      labels: [[["G"], ["T"]]],
      keyshortcuts: null,
    },
    "Alt+T": {
      normal: "Alt+t",
      labels: [[["Alt", "T"]]],
      keyshortcuts: "Alt+T",
    },
    "?": {
      normal: "?",
      labels: [[["?"]]],
      keyshortcuts: "Shift+/",
    },
  };
  for (const [binding, expected] of Object.entries(FORMATS)) {
    test(`formats ${binding} every way`, () => {
      const parsed = parse(binding);
      assert.equal(stringify(parsed), expected.normal);
      assert.deepEqual(parsed.map(labels), expected.labels);
      assert.equal(keyshortcuts(parsed), expected.keyshortcuts);
    });
  }

  test("labels show letters as uppercase keycaps, modifiers in normal order, and Space by name", () => {
    assert.deepEqual(labels(parse("t")[0]), [["T"]]);
    assert.deepEqual(labels(parse("shift+control+k")[0]), [["Control", "Shift", "K"]]);
    assert.deepEqual(labels(parse("Space")[0]), [["Space"]]);
    assert.deepEqual(labels(parse("Control+Plus")[0]), [["Control", "+"]]);
  });

  test("aria-keyshortcuts names physical keys, modifiers first", () => {
    assert.equal(keyshortcuts(parse("t")), "T");
    assert.equal(keyshortcuts(parse("Shift+t")), "Shift+T");
    assert.equal(keyshortcuts(parse("Shift+Control+k")), "Control+Shift+K");
    assert.equal(keyshortcuts(parse("Space")), "Space");
    assert.equal(keyshortcuts(parse("Escape")), "Escape");
    assert.equal(keyshortcuts(parse("/")), "/");
  });

  test("a symbol is declared by its US physical key with Shift", () => {
    // A sample across the Shift row, not the whole table: restating every entry would restate
    // US_SHIFTED itself. Plus is the named key, and the quote and backslash need escaping.
    const SHIFTED = { "?": "/", "!": "1", Plus: "=", '"': "'", "|": "\\", "~": "`" };
    for (const [symbol, key] of Object.entries(SHIFTED)) {
      assert.deepEqual([symbol, keyshortcuts(parse(symbol))], [symbol, `Shift+${key}`]);
    }
    assert.equal(keyshortcuts(parse("Alt+?")), "Alt+Shift+/");
  });

  test("alternatives join with a space, and a sequence among them declares nothing", () => {
    assert.equal(keyshortcuts(parse("t, g t, Alt+T, ?")), "T Alt+T Shift+/");
    assert.equal(keyshortcuts(parse("g t, g c")), null);
  });
});
