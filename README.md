# Agenda

> One item, many lenses, all local.

**English** | [Português (Brasil)](README.pt-BR.md)

A local-first web agenda where events and tasks are the same kind of thing. You see that one item through several lenses: a scrollable day-by-day timeline, a calendar and a Kanban board. It works on desktop and on your phone.

**Status:** planning. No application code yet. See the [roadmap](docs/en/roadmap.md).

## Why this exists

Good tools exist for each piece of this idea, but they live in different products:

- Some apps show events and dated tasks in one list, but keep little structure inside a task.
- Some offer several views over the same data, but are general databases, not agendas.
- Some support nested tags and sub-tasks, but cap the depth or lock the best views behind a paid plan.
- Some keep your data on your device, but offer few views and few ways to organize.

The goal here is a single recipe: **one item model, several lenses on top, and your data stays in your browser**. The differentiator is the combination, not any single view.

## Highlights

- **Events and tasks are one thing.** Both have a start and an end (date and time). A task can also exist without a date.
- **Unlimited nesting.** Every sub-item is a full item (dates, tags, status), at any depth. A checklist is just the lightweight case.
- **Hierarchical tags with scope.** Tags form a tree (for example Care, then Gardening, then Watering). Each tag is global or restricted to one or more agendas. Filtering by a parent includes its descendants.
- **Day periods.** Filter by dawn, morning, afternoon and evening. Periods are computed from the times, not stored.
- **Agenda selection and grouping.** Show all, none, or a chosen set of agendas, in groups, mixed or side by side. Save combinations as named views.
- **Three lenses.** Timeline (continuous scrolling, day after day), calendar (day, week, month) and Kanban (customizable groups and columns, drag and drop).
- **Rich items.** Notes (Markdown), location, links and a checklist.
- **Light, dark and automatic themes.**
- **Mobile friendly.** Designed for small screens and touch from the first delivery.
- **Local-first.** Data stays in your browser, with JSON export and import. No account needed.

## Principles

- **Modular.** The `core` knows nothing about any view. Each view only reads the `core`.
- **Tokens, not loose colors.** Every color comes from a theme token, so both themes work everywhere.
- **Small screens first.** Layouts start from the phone and grow, and every drag action has a tap alternative.
- **Plain interface text.** Interface strings avoid unnecessary dashes. Punctuation should be simple and natural.
- **Nothing external required.** The project should run without depending on a server or an account.

## Repository layout

```
.
├── README.md                 official, English
├── README.pt-BR.md           Portuguese, linked both ways
├── LICENSE
├── CHANGELOG.md
├── docs/
│   ├── en/                   data-model, roadmap, contributing
│   └── pt-BR/                same files, translated
├── src/
│   ├── core/                 items, agendas, tags, statuses and rules
│   ├── storage/              IndexedDB, JSON import and export
│   ├── filters/              agenda, tag, day period, text
│   ├── views/
│   │   ├── timeline/
│   │   ├── calendar/
│   │   └── kanban/
│   └── ui/                   shared components and theme tokens
└── tests/
```

## Documentation

- [Data model](docs/en/data-model.md)
- [Roadmap](docs/en/roadmap.md)
- [Contributing](docs/en/contributing.md)

## License

MIT. See [LICENSE](LICENSE).
