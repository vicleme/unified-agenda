# Unified Agenda

> One item, many lenses, all local.

**English** | [Português (Brasil)](README.pt-BR.md)

A local-first web agenda where events and tasks are the same kind of thing. You see that one item through several lenses: a scrollable day-by-day timeline, a calendar and a Kanban board. It works on desktop and on your phone, and approved accounts can sync between devices.

**Status:** deliveries 1 (core with local storage), 2 (Timeline), 3 (tags and filters) and 4 (agenda selection, groups, layout and saved views) are done. You can create and edit agendas, events, tasks and sub-items, set the display time zone and the day periods, and back everything up to a JSON file. The Timeline scrolls day after day, shows open and overdue tasks on each day, and lets you mark a task as done right from its row. Tags form a tree with scope, and the Timeline has a filter panel (text, type, day period, tags and "due within N days"). The same panel chooses which agendas to show (by agenda or by group), lays each day out mixed, by agenda or by group, and keeps your favorite setups as named saved views, which are remembered while you move between tabs. The Calendar and Kanban views are still placeholders and come next. See the [roadmap](docs/en/roadmap.md).

## Why this exists

Good tools exist for each piece of this idea, but they live in different products:

- Some apps show events and dated tasks in one list, but keep little structure inside a task.
- Some offer several views over the same data, but are general databases, not agendas.
- Some support nested tags and sub-tasks, but cap the depth or lock the best views behind a paid plan.
- Some keep your data on your device, but offer few views and few ways to organize.

The goal here is a single recipe: **one item model, several lenses on top, and your data stays under your control**. The differentiator is the combination, not any single view.

## Highlights

- **Events and tasks are one thing.** An event has a start and an end (date and time). A task has a window, from the day it was assigned to its due date, so it stays visible on every day you are living with it. A task can also exist without a date, and you can reserve work blocks for it.
- **Unlimited nesting.** Every sub-item is a full item (dates, tags, status), at any depth. A checklist is just the lightweight case.
- **Hierarchical tags with scope.** Tags form a tree (for example Care, then Gardening, then Watering). Each tag is global or restricted to one or more agendas. Filtering by a parent includes its descendants.
- **Day periods.** Filter by dawn, morning, afternoon and evening. Periods are computed from the times, not stored.
- **Agenda selection and grouping.** Show all, none, or a chosen set of agendas, in groups, mixed or side by side. Save combinations as named views.
- **Three lenses.** Timeline (continuous scrolling, day after day, with a button to mark tasks as done and an undo), calendar (day, week, month) and Kanban (customizable groups and columns, drag and drop).
- **Rich items.** Notes (Markdown), location, links and a checklist.
- **Light, dark and automatic themes.**
- **Mobile friendly.** Designed for small screens and touch from the first delivery.
- **Local-first, with optional sync.** Data lives on your device (IndexedDB), with JSON export and import. Guest mode needs no account and never contacts a server. Approved accounts also sync across web and phone.

## Principles

- **Modular.** The `core` knows nothing about any view. Each view only reads the `core`.
- **Tokens, not loose colors.** Every color comes from a theme token, so both themes work everywhere.
- **Small screens first.** Layouts start from the phone and grow, and every drag action has a tap alternative.
- **Plain interface text.** Interface strings avoid unnecessary dashes. Punctuation should be simple and natural.
- **Two interface languages.** The interface comes in Portuguese (Brazil) and English, chosen automatically from the browser and changeable at any time.
- **Works without a server.** Guest mode runs entirely in the browser. The cloud is optional and only used for sync.
- **Free to run.** The project is designed to stay within free tiers and avoids features that consume credits, such as serverless functions.

## Tech stack (planned)

The tooling versions were confirmed in delivery 1a: React 19, Vite 8, TypeScript 6.0, Vitest 5, ESLint 10 and Prettier 3. TypeScript stays on 6.0 because typescript-eslint does not support 6.1 or newer yet. Dexie is confirmed (4.4.7). dnd-kit is confirmed when it is first used. TanStack Virtual was left out of the Timeline on purpose (see the roadmap) and stays an option if long lists get slow.

| Area | Choice |
| --- | --- |
| Language | TypeScript |
| Build | Vite |
| Interface | React (the `core`, `filters`, `storage` and `sync` stay framework-free) |
| Local data | IndexedDB through Dexie |
| Drag and drop | dnd-kit |
| Long lists | Plain scrolling, with folded empty days (TanStack Virtual only if needed) |
| Tests | Vitest and Testing Library |
| Quality | Prettier, ESLint and the TypeScript compiler |
| Cloud, optional | Supabase (Postgres and Auth) |
| Hosting | Netlify, as a static site |

## Repository layout

```
.
├── README.md                 official, English
├── README.pt-BR.md           Portuguese, linked both ways
├── LICENSE
├── CHANGELOG.md
├── package.json              scripts and dependencies
├── index.html, vite.config.ts, netlify.toml
├── docs/
│   ├── en/                   data-model, roadmap, contributing
│   └── pt-BR/                same files, translated
├── src/
│   ├── core/                 items, agendas, tags, statuses and rules
│   ├── storage/              local (IndexedDB) and cloud adapters, JSON import and export
│   ├── sync/                 merge rules between device and cloud
│   ├── filters/              agenda, tag, day period, text
│   ├── views/
│   │   ├── timeline/
│   │   ├── calendar/
│   │   └── kanban/
│   └── ui/                   shared components and theme tokens
└── tests/
```

## Running it

You need Node.js 20.19 or newer (or 22.12 or newer).

```
npm install
npm run dev
```

`npm run check` runs the type check, the linter, the format check and all tests. The data stays in your browser (IndexedDB). Use the Manage button to create agendas and items, and its Backup tab to save or restore everything.

## Documentation

- [Data model](docs/en/data-model.md)
- [Roadmap](docs/en/roadmap.md)
- [Contributing](docs/en/contributing.md)

## License

MIT. See [LICENSE](LICENSE).
