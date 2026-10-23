// The tool sheets in the package's dist/ against v0.7.0's: every element of demo/tools.html
// computes the same, at rest and hovered, and dropping any one declaration shows. The page entry's
// layer order and default profiles are read from the same page.
// Adapted from spike-html-conventions (a88828a): scripts/browser.test.js.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "./support/browser-pipe.js";
import { concerns, differences } from "./support/computed-styles.js";
import { root, serve } from "./support/server.js";

const reference = "/test/fixtures/v0.7.0/baseline.css";
const entry = "/dist/page.css";
const sheet = (concern) => `/dist/${concern}.css`;

/** The foundation's layers, in the order the page entry states. */
const LAYER_ORDER = [
  "foundation.tokens.color",
  "foundation.tokens.space",
  "foundation.tokens.type",
  "foundation.reset",
  "foundation.elements",
  "foundation.meta",
  "foundation.structure",
  "foundation.utilities",
];

const FACETS = ["color", "space", "type"];
/** One token per facet that tells its profile apart, with its value under each profile. */
const PROFILES = {
  color: { flexoki: { "--bg": "light-dark(#fffcf0, #100f0f)" } },
  space: { regular: { "--radius-base": "0.375rem" } },
  type: {
    mono: {
      "--font-heading":
        'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    },
  },
};
const TOKENS = FACETS.flatMap((facet) => Object.values(PROFILES[facet]).flatMap(Object.keys));

/** A file of the repository, by its path on the server, without its CSS comments. */
const source = (path) => readFileSync(join(root, path), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The class names a stylesheet's selectors name, sorted. */
function classes(css) {
  // A dot after a digit is a number's decimal point, not a class.
  const names = [...css.matchAll(/(?<![\w-])\.(-?[A-Za-z_][\w-]*)/g)].map((match) => match[1]);
  return [...new Set(names)].sort();
}

/** Forces :hover on the page's body and every element in it, through the DevTools Protocol. */
async function forceHover(page) {
  await page.cdp("DOM.enable");
  await page.cdp("CSS.enable");
  const { root: tree } = await page.cdp("DOM.getDocument");
  const { nodeIds } = await page.cdp("DOM.querySelectorAll", {
    nodeId: tree.nodeId,
    selector: "body, body *",
  });
  const hover = (nodeId) =>
    page.cdp("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
  await Promise.all(nodeIds.map(hover));
}

/** At most 40 lines of a failure's list. */
const head = (lines) => lines.slice(0, 40).join("\n") + (lines.length > 40 ? "\n…" : "");

describe("foundation tools", () => {
  let server;
  let browser;

  /** demo/tools.html on the stack of sheets, with computed-styles.js bound as window.m. */
  async function toolsPage(sheets) {
    const page = await browser.open(`${server.origin}/demo/tools.html`);
    await page.evaluate(`import("/test/browser/support/computed-styles.js")
      .then((m) => (window.m = m).useSheets(${JSON.stringify(sheets)}))`);
    return page;
  }

  /** The page's reading on the stack of sheets, at rest and hovered. */
  async function snapshot(sheets) {
    const page = await toolsPage(sheets);
    const rest = await page.evaluate("m.reading()");
    await forceHover(page);
    const hover = await page.evaluate("m.reading()");
    await page.close();
    return { rest, hover };
  }

  // v0.7.0's reading, which every comparison is against.
  let upstream;
  before(async () => {
    server = await serve();
    browser = await launch();
    upstream = await snapshot(reference);
  });
  after(async () => {
    await browser?.close();
    await server?.stop();
  });

  const upstreamClasses = classes(source("/test/fixtures/v0.7.0/layers/tools.css"));

  test("the sheets hold v0.7.0's tool classes, no fewer and no more", () => {
    assert.ok(upstreamClasses.length > 0, "v0.7.0's tools layer names no class");
    assert.deepEqual(classes(concerns.map((c) => source(sheet(c))).join("\n")), upstreamClasses);
  });

  test("the demo page carries every tool class", () => {
    const html = readFileSync(join(root, "demo/tools.html"), "utf8");
    const carried = [...html.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
    assert.deepEqual(
      upstreamClasses.filter((name) => !carried.includes(name)),
      [],
    );
  });

  test("the page entry states the whole layer order in one statement, first", async () => {
    const page = await toolsPage(entry);
    const statements = await page.evaluate(`(() => {
      const sheet = [...document.styleSheets].find(({ href }) => href.endsWith("${entry}"));
      const rules = [...sheet.cssRules];
      return rules
        .filter((rule) => rule instanceof CSSLayerStatementRule)
        .map((rule) => ({ index: rules.indexOf(rule), names: [...rule.nameList] }));
    })()`);
    await page.close();
    assert.deepEqual(statements, [{ index: 0, names: LAYER_ORDER }]);
  });

  test("with no profile attribute, the page entry applies DEFAULTS' profiles", async () => {
    const page = await toolsPage(entry);
    // A custom property keeps its source's line breaks.
    const read = `import("/dist/registry.js").then(({ DEFAULTS }) => {
      const style = getComputedStyle(document.documentElement);
      const token = (name) => style.getPropertyValue(name).trim().replace(/\\s+/g, " ");
      return {
        attributes: document.querySelectorAll("[data-palette], [data-space], [data-type]").length,
        defaults: DEFAULTS,
        tokens: Object.fromEntries(${JSON.stringify(TOKENS)}.map((name) => [name, token(name)])),
      };
    })`;
    const { attributes, defaults, tokens } = await page.evaluate(read);
    await page.close();
    assert.equal(attributes, 0);
    assert.deepEqual(
      tokens,
      Object.assign({}, ...FACETS.map((facet) => PROFILES[facet][defaults[facet]])),
    );
  });

  test("every tool class computes as v0.7.0's, at rest and hovered", async () => {
    assert.notEqual(differences(upstream.rest, upstream.hover).length, 0, "hover changed nothing");
    const ours = await snapshot(entry);
    const lines = ["rest", "hover"].flatMap((state) =>
      differences(upstream[state], ours[state]).map((line) => `${state} ${line}`),
    );
    assert.deepEqual(lines, [], head(lines));
  });

  test("dropping any one declaration of the three sheets fails the comparison", async () => {
    const page = await toolsPage(entry);
    const rest = await page.evaluate(`m.drops(${JSON.stringify(upstream.rest)})`);
    await forceHover(page);
    const hover = await page.evaluate(`m.drops(${JSON.stringify(upstream.hover)})`);
    await page.close();
    // One declaration per `property: value;` line, as each of the three sheets writes them.
    const written = concerns
      .map((c) => source(sheet(c)))
      .join("\n")
      .match(/^\s*-*[a-z][\w-]*\s*:[^;{]*;/gm);
    assert.equal(rest.length, written.length, "every declaration written is tried");
    const missed = rest
      .filter((drop, i) => drop.differs + hover[i].differs === 0)
      .map(({ sheet, selector, declaration }) => `${sheet}: ${selector} { ${declaration} }`);
    assert.deepEqual(missed, [], `dropped unnoticed:\n${head(missed)}`);
  });

  test("each sheet is self-layered and @import-free, and a shadow root adopts it alone", async () => {
    const page = await browser.open(`${server.origin}/demo/tools.html`);
    const adopted = await page.evaluate(`import("/test/browser/support/computed-styles.js")
      .then((m) => m.adopt("/dist"))`);
    await page.close();
    for (const concern of concerns) {
      assert.equal(adopted[concern].imports, 0, `${concern}.css holds an @import`);
      assert.deepEqual(adopted[concern].rules, [`@layer foundation.${concern}`], concern);
    }
    // A var() that found no token through the shadow boundary would leave a length 0px.
    assert.equal(adopted.meta.display, "inline-block");
    assert.notEqual(adopted.meta["padding-left"], "0px");
    assert.equal(adopted.structure.display, "grid");
    assert.notEqual(adopted.structure["row-gap"], "normal");
    assert.equal(adopted.utilities["overflow-y"], "auto");
    assert.notEqual(adopted.utilities["padding-right"], "0px");
  });
});
