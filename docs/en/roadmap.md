# Roadmap

[Português (Brasil)](../pt-BR/roadmap.md) | [Back to README](../../README.md)

Each delivery ends with something usable. Every delivery must work on a phone as well as on desktop. Everything up to delivery 6 runs entirely on the device, so you can use the app for real before accounts arrive.

Current state: deliveries 0, 1, 2, 3 and 4 are done. Delivery 5, the Calendar, is next.

## Deliveries

| # | Delivery | What you can use |
| --- | --- | --- |
| 0 | Repository: structure, READMEs in en and pt-BR, LICENSE, conventions | A ready base with the first commit |
| 1 | Core: agendas, recursive items (events with a schedule, tasks with a window from start to due date, work blocks, notes, location, links), local storage (IndexedDB), JSON export and import, theme tokens with light, dark and automatic themes, time zones, responsive shell, interface in Portuguese and English, tests and quality scripts (Vitest, Prettier, ESLint). The model is already prepared for sync (UUIDs, `updatedAt`, `deletedAt`) | Create and edit everything, still without elaborate views |
| 2 | **Timeline**: continuous scrolling in both directions, a block per day, "continues" marks for multi-day items, collapsible empty days, an "open tasks" strip on every day of a task's window, an overdue strip, a Today button, a date picker, a Back to top button, and a Done button on task rows with Undo | Scroll your days, with events and open deliveries together |
| 3 | Hierarchical tags with scope, and filters (tag, type, day period, text, due within N days). Filtering by agenda comes with the agenda selection in delivery 4 | Organize and filter |
| 4 | Agenda selection, groups, layout (mixed, separate, grouped) and saved views | The flexibility of choosing what you see |
| 5 | Calendar (day, week, month) | The classic view, already with filters |
| 6 | Kanban with customizable groups and columns, drag and drop with touch support | Move cards between columns |
| 7 | **Accounts and sync**: Supabase sign-in with closed sign-ups, guest mode kept fully local, import of local data into an account, sync with last write wins, row level security tests | The same agenda on web and phone |
| 8 | Integration (inbox, drag to schedule), recurrence (repeating work blocks until the due day, and repeating tasks), reminders | Refinements |
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

- **Timeline scrolling:** the page scrolls as a whole and loads 14 more days near either end, with no list virtualization (TanStack Virtual was not installed). Blocks have different heights, inserting days above is simpler with manual scroll anchoring, and empty days in a row fold into one line, so the number of blocks stays small. Revisit if scrolling gets heavy with months of data.
- **Marking a task as done on the Timeline:** the button gives the task the first status (by order) of the first done group, and an Undo message brings back the previous status for a few seconds. With no done status, the button is not drawn.
- **Timeline filters:** the panel edits one plain `ItemFilter` and the screen applies it in two steps: tag, type and text cut the items first (inherited tags look at the whole list), then the day period and "due within N days" cut each built day. A day period keeps timed events that touch it, "No set time" keeps whole-day events and the task strips, and the overdue strip is never cut by "due within". The filter, like the agenda selection and the layout, is kept by the app shell, so it survives a switch of tab (see saved views below). On a phone the panel is a sheet over the screen, on a wide screen a card inside the sticky bar.
- **Agenda selection and layout (delivery 4):** both live in the filter panel. A hidden agenda counts as one more filter, while the layout (mixed, separate or grouped) hides nothing and is not counted. "Every agenda" is stored as `null`, so agendas created later show up by themselves. Groups are shortcuts and are never saved.
- **Saved views (delivery 4):** a view stores the filter, the shown agendas and the layout. Picking one applies it, and changing any control afterwards keeps the view active but marks it "changed", with Update and Restore at hand. Views are managed inside the filter panel (save, update, restore, rename, reorder, delete) and are for the Timeline only until the Calendar and Kanban exist.
- **Tag inheritance:** an item counts as having its parent's tags while its `inheritTags` switch is on, so a subtask or work block shows up when filtering by the task's tag.
- **Local-first:** data on the device, with JSON export and import.
- **Day periods:** dawn (00h to 06h) is a fourth period, next to morning, afternoon and evening.
- **Positioning:** one item, many lenses, all local.
- **Items that cross periods:** appear in every period they overlap.
- **Tasks without a date:** allowed.
- **Interface text:** avoid unnecessary dashes.
- **Time zones:** instants in UTC, whole-day items without a zone, a display time zone setting (auto by default) and an optional zone on each timed item.
- **Interface languages:** Portuguese (Brazil) and English, with automatic detection and a manual choice. No i18n library for now. Texts live in typed message files.
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
