# Contributing to gmail-edge

Thanks for considering a contribution.

## Development

```bash
git clone https://github.com/Logos-Flux/gmail-edge.git
cd gmail-edge
bun install
bun run typecheck
bun run build
bun test
```

## Style

- TypeScript strict mode, no `any` without comment.
- Format with `bun run format` (Biome).
- One concept per file; keep modules small.
- Public API surface lives in `src/index.ts` only.

## Pull requests

- Open an issue first for non-trivial changes.
- Include a test case for any bug fix.
- Update `README.md` and `CHANGELOG.md` for any user-visible change.
- Don't bump the version in your PR — the maintainer handles releases.

## License

By contributing, you agree your contributions will be licensed under MIT.
