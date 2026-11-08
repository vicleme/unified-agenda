# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Timeline tests no longer depend on the real date: tasks with no start day begin on the day they were created, so the tests now fix the creation day.
- Rename the project to Unified Agenda and reposition it as "one item, many lenses, all local".
- Rewrite the README rationale after reviewing existing tools.
- Add dawn (00h to 06h) as a fourth day period.
- Tasks no longer use `schedule`. It is now only for events and work blocks, and validation rejects mixing a schedule with a window.
- Move accounts and sync to their own delivery and shift later deliveries.
- Item rows show short buttons (Edit, Subtask, Block, Move, Delete) with the full name kept for screen readers, and the Manage tabs fit in 390 px.
- Screen tests no longer print `act(...)` warnings.
- Delivery 3-5, closing delivery 3: the filter panel sits inside the sticky bar on wide screens so it is always in view, and the type and when checkboxes run in a row, which shortens the sheet on phones. Visual check at 390 px and 1280 px, in light and dark. README status, roadmap state and decisions, and the data model in both languages. Delivery 3 is complete.

### Added

- Delivery 4-7, closing delivery 4: visual check of the filter panel with saved views at 390 px and 1280 px, in light and dark. README status, roadmap state and decisions (agenda selection, layout, saved views), and the data model (the `SavedView` entity, the `savedViews` table and the backup file) in both languages. Delivery 4 is complete.
- Delivery 4-6, saved views screen: a "Saved views" block at the top of the Timeline filter panel with a View picker (picking one sets the filters, the shown agendas and the layout), "Save as view" and "Save as new view", and, for the picked view, Update (with what is on screen), Restore (back to what was saved), Rename, Up, Down and Delete (asks first). Names must be filled and not repeat another view. A line under the bar says which view is on and whether it was "changed". The filters, agenda selection, layout and picked view now live in the app shell, so they are still there after a trip to another tab or to Manage. `src/filters/savedViews.ts` holds the plain logic (`snapshotControls`, `controlsFromView`, `isViewCurrent`, `sortSavedViews`, `viewNameProblem`). Both languages.
- Delivery 4-5, saved views storage (no screen yet): a `SavedView` entity (name, order, filter, shown agendas, layout) in a new `savedViews` table (database version 2, existing data is kept), its repository, and backup support. Older backup files with no saved views still import, and replacing from one clears the views. Deleting an agenda takes it out of the saved views that list it (a view that listed only that agenda goes back to every agenda), and deleting a tag takes it out of their filters.
- Delivery 4-4, layout in the Timeline: a "Layout" block in the filter panel (shown with two or more agendas) to choose mixed (one list in time order, as before), separate (one section per agenda) or grouped (one section per group, plus "No group"). Each day, and today's overdue strip, is dealt into the same sections. The layout hides nothing, so it is not counted as a filter and "Clear filters" leaves it alone. `arrangeDayWithOverdue` in `src/filters`. Both languages.
- Delivery 4-3, agenda selection in the Timeline: an "Agendas" block in the filter panel with one checkbox per group (all, some or none shown) and one per agenda. A hidden agenda counts as a filter, "Clear filters" shows every agenda again, and the tag list only offers tags valid in the shown agendas (marking the ones that exist in only some). Hiding an agenda takes its now unavailable tags out of the tag filter and says which.
- Delivery 4-2, agenda groups and order: a "Groups" tab in Manage to create, edit (name and agendas), reorder and delete groups (deleting one keeps the agendas and their items), and Up and Down buttons on agendas and groups, with `moveStep` in the `core`.
- Delivery 4-1, agenda selection and layout logic in `src/filters` (no screen yet): `AgendaSelection` (a list of agenda ids, or `null` for every agenda including future ones) with `visibleAgendaIds`, `toggleAgenda`, `toggleGroup`, `groupState` and `filterByAgendas`, and `AgendaLayout` (`mixed`, `separate` or `grouped`) with `createLayoutPlan`, `arrangeDay` and `arrangeOverdue`, which deal a Timeline day and the overdue strip into one section per agenda or per group. Delivery 4 is split into seven parts (4-1 to 4-7).
- Delivery 3-4, Timeline filters: a "Filters" button in the bar (it shows how many filters are on) opens a panel with text search, type (event or task), when (the four day periods and "No set time"), tags as a tree (a parent also shows its sub-tags) and "show open tasks only when due within N days". On a phone the panel is a sheet over the screen, on a wide screen a card under the bar. A line under the bar says that filters are on and clears them, and a message appears when nothing matches. Period hours come from the settings. Both languages.
- Delivery 3-3, tags on items: the event and task forms (and work blocks) get a Tags field with a checkbox per tag valid in the item's agenda (a tag the item carries that stopped being valid stays visible so it can be removed), and, for an item inside another, an "Inherit the tags of ..." switch that lists the inherited tags and where they come from. Item rows show the item's tags and, dimmed, the inherited ones as "tag (from item)". Both languages.
- Delivery 3-2, tags screen: a "Tags" tab in Manage with the tag tree (sub-tags indented, siblings by name), create and edit (name, color, parent, agendas where it is valid), a notice when a change narrows sub-tags to fit inside their parent, "Make global" for a tag that covers every agenda, and delete with the counts (sub-tags and items) that also takes the tag off the items. `removeTagCascade` and `countTagUsage` in `storage`. Both languages.
- Delivery 3-1b, tag inheritance and the "no set time" period: items get an `inheritTags` field (on by default, older backups count as on) and `inheritedTags` and `effectiveTagIds` in the `core`, so a subtask or work block passes a tag filter through its parent's tags until the switch is turned off. The period filter gains the `untimed` chip (whole-day events and the task strips), with `applyOverdueFilter` for the overdue strip. Day periods alone now hide the tasks. No screen yet.
- Delivery 3-1, filter logic in `src/filters`: `ItemFilter` (tags, kinds, day periods, text, "due within N days"), `isFilterActive`, `filterItems` and `createItemMatcher` for tags (a parent includes its descendants, deleted tags are ignored), kind and text (every word, ignoring case and accents, in title, notes and location), and `applyDayFilters` for the sieves that depend on the day (periods, and hiding a task until its delivery is near). No screen yet.

