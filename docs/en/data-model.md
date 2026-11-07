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
| `start`, `end` | Date and time. Both optional for tasks. |
| `allDay` | Whether the time of day is ignored. |
| `agendaId` | Agenda the item belongs to. |
| `tagIds` | Zero or more tags. |
| `statusId` | Required for tasks. Optional for events (for example Postponed, Canceled). |
| `location` | Free text. |
| `links` | List of `{ label, url }`. |

Rules:

- A checklist is an item with simple children (title and a checkbox, no dates). A child that gains a date, time or tag simply shows up in the other views, because it is already a full item.
- A parent's progress is computed from its children, recursively.
- Tasks without a date are allowed and live in an inbox.
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
- If every agenda is selected in a restricted tag, offer to convert it to global.

### Status

A status belongs to a Kanban column, and a column belongs to a group. The group is what the app understands (for example what counts as done and what leaves the today list). Column names are free.

| Group | Starting columns |
| --- | --- |
| Planned | Idealized, Paused, Scheduled |
| Started | Started, In progress |
| Done | Done, Delivered |

Groups and columns can be created, renamed, reordered and moved between groups.

### Day period

Not stored. Computed from an item's start and end. Defaults, all editable:

| Period | Hours |
| --- | --- |
| Dawn | 00h to 06h |
| Morning | 06h to 12h |
| Afternoon | 12h to 18h |
| Evening | 18h to 24h |

An item that crosses periods (for example 11h to 14h) appears in every period it overlaps.

### Saved view

A name plus a combination of: visible agendas and groups, layout (mixed, separate or grouped), filters (tags, type, period, text) and the lens in use.

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

**Two modes:**

- **Guest:** everything stays in the browser. The app never contacts a server. Guest data can be exported, and imported into an account later.
- **Account:** the same local data, plus a copy in the cloud (Supabase) that syncs across web and phone. Sign-ups are closed, so accounts are created by the owner.

**Conflicts:** when the same item changed on two devices, the version with the newest `updatedAt` wins (last write wins). This is enough for one person with two devices. The only risk is losing an edit when both devices change the same item before syncing.

**Security:** in the cloud, every row belongs to one user, and row level security (a database rule that says "this row is visible only to its owner") is mandatory. A test must prove that one account cannot read another account's rows.
