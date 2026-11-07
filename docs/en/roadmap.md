# Roadmap

[Português (Brasil)](../pt-BR/roadmap.md) | [Back to README](../../README.md)

Each delivery ends with something usable. Every delivery must work on a phone as well as on desktop.

## Deliveries

| # | Delivery | What you can use |
| --- | --- | --- |
| 0 | Repository: structure, READMEs in en and pt-BR, LICENSE, conventions | A ready base with the first commit |
| 1 | Core: agendas, recursive items (start and end, notes, location, links), local storage, theme tokens and light, dark and automatic themes, responsive shell | Create and edit everything, still without elaborate views |
| 2 | **Timeline**: continuous scrolling in both directions, a block per day, "continues" marks for multi-day items, collapsible empty days, an overdue strip, a Today button | Scroll your days, with events and deliveries together |
| 3 | Hierarchical tags with scope, and filters (agenda, tag, type, day period, text) | Organize and filter |
| 4 | Agenda selection, groups, layout (mixed, separate, grouped) and saved views | The flexibility of choosing what you see |
| 5 | Calendar (day, week, month) | The classic view, already with filters |
| 6 | Kanban with customizable groups and columns, drag and drop with touch support | Move cards between columns |
| 7 | Integration (inbox, drag to schedule), recurrence, reminders | Refinements |
| 8 | JSON and .ics export and import, installable PWA, offline use | Portability and phone install |

## Mobile and touch notes

- Layouts start from the phone and grow. Touch targets stay comfortable.
- The timeline is the natural phone view, since it is a single column that scrolls.
- On a phone the Kanban shows one column at a time, with swipe between columns.
- Every drag and drop action has a tap alternative, such as a "Move to" menu.
- Installable PWA arrives in delivery 8, but responsive layout is required from delivery 1.

## Decisions made

- **Local-first:** data in the browser, with JSON export and import.
- **Day periods:** dawn (00h to 06h) is a fourth period, next to morning, afternoon and evening.
- **Positioning:** one item, many lenses, all local.
- **Items that cross periods:** appear in every period they overlap.
- **Tasks without a date:** allowed.
- **Interface text:** avoid unnecessary dashes.

## Open decisions

- Technology stack. This unblocks delivery 1. The leaning is toward light tooling, in line with the principle of depending on nothing external.
- Optional status for events (the current leaning is yes).
- Display modes for sub-items per view (nested, flattened, parents only).

## Ideas for later

- Automatic switching of agenda sets by time of day.
- Optional sync without a project server, for example WebDAV.
