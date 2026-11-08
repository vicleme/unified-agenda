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
- Each view reads from `core` and `filters` only for its rules. A view that also has to read or write stored data lives in `src/ui` and goes through the data hooks (`useData`, `useItems` and the others), as the Timeline does today. Views do not import each other. When the Calendar and Kanban arrive, the Timeline can move to `src/views/timeline` if a clean way to share those hooks is found.
- Shared components and theme tokens live in `src/ui`.
- `src/core` and the other framework-free folders cannot import React, and `core` cannot import from `ui`, `views`, `storage` or `sync`. ESLint enforces this.
- The cloud is reached only through the cloud adapter in `src/storage`. No other module talks to Supabase.

## Themes

- Never write a color directly in a component. Use a theme token.
- Check every new screen in light and dark.

## Mobile

- Design the small screen first, then widen.
- Keep touch targets comfortable and avoid hover-only actions.
- Every drag and drop action needs a tap alternative.
- When a list repeats the same action on every row, show a short text on the button (Edit, Move) and keep the full name with the item in `aria-label`. The row stays compact and screen readers still know which item the button is for.

## Interface text

- Avoid unnecessary dashes (em dash and en dash) in interface strings. Prefer commas, periods and colons.
- Every interface text lives in `src/ui/i18n/messages`, one file per language. Never write user-facing text directly in a component.
- English (`en.ts`) is the reference. A new text is added to every language in the same change. The TypeScript compiler fails when a language misses a key, and a test checks that all languages have the same keys, none empty.
- A test scans the messages of every language for em and en dashes.
- Components read texts through `useI18n()`. Names of languages stay in their own language (Português, English).
- Dates, times and numbers will use `Intl` with the active locale, never hand-made formats.

## Dates and time zones

- Timed items are stored as UTC instants. Whole-day items are plain `YYYY-MM-DD` dates with no zone.
- Never use `getHours()`, `getDate()`, `toLocaleString()` and similar methods in the `core`, because they depend on the device zone. Use the helpers in `src/core/zone.ts` and pass the zone in.
- Test the edge cases: the day the clock changes, an overnight item, and the same instant in two zones.

## Local storage

- Never edit a database version that has shipped. A schema change adds `db.version(n + 1)` with the new indexes and an `.upgrade()` step that moves the old data.
- Index only fields used in a query. Dates stay unindexed and the views filter in memory with the `core`.
- Delete by marking `deletedAt`. Never remove a record outside of an import in replace mode.
- `src/storage` imports the `core`, never React, `ui` or `views`. Tests use `fake-indexeddb` and give each test its own database name.
- Anything that comes from a file or from storage is checked before it is trusted. The backup reader refuses the whole file on the first bad field, and unknown fields are dropped.

## Sync and security

- Every entity has a device-generated UUID and the fields `createdAt`, `updatedAt` and `deletedAt`. Deleting sets `deletedAt` and never removes the record.
- Row level security must be enabled on every cloud table. A test must prove that one account cannot read another account's rows.
- Never commit secrets. Only the public Supabase URL and anon key may appear in the client, and only because row level security protects the data.
- Guest mode must never contact the cloud.

## Tests and quality

Scripts, available since delivery 1a:

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
- Screen tests that render the data provider (`renderApp` in `tests/helpers.tsx`) let it settle before the test database closes, which keeps the terminal free of `act(...)` warnings. A test that ends right after rendering can call `settleApp(db)` itself.
- Guardrails: a scan of the interface messages of every language for em and en dashes, a check that all languages share the same keys, a check that guest mode makes no network request, and the row level security test against a test Supabase project, never against real data.
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
