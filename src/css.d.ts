// A CSS module script, `import sheet from "./x.css" with { type: "css" }`: one CSSStyleSheet.
// Adapted from spike-html-conventions (a88828a): layers/css.d.ts, without its Vite plugin.

declare module "*.css" {
  const sheet: CSSStyleSheet;
  export default sheet;
}
