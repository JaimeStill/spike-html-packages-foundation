# spike-html-packages-foundation

The foundation layer of spike-html-packages, a `code` project managed with the marathon workflow.
Its goal lives in the coordinator's roadmap, `standards-lab/context/roadmap.toml`, under
`experiment.html.spike-html-packages`, whose record is in spike-html-packages.

- [`context/README.md`](context/README.md): the working context.
- [`STANDARDS.md`](STANDARDS.md): the judgement calls the standards-reviewer applies.
- [`README.md`](README.md): what the layer is, its install by tag, and its tasks.
- [`CHANGELOG.md`](CHANGELOG.md): each release's notes, which `release.yml` publishes.
- `mise run install`: the pinned tools and node_modules; the one task that reads the network.
- `mise run check`: the check.
- `mise run currency`: every tool, package, and action pin behind its latest.
