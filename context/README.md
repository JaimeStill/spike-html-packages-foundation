# spike-html-packages-foundation

spike-html-packages-foundation is the foundation layer of
[spike-html-packages](https://github.com/JaimeStill/spike-html-packages): the baseline
stylesheets, the tool sheets, the DOM helpers, the registry and keys family, and the formatter
declarations. It is released by tag and built on by the layers above it, as the Go workspace's
repositories are.
This context records only working knowledge the code and the README do not express.

## Capability map

The README lists the subpaths; the sources and their doc comments are authoritative for the API.

- **baseline**: `baseline.css` and `baseline/`, spike-html-conventions' port of spike-html-design
  v0.7.0: the tokens on the Flexoki, regular, and mono profiles, the reset, and the elements.
- **tools**: `meta.css`, `structure.css`, and `utilities.css`, v0.7.0's tools split into three
  self-layered sheets, and `page.css`, the entry that orders every layer.
- **dom**: `dom.ts`, the DOM helpers.
- **registry**: `registry.ts`, the profiles store shared by every copy.
- **keys**: `keys.ts`, `keys-grammar.ts`, and `keys-help.ts`, which `keys.ts` loads lazily.
- **format**: `format.d.ts`, the Intl formatters, declared only.
- **css**: `css.d.ts`, the ambient `*.css` declaration, the `./css` types subpath.

## Layout

- `src/`: the sources, the only home of the layer's code; `mise run build` writes `dist/`, which
  main never holds.
- `test/unit/`: `node --test` on the sources, types stripped; the lint over `layers-tree.js`'s
  tree; and `release.js`'s checks on a `pnpm pack` of `dist/`.
- `test/browser/`: `node --test` on `dist/` in the pinned chrome-headless-shell; `support/` holds
  the pipe driver, the static server, and `computed-styles.js`, which the tools cases import.
- `test/fixtures/`: v0.7.0's sheets, the tools cases' reference, and the keys pages.
- `demo/`: the tools and keys pages, on `dist/`.
- `scripts/`: one script per task that needs more than one command.

## Tasks

- `mise run check`: `lint` (ESLint, Prettier, shellcheck, and actionlint), `types` (typescript-go),
  `build`, `test:unit`, and `test:browser`; reads no network once `mise run install` has run, and
  writes only `dist/`.
- `mise run demo`: the demo pages, on a fresh build.
- `mise run currency`: reads the network, so CI never runs it.

## Releases

`release.yml` cuts `v<version>` on a push to main when `package.json`'s version has no tag on the
remote; its header comment lists the steps. A version bump, with its changelog section, is what
releases, and a push that bumps nothing ends green.
