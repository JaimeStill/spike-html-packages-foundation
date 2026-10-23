# Standards

The judgement calls the check can't enforce, one line each, for the standards-reviewer. What
`mise run check` enforces is never restated here. They are spike-html-packages' Packages and Code
calls, cut to one layer.

The architecture pages that apply, in the architecture repository:

- `principles/minimal-footprint.md`
- `principles/rolling-currency.md`
- `principles/independent-releases.md`
- `principles/validation-first.md`

## Package

- The package is `@jaimestill/spike-html-packages-foundation`, one row of spike-html-packages'
  layer table, and the tool sheets stay in it.
- It declares no runtime dependency: the foundation is the platform alone.
- `dist/` lives only in a release tag's tree, the pack, never on a branch.
- Releases are `v<version>` annotated tags cut by `release.yml` from `package.json`'s version,
  each with its `CHANGELOG.md` section, and never changed or re-cut.

## Code

- Code meets the bar of spike-html-conventions' `layers/` code at a88828a: a 2–4 line header, a
  one-line doc comment per export, and comments only for a non-obvious why.
- A copied file names its source repository and commit in a provenance line, which reads
  `From|Adapted from <repo> (<commit>): <path>`.
- Sources use `.ts` relative specifiers, which tsc rewrites; handwritten `.d.ts` keep `.js`.
- A lazy load uses a literal `import()`.
- The browser tier tests `dist/`, and no server transforms what it serves.
- A mise task runs one script or one command, and `check` is a depends list.
