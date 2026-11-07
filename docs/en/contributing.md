# Contributing

[Português (Brasil)](../pt-BR/contributing.md) | [Back to README](../../README.md)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/), written in English.

```
feat(core): add recursive item model
fix(timeline): keep the Today button visible on small screens
docs: translate the roadmap to pt-BR
chore: initial project scaffold
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`.

## Modularity

- `src/core` must not import from any view, from `ui` or from `storage`.
- Each view under `src/views` reads from `core` and `filters` only. Views do not import each other.
- Shared components and theme tokens live in `src/ui`.

## Themes

- Never write a color directly in a component. Use a theme token.
- Check every new screen in light and dark.

## Mobile

- Design the small screen first, then widen.
- Keep touch targets comfortable and avoid hover-only actions.
- Every drag and drop action needs a tap alternative.

## Interface text

- Avoid unnecessary dashes (em dash and en dash) in interface strings. Prefer commas, periods and colons.
- A test should scan interface strings for these characters once strings are centralized.

## Documentation

- The official README is in English. Every document has a pt-BR version, and each pair links to the other.
- When you change a document, change its translation in the same commit, or note the pending translation in the pull request.
