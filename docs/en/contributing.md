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

- `src/core` must not import from any view, from `ui`, from `storage` or from `sync`.
- `core`, `filters`, `storage` and `sync` stay framework-free (plain TypeScript, no React).
- Each view under `src/views` reads from `core` and `filters` only. Views do not import each other.
- Shared components and theme tokens live in `src/ui`.
- The cloud is reached only through the cloud adapter in `src/storage`. No other module talks to Supabase.

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

## Sync and security

- Every entity has a device-generated UUID and the fields `createdAt`, `updatedAt` and `deletedAt`. Deleting sets `deletedAt` and never removes the record.
- Row level security must be enabled on every cloud table. A test must prove that one account cannot read another account's rows.
- Never commit secrets. Only the public Supabase URL and anon key may appear in the client, and only because row level security protects the data.
- Guest mode must never contact the cloud.

## Tests and quality

Planned scripts, confirmed at delivery 1:

| Script | What it does |
| --- | --- |
| `npm test` | Runs the full test suite once (Vitest). |
| `npm run test:watch` | Re-runs affected tests on every save. |
| `npm run typecheck` | Runs the TypeScript compiler without emitting files. |
| `npm run lint` | Runs ESLint. |
| `npm run format` | Formats the code with Prettier. |
| `npm run format:check` | Checks formatting without changing files. |
| `npm run check` | Runs typecheck, lint, format check and tests, in this order. |

Targeted runs, for quick feedback during an iteration:

```
npx vitest run tests/core
npx vitest related src/core/item.ts --run
```

The second command runs only the tests that depend on the given files.

What to test:

- `core` and `filters`: unit tests for pure rules, such as tag scope inheritance, day periods, recursive progress and filtering. This is where most coverage lives.
- `storage` and `sync`: unit tests against a fake IndexedDB, including last write wins and tombstones.
- Views: component tests with Testing Library for the main interactions, including the tap alternative to every drag action.
- Guardrails: a scan of interface strings for em and en dashes, a check that guest mode makes no network request, and the row level security test against a test Supabase project, never against real data.
- End to end tests with Playwright are an option for later, run on the owner's machine.

There are no commit hooks. Conventional Commits is a convention to keep in mind, not a rule enforced by tooling, and a commit may bundle several small deliveries.

Working agreement: in assisted sessions only targeted tests are run. The full suite and `npm run check` run on the owner's machine before each commit.

## Hosting and free tier

- Work on branches. Merge to `main` only when a delivery is ready, because each production deploy on Netlify costs credits and branch deploys are free.
- Do not add Netlify Functions, Netlify databases or AI features. Do not register domains through Netlify.
- Check the current free plan terms when creating a new Netlify or Supabase project.

## Documentation

- The official README is in English. Every document has a pt-BR version, and each pair links to the other.
- When you change a document, change its translation in the same commit, or note the pending translation in the pull request.
- The exception is [docs/progress.md](../progress.md), a working log in Portuguese that has no English version.
