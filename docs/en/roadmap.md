# Roadmap

[Português (Brasil)](../pt-BR/roadmap.md) | [Back to README](../../README.md)

Each delivery ends with something usable. Every delivery must work on a phone as well as on desktop. Everything up to delivery 6 runs entirely on the device, so you can use the app for real before accounts arrive.

## Deliveries

| # | Delivery | What you can use |
| --- | --- | --- |
| 0 | Repository: structure, READMEs in en and pt-BR, LICENSE, conventions | A ready base with the first commit |
| 1 | Core: agendas, recursive items (start and end, notes, location, links), local storage (IndexedDB), JSON export and import, theme tokens with light, dark and automatic themes, responsive shell, tests and quality scripts (Vitest, Prettier, ESLint). The model is already prepared for sync (UUIDs, `updatedAt`, `deletedAt`) | Create and edit everything, still without elaborate views |
| 2 | **Timeline**: continuous scrolling in both directions, a block per day, "continues" marks for multi-day items, collapsible empty days, an overdue strip, a Today button | Scroll your days, with events and deliveries together |
| 3 | Hierarchical tags with scope, and filters (agenda, tag, type, day period, text) | Organize and filter |
| 4 | Agenda selection, groups, layout (mixed, separate, grouped) and saved views | The flexibility of choosing what you see |
| 5 | Calendar (day, week, month) | The classic view, already with filters |
| 6 | Kanban with customizable groups and columns, drag and drop with touch support | Move cards between columns |
| 7 | **Accounts and sync**: Supabase sign-in with closed sign-ups, guest mode kept fully local, import of local data into an account, sync with last write wins, row level security tests | The same agenda on web and phone |
| 8 | Integration (inbox, drag to schedule), recurrence, reminders | Refinements |
| 9 | .ics export and import, installable PWA, offline use | Portability and phone install |

## Mobile and touch notes

- Layouts start from the phone and grow. Touch targets stay comfortable.
- The timeline is the natural phone view, since it is a single column that scrolls.
- On a phone the Kanban shows one column at a time, with swipe between columns.
- Every drag and drop action has a tap alternative, such as a "Move to" menu.
- Installable PWA arrives in delivery 9, but responsive layout is required from delivery 1.

## Hosting and free tier rules

The project must not cost money. Rules that follow from the free plans as documented in November 2026:

- **Netlify (static site):** the free plan gives 300 credits per month, shared by every site in the account. A production deploy costs 15 credits, bandwidth costs 20 credits per GB, and Deploy Previews and branch deploys cost nothing. When credits run out, the sites pause.
- Work on branches and merge to `main` (which publishes to production) only when a delivery is ready. About 10 production deploys a month is a safe budget.
- Do not use Netlify Functions, Netlify databases or AI features, because they consume credits. Do not register domains through Netlify. The `netlify.app` address is enough.
- **Supabase (cloud sync):** the free plan gives 500 MB of database per project, 50,000 monthly active users and 5 GB of egress per month. A free project is paused after 7 days of low activity and can be resumed from the dashboard. Because the app is local-first, it keeps working on the device while the project is paused.
- Guest mode never contacts Supabase, so visitors cannot consume the quota. Sign-ups stay closed, so only approved accounts write data.

Check the current terms when creating each project, since free plans change.

## Decisions made

- **Local-first:** data on the device, with JSON export and import.
- **Day periods:** dawn (00h to 06h) is a fourth period, next to morning, afternoon and evening.
- **Positioning:** one item, many lenses, all local.
- **Items that cross periods:** appear in every period they overlap.
- **Tasks without a date:** allowed.
- **Interface text:** avoid unnecessary dashes.
- **Stack:** TypeScript, Vite and React, with the framework-free `core`, `filters`, `storage` and `sync`.
- **Hosting:** Netlify, as a static site.
- **Cloud:** Supabase, with a guest mode that stays local and accounts that are created by the owner.
- **Repository name:** `unified-agenda`.

## Open decisions

- Optional status for events (the current leaning is yes).
- Display modes for sub-items per view (nested, flattened, parents only).
- Whether sign-up stays owner-only or becomes a request-access form.
- Whether Supabase asks for a payment card or allows overage charges on the free plan, to be checked when the project is created.

## Ideas for later

- Automatic switching of agenda sets by time of day.
