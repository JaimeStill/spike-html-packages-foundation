# spike-html-packages-foundation

The foundation layer of [spike-html-packages](https://github.com/JaimeStill/spike-html-packages),
the native web stack's base: the baseline stylesheets (tokens on the Flexoki, regular, and mono
profiles, reset, and elements), the tool sheets (meta, structure, and utilities), the DOM
helpers, the registry and keys family, and the formatter declarations. It is plain CSS and ES
modules with their type declarations, with no dependencies, and is released by git tag.

## Install

Each release is a tag, `v<version>`, whose tree is the package as `pnpm pack` builds it:
`package.json`, this README, the LICENSE, and `dist/`. Install it by the tag:

```
npm install --allow-git=root github:JaimeStill/spike-html-packages-foundation#v0.1.0
pnpm add github:JaimeStill/spike-html-packages-foundation#v0.1.0
bun add github:JaimeStill/spike-html-packages-foundation#v0.1.0
```

npm 12 refuses git dependencies unless `--allow-git` allows them; `root` allows the ones the
project itself declares. Each GitHub release also carries the tarball.

## Use

The package is `@jaimestill/spike-html-packages-foundation`. A page links the one entry
stylesheet, `page.css`, and imports the modules by their `.js` subpaths:

```html
<link rel="stylesheet" href="node_modules/@jaimestill/spike-html-packages-foundation/dist/page.css" />
<script type="module">
  import { register } from "@jaimestill/spike-html-packages-foundation/keys.js";
</script>
```

- `./*.css`: the stylesheets: `page.css` the page entry, `baseline.css`, and the tool sheets,
  `meta.css`, `structure.css`, and `utilities.css`, each self-layered so a shadow root adopts it
  alone.
- `./*.js`: the modules, with their `.d.ts`: `dom.js`, `registry.js`, `keys.js`, `keys-help.js`,
  and `keys-grammar.js`.
- `./format.js`: the formatter declarations, types only.
- `./css`: the ambient `*.css` declaration for CSS module scripts,
  `import sheet from "./x.css" with { type: "css" }`, for a project's `types`.

## Development

Tasks run through [mise](https://mise.jdx.dev):

```
mise run install    # the pinned tools and node_modules; reads the network
mise run check      # lint, types, build, and the unit and browser tiers; reads no network
mise run build      # src/ into dist/
mise run demo       # serve the tools and keys demo pages on dist/
mise run currency   # report every tool, package, and action pin behind its latest
```

A push to main whose `package.json` version has no tag yet releases it: the check, then the pack
committed and tagged, and a GitHub release from `CHANGELOG.md`.

## License

[Apache License 2.0](LICENSE).