### Fixed

- Delivery 2-5, Timeline overdue strip: a timed delivery that passed today is shown once, in the overdue strip, as "Late today" with its hour, instead of also appearing in today's open tasks with "1 day late". `daysLate` can now be 0 (late today). "N days late" stays for deliveries from earlier days. Both languages.

### Added

- Delivery 2-4, closing delivery 2: a "Done" button on every task row of the Timeline (open and overdue strips). It gives the task the first status of the first done group, shows a message with an Undo button for a few seconds, and is not drawn when there is no done status or on events. `defaultDoneStatusId` in the `core`. Visual check at 390 px and on a wide screen, in light and dark. README status, roadmap state and decisions (no list virtualization, how Done works), data model and contributing notes in both languages. Delivery 2 is complete.
- Delivery 2-3b, Timeline navigation: a "Back to top" button that appears after scrolling, and a "Go to date" picker that opens folded days or, for a date outside the loaded days, loads the days around it. "Go to today" works from there too. Both languages.
- Delivery 2-3, endless Timeline: the list opens on today (a week before and three weeks ahead) and loads 14 more days when the scroll gets near either end, or from the "Show earlier days" and "Show later days" buttons, without the page jumping when days are added above. A "Go to today" button stays at the top, and empty days in a row fold into one line that opens and closes. Both languages.
- Delivery 2-2, static Timeline screen: the Timeline tab now shows one block per day for today and the next 13 days. Each block has the overdue strip (today only), the strip of open tasks with the delivery day first, whole-day items and timed items in time order, with "continues" marks, hours cut to each day, the agenda of each item and the task that holds a work block. Read-only, no endless scroll yet. Both languages.
- Delivery 2-1, Timeline day logic in the `core`: for each day, whole-day items, timed items in time order, the strip of open tasks (delivery day first), whether the day is empty, and the overdue strip with days late. Items that span days appear on every day they touch with "continues" marks, days are cut in the display zone (23 or 25 hours on clock change days), and an item that ends exactly at midnight does not reach the next day. No screen yet.
- Delivery 1d-7, closing delivery 1: visual check at 390 px and on a wide screen, in light and dark, with the README status and a "Running it" section in both languages, the roadmap state and two contributing notes (short row buttons, screen tests that settle). Delivery 1 is complete.
- Delivery 1d-6, backup: a Backup tab in the Manage area. Download everything as one JSON file, and restore from a file by merging or replacing. A bad file is refused whole, with each problem listed with its place and nothing changed. Replacing a device that already has data asks first, and an empty app is suggested to replace. A summary says what was added, updated and left unchanged. Both languages.
- Delivery 1d-5, settings: choose the display time zone (automatic or a named zone, with suggestions) and the three hours that split the day into periods, with a message on each invalid field. Saving a new zone updates the times shown in the item lists. Both languages.
- Delivery 1d-4, items part B (tasks and hierarchy): create and edit tasks with a status, a delivery (none, a day or a day and time, with an optional time zone), an optional start day, a location, notes and links. Items show as a tree that starts folded, with sub-items and work blocks inside a task, a progress bar on items that have counted children, and a Move panel as the touch alternative to dragging. Both languages.
- Delivery 1d-3, items part A (events): pick an agenda, list its items, and create, edit and delete events in the Manage area. An event can have no date, a whole day or a time, an optional end and time zone, a location, notes and links. Every rule of the core has a field message in both languages.
- Delivery 1d-2, agendas: list, create, edit (name and color) and delete agendas in the Manage area. Deleting asks first and says how many items will be deleted with it. Eight ready-made colors plus a custom color picker, and new `danger` theme tokens for light and dark.
- Delivery 1d-1, interface foundation: data provider with the first-open setup, list hooks that refresh after writes, cascade delete for agendas and items (with a count for the confirmation), count and date formatting with `Intl` (Portuguese gets its own text for zero), and a Manage area with empty Agendas, Items and Settings sections.
- Delivery 1c, local storage: Dexie database over IndexedDB, one repository per entity with soft delete, saved and validated settings, and the starting Kanban groups created once.
- JSON backup: export as one consistent snapshot with tombstones, and an all or nothing import that checks every field and reports each problem with its place. Merge (newest `updatedAt` wins) and replace (the device ends up equal to the file) modes, run in one transaction.
- ESLint rule that keeps `storage`, `filters` and `sync` from importing `ui` or `views`.
- Task window: a task now has `from` (first day it is pending, defaulting to the day it was created) and `due` (a day, or a day and time), so it shows as pending on every day until it is done. Pure functions `taskWindow`, `isInWindow`, `pendingOnDate`, `overdueTasks`, `isPastDue` and `workBlocks`, with tests.
- Work blocks: timed events placed under a task, in time order, with no effect on its progress.
- Delivery 1a: Vite, React and TypeScript project, theme tokens with light, dark and automatic modes, responsive shell with a bottom tab bar on phones and a side bar on wide screens, and the quality scripts (`test`, `typecheck`, `lint`, `format`, `check`).
- Delivery 1b, the `core`: entity types with the sync fields, factories with a fixed clock and ids for tests, soft delete, recursive progress, day periods, tag scope rules (inheritance, narrowing, filters), item validation and the default Kanban groups.
- Time zones: display time zone setting, UTC instants, whole-day items without a zone, optional zone per item, and correct handling of daylight saving time changes.
- ESLint rules that keep the framework-free folders free of React and the `core` free of upper layers.
- Interface in Portuguese (Brazil) and English: automatic detection from the browser, a language selector, the page `lang` kept in sync, and typed message files that the compiler and a test keep complete.
- First tests: theme logic, interface strings without dashes and the app shell.
- `netlify.toml` with the build settings.
- Planned tech stack: TypeScript, Vite, React, Dexie, Supabase and Netlify.
- Guest mode (local only) and approved accounts with sync, with sync fields on every entity.
- Hosting and free tier rules for Netlify and Supabase.
- Mobile and touch requirements across the roadmap and contributing guide.
- Interface text rule: avoid unnecessary dashes.
- Security rules for the cloud (row level security and secrets).
- Display modes for sub-items listed as an open decision.

## [0.0.0]

### Added

- Initial project scaffold: READMEs in English and pt-BR, license, docs and module folders.
