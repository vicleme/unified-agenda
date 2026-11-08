# Data model

[Português (Brasil)](../pt-BR/data-model.md) | [Back to README](../../README.md)

Analogy: the **item** is the card, and the timeline, calendar and Kanban are lenses over the same card. Changing a status on the board changes what the calendar shows, and changing a time on the calendar changes the card.

## Entities

### Agenda

A container with a name and a base color (for example College, Freelance, Home). An item belongs to exactly one agenda.

### Agenda group

A named set of agendas (for example Personal = Home + Health). One action shows or hides the whole group.

### Item

A single recursive type for events, tasks and checklist entries.

| Field | Notes |
| --- | --- |
| `id` | Unique identifier. |
| `parentId` | Optional. Points to another item, at any depth. |
| `order` | Position among siblings. |
| `kind` | `event` or `task`. |
| `title` | Required. |
| `notes` | Free text with Markdown. |
| `schedule` | For events and work blocks. Empty means unscheduled (inbox). Otherwise a whole-day or a timed schedule, see [Dates, times and time zones](#dates-times-and-time-zones). Tasks do not use it. |
| `from` | Tasks only. The first day the task is pending. Empty means the day it was created. See [Task window](#task-window). |
| `due` | Tasks only. The delivery, a day or a day and time. See [Task window](#task-window). |
| `agendaId` | Agenda the item belongs to. |
| `tagIds` | Zero or more tags. |
| `inheritTags` | True by default. While on, the item also counts as having its parent's tags (and the grandparent's, while each level keeps it on). Only matters for an item with a parent. Older backups without the field count as on. |
| `statusId` | Required for tasks. Optional for events (for example Postponed, Canceled). |
| `location` | Free text. |
| `links` | List of `{ label, url }`. |

Rules:

- A checklist is an item with simple children (title and a checkbox, no dates). A child that gains a date, time or tag simply shows up in the other views, because it is already a full item.
- A parent's progress is computed from its descendants, recursively. Only tasks count, and the result counts leaves, so 3 of 5 is 60% at any depth. A task with counted children ignores its own status. An event never adds to progress, but can hold tasks that do. Items with no task below them have no progress.
- An item cannot become a child of itself or of one of its own descendants.
- Tasks with no delivery are allowed and live in an inbox.
- A task is dated by its window (`from` and `due`), and an event by its `schedule`. Mixing them is a validation error.
- Deep trees collapse by default and render on demand, to keep large data sets fast.

### Tag

| Field | Notes |
| --- | --- |
| `id`, `name` | Identity and label. |
| `parentId` | Optional. Tags form a tree of unlimited depth. |
| `agendaIds` | Empty list means **global**. A filled list means the tag is **restricted** to those agendas. |
| `color` | One base tone. Light and dark variants are derived. |

Scope rules:

- A child tag inherits its parent's scope and can only be **equal or narrower**, never wider.
- Restricting a parent also restricts the children that would fall outside, with a notice listing what changed.
- When picking tags for an item, show global tags plus tags restricted to that item's agenda.
- In filters with several agendas selected, show tags valid in at least one of them, and mark the ones that exist only in part of the selection.
- When an item moves to an agenda that does not include one of its tags, ask what to do: widen the tag scope, remove the tag from the item, or keep it anyway. Asking is the default.
- Filtering by a parent tag includes all descendants. Filtering by a leaf includes only that tag.
- Inheritance between items: an item's tags are its own plus its parent's, while its `inheritTags` switch is on. It is dynamic (a tag added to the parent later reaches the children), not a copy. A work block or subtask therefore shows up when filtering by the task's tag, and a child that does not belong to the parent's project turns the switch off.
- If every agenda is selected in a restricted tag, offer to convert it to global.

### Status

A status belongs to a Kanban column, and a column belongs to a group. The group is what the app understands (for example what counts as done and what leaves the today list). Each group has a role, `planned`, `started` or `done`, and the app reads the role, never the name. Column and group names are free.

| Group | Starting columns |
| --- | --- |
| Planned | Idealized, Paused, Scheduled |
| Started | Started, In progress |
| Done | Done, Delivered |

Groups and columns can be created, renamed, reordered and moved between groups.

### Day period

Not stored. Computed from an item's start and end, in the display time zone. Defaults, all editable (stored as the hour where the morning, the afternoon and the evening start):

| Period | Hours |
| --- | --- |
| Dawn | 00h to 06h |
| Morning | 06h to 12h |
| Afternoon | 12h to 18h |
| Evening | 18h to 24h |

An item that crosses periods (for example 11h to 14h) appears in every period it overlaps. An item that ends exactly where a period starts (11h to 12h) does not enter that period. Whole-day and unscheduled items have no period. On a day when the clock changes, the periods follow the wall clock.

## Dates, times and time zones

A schedule is one of two shapes:

| Shape | Fields | Meaning |
| --- | --- | --- |
| Whole day | `allDay: true`, `start`, optional `end` (dates, `YYYY-MM-DD`, last day included) | No time zone. "The 12th" is the 12th wherever you are. |
| Timed | `allDay: false`, `start`, optional `end` (instants in UTC, ISO 8601) | An absolute moment, shown in the display time zone. Optional `timeZone` (an IANA name such as `Europe/Lisbon`) for items that belong to another city. |

Settings:

- **Display time zone:** `auto` (follow the device, the default) or an IANA name. The Timeline days, the day periods and the calendar use it.
- **Day period bounds:** the three start hours, validated so that `0 < morning < afternoon < evening < 24`.

Notes:

- The IANA name is stored, and not a fixed offset, because daylight saving time changes the offset during the year.
- A wall clock reading that does not exist (the clock jumped forward) moves forward by the gap. A reading that happens twice (the clock went back) resolves to the first occurrence.
- A day can have 23 or 25 hours.
- The core never reads the device zone by itself. Every function that needs a zone receives it.

### Task window

Analogy: a teacher hands out an assignment on the 3rd and it is due on the 24th. From the 3rd to the 24th it sits on your desk, so you should see it on every one of those days, and not only on the day you hand it in.

A task has a **window**: the days when it counts as pending. It holds dates only, with no time of day, because "assigned on Monday" has no hour that matters.

| Field | Meaning |
| --- | --- |
| `from` | First day of the window. Optional. Empty means the day the task was created, in the display zone. |
| `due` | The delivery. `{ allDay: true, date }` (the default) or `{ allDay: false, at, timeZone? }` for a deadline time such as 23:59 on a portal. `at` is an instant in UTC. |

Rules:

- The window runs from `from` to the due day, both included. The due day of a timed delivery is the day it falls on in the display zone, like everything else on screen.
- A task is pending on every day of its window until it is done. After the due day it moves to the overdue strip, which stays until the task is done.
- `from` needs `due`, and `from` cannot come after the due day.
- With no `from`, a task created after its own due day gets a window of just that day, so it is not hidden.
- The window takes no room on the timeline. It is a quiet "open" strip at the top of each day, apart from events with a time, with the due day highlighted.
- A whole-day delivery is late when its day is over. A timed delivery is late right after its time.
- Marking a task as done on the Timeline only changes its `statusId`, to the first status (by order) of the first group whose role is done. It leaves the open and overdue strips on the next read, and the previous status can be restored right after. The edit form and, later, the Kanban change the same field.

### Work block

Time reserved to take care of a task, such as "Tuesdays from 14h to 16h". It is an ordinary timed event placed **under the task** (`parentId`), so it shows in the calendar and in the timeline at its own hour. Events never count in progress, so work blocks do not change the progress bar of the task. A task can have many blocks, and deleting one does not touch the task.

### Recurrence (delivery 8)

A repetition rule (such as "every Tuesday") stored on the item, with the occurrences computed on demand and no copy saved per day. It will serve work blocks, which can repeat until the due day, and tasks that repeat on their own. The current model does not need to change to receive it.

### Saved view

What the person chose to see in the Timeline, saved under a name. Fields: `name`, `order` (position in the list), `filter`, `agendaIds` and `layout`, plus the sync fields. It holds ids and plain values only, so it syncs like everything else. Views are for the Timeline for now, and the lens in use is not saved.

The filters are one plain `ItemFilter` (`src/filters/types.ts`): `tagIds`, `kinds`, `periods` (day periods and `untimed`), `text` and `dueWithinDays`. It holds only lists, text and a number, so a saved view can store it as JSON. Empty means that sieve is off. `SavedViewFilter` in the `core` has the same shape, written out there because the `core` cannot import from `filters`, and a test keeps the two equal.

- **Agendas:** `agendaIds` is a list of agenda ids, or `null` for every agenda, including the ones created later (the default). An empty list means none. Deleted agendas are ignored when the list is read, and if every agenda it names is gone, the Timeline shows all of them again instead of an empty screen. Groups are never saved: a group is only a shortcut that ticks its agendas.
- **Layout:** `mixed` (one list per day), `separate` (one section per agenda) or `grouped` (one section per group, plus "No group"). It hides nothing, so it is not a filter.
- **Names:** required, up to 80 characters, and not repeated among active views (ignoring case and the spaces at the ends).
- **Cleanup:** deleting an agenda takes it out of the views that list it (a view that listed only that agenda goes back to every agenda), and deleting a tag takes it out of their filters.
- **"Changed":** a view counts as unchanged while the screen shows what it saved. Lists are compared without their order, and "every agenda" equals a list naming all of them.

### Theme tokens

All colors come from tokens such as background, surface, text and border, with a value per theme. Agenda and tag colors are stored as a base tone, with light and dark variants derived and checked for contrast. States such as overdue, today and done are tokens too.

## Sync fields

Every entity (agenda, agenda group, item, tag, status, saved view) carries the same four fields, from delivery 1, so that sync can be added later without migrating data:

| Field | Notes |
| --- | --- |
| `id` | A UUID generated on the device, never by a server. |
| `createdAt` | When it was created. |
| `updatedAt` | When it last changed. Used to decide which version wins. |
| `deletedAt` | Empty while the entity exists. Deleting sets it instead of removing the record, so the other device learns about the deletion. This marker is called a tombstone. |

## Storage, accounts and sync

Local-first. Data always lives on the device (IndexedDB), with JSON export and import.

### Local database

IndexedDB is the browser's built-in database. The app reaches it through Dexie, in `src/storage`.

| Table | Holds | Indexed for queries |
| --- | --- | --- |
| `agendas`, `agendaGroups` | Agendas and their groups | `order` |
| `items` | Events, tasks and work blocks | `parentId`, `agendaId`, `statusId`, `tagIds` (one entry per tag) |
| `tags` | Tags | `parentId` |
| `savedViews` | Saved Timeline views (database version 2) | `order` |
| `statusGroups`, `statuses` | Kanban groups and columns | `order`, `groupId` |
| `meta` | Small app data: the settings and the "defaults were created" mark | `key` |

- Every entity table also indexes `updatedAt` and `deletedAt`, for sync.
- Deleting marks `deletedAt` and keeps the record. Lists hide deleted entities unless asked.
- The starting Kanban groups and columns are created the first time the app opens, and never again, even if every group is deleted on purpose.
- The date fields of items are not indexed. The views filter in memory with the pure functions of the `core`.
- Settings are checked on load and on save. A stored value that is no longer valid falls back to its default.

### Backup file

JSON export and import, as one file named like `unified-agenda-2026-11-07.json`.

```json
{
  "format": "unified-agenda-backup",
  "version": 1,
  "exportedAt": "2026-11-07T20:00:00.000Z",
  "settings": { "displayTimeZone": "auto", "periodBounds": { "...": 6 } },
  "data": { "agendas": [], "agendaGroups": [], "items": [], "tags": [], "savedViews": [], "statusGroups": [], "statuses": [] }
}
```

- The export is one consistent snapshot. It keeps deleted entities (tombstones) by default, so that importing it elsewhere can tell they were deleted.
- **Import is all or nothing.** The whole file is checked first: types, dates, time zones, repeated ids and the item rules of the `core`. If anything is wrong, the result lists every problem with its place (for example `data.items[3].title`) and nothing is written. Unknown extra fields are dropped.
- The write itself is one transaction, so a failure halfway leaves the data as it was.
- **Merge** adds what is new. For an id that exists on both sides, the version with the newest `updatedAt` wins, and a tie keeps the local one. Nothing is removed. Settings come from the file only when this device has none saved.
- **Replace** makes the device equal to the file, erasing everything else, settings included. The file must stand alone: an item that points to an agenda, parent, status or tag missing from the file is refused.
- Importing into a fresh install should use replace, because merging would leave the default Kanban groups next to the ones in the file. The app can tell the data is fresh, since nothing has been created yet.
- `savedViews` is optional on import: an older file without it counts as "no views", and replacing from it clears the views on the device. A view that points to an agenda or tag missing from the file is refused when replacing. The format `version` stays 1 for this reason.
- The file `version` is separate from the database schema version. A new file version adds a reader for the old one.

**Two modes:**

- **Guest:** everything stays in the browser. The app never contacts a server. Guest data can be exported, and imported into an account later.
- **Account:** the same local data, plus a copy in the cloud (Supabase) that syncs across web and phone. Sign-ups are closed, so accounts are created by the owner.

**Conflicts:** when the same item changed on two devices, the version with the newest `updatedAt` wins (last write wins). This is enough for one person with two devices. The only risk is losing an edit when both devices change the same item before syncing.

**Security:** in the cloud, every row belongs to one user, and row level security (a database rule that says "this row is visible only to its owner") is mandatory. A test must prove that one account cannot read another account's rows.
