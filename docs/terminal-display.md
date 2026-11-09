# Terminal themes and display settings

Open **Terminal appearance** with the palette button on the SSH server bar. Its settings apply across connections, split panes, retained terminals and recorded logs in the current browser origin. The window keeps a fixed viewport-capped height. On desktop, only the keyword list scrolls; narrow or very short windows and expanded management/import panels allow the dialog body to scroll. No server connection is required.

## Apply a saved theme

**Follow DSH / Dark / Light** remain radio buttons. Immediately after them, a single editable theme combobox shows the current name: type to rename, or click its arrow / use Arrow keys and Enter to select a saved theme. Selecting a built-in from the other mode also switches display mode. There is no separate theme-name field or recommended-mode control. Dark and light assignments remain independent; custom themes can be used in either mode. Switching theme or display mode protects unsaved edits.

The existing 16 ANSI colors, cursor and selection behavior are unchanged. Custom terminal backgrounds choose a readable base foreground by luminance; user-defined semantic colors are unrestricted. Semantic highlighting is off by default for new preferences. Draft preview remains colored even while live highlighting is off.

## Create, edit, copy and rename

1. A fresh profile offers only DSH default dark and light. Stored appearances identical to a DSH default do not generate migrated custom themes. A differing existing appearance is preserved as **Custom theme**.
2. Changing a default theme's background, name, colors or keyword rules automatically detaches a draft named **Custom theme**. A name typed into the combobox overrides that automatic name. The two built-ins are never overwritten.
3. **Save theme** saves and applies the draft. The first save creates the detached custom theme; later edits update that same theme ID without adding another record. Saving and applying are atomic. The second row contains **Theme background**, unsaved status, Save, **Create theme copy**, and More actions.
4. **Create theme copy** explicitly saves and selects an independent copy, including unsaved edits. Built-in copies start as **Custom theme**; custom copies receive a copy suffix. Duplicate names receive a numeric suffix. There are no separate New theme or Save as actions.
5. **Discard changes** reloads the applied theme. Switching themes or modes, or closing with unsaved changes offers Save and continue / Discard and continue / Cancel. Pending tag input is included even before Enter; invalid regex blocks saving without discarding it.
6. **More actions → Manage themes** offers export and deletion. Choose themes with the combobox; rename them directly in that same control.

Body text and controls use 12px text, inputs and buttons are 30px high, and sections use a 12px gap with 20px horizontal padding. Background has no reset shortcut; choose a DSH default to restore its appearance.

No shared per-mode working copy exists. Editing A and then B cannot overwrite A. Saving a theme assigned to both modes updates both live assignments. Revision checks block stale saves after another window changes a theme; Create theme copy preserves the local edits.

Each theme includes its background, entries, colors, pattern text, order, per-entry enabled and case-sensitivity switches. Keywords and regex use one tag input, without a matching-mode dropdown. Enter/blur commits a tag, clicking a tag edits it, and × removes it. Drag the handle or use Alt+Up/Down to reorder. Limits remain 43 entries, 64 tags per entry, 512 characters per tag and 8192 characters per entry. Up to 64 custom themes can be stored, with reserved slots for upgraded release configurations.

## Export versus backup

- **Export this theme** exports the explicit editor target. **Export draft** includes current unsaved data and pending tag input; it does not silently export the live dark theme when editing a light theme. Theme-list Export exports that saved record.
- A single theme uses the existing `dsh-ssh-ops.color-scheme` **version 2** JSON, containing background and entries with optional `name` and stable `id` metadata. The old v2 file format remains importable. See [complete example](terminal-color-scheme.example.json).
- **Back up all themes** exports every saved theme, both assignments, the follow-DSH/fixed display preference and the live-highlighting switch. It excludes unsaved drafts, as its success message states. The library format is `dsh-ssh-ops.theme-library`, **version 1**, with `themes`, `selectedThemes` and `display`. This is a separate data-format version, not a plugin version bump.

## Import and restore

Import accepts a single v2 theme or a complete library backup. Before confirmation, a single theme shows its name, recommended mode, background and rule count. Names are editable. A matching ID, name or appearance is disclosed; an exact stable ID is preferred when suggesting an update target.

- **Add a copy** creates a new independent theme, without automatically applying it. Imported themes are available in the theme dropdown for either display mode.
- **Update existing theme** explicitly chooses the saved record to update, preserving its ID. If it is currently applied, its users in both modes update together. A conflicting newer revision blocks the update.
- **Skip / cancel** makes no changes.
- For a complete backup, **Merge** adds themes without overwriting existing themes or display assignments. Repeating the same merge does not create repeated conflicting copies.
- **Full restore** replaces the saved library, both assignments and display settings after explicit selection. If the editor has unsaved changes, it offers **Export draft and continue** rather than saving into a library that is about to be replaced. Malformed files, unknown versions, duplicate IDs and dangling references are rejected atomically. Library files are bounded to 8 MiB; single-theme files retain the 1 MiB limit.

File selection cancellation, confirmation cancellation, success and failure all leave the appearance window open. Failures retain the import form or editor draft. Export never uploads files.

## Delete and restore defaults

Delete any custom theme from Manage themes without activating it. If the theme is assigned to dark or light display, confirmation explains that affected assignments will fall back to the respective DSH default. Other themes and edits are never written into a shared replacement slot. An unsaved draft of the theme being deleted can be exported first. Built-ins cannot be renamed, overwritten or deleted.

Choose **DSH default** in the current theme dropdown for that display mode to restore that assignment. Saved custom themes and the independently selected editor target remain available.

## Persistence and upgrade policy

Settings remain local under `dsh-ssh-ops.terminal-display.v1`. Same-origin windows synchronize saved records and assignments; updates read the latest stored data before committing. Library operations require a verified storage write. Quota, disabled-storage or other write failures produce a visible unsaved warning, do not report success, and retain the draft for retry or export. Legacy low-level preferences may remain usable in memory after a blocked write; the same persistence warning makes that limitation visible.

Only upstream **v0.4.8** is the upgrade baseline. Existing per-mode backgrounds, edited patterns, colors, order, switches and custom entries are preserved. Merely opening the settings window does not write a migration. On the first library action, existing custom configurations become independent named records with stable IDs; both mode assignments remain unchanged in appearance. There is no heuristic replacement of explicit user patterns. The model stores named records in optional `themeLibrary` / `selectedThemes` fields and materializes applied records into the established `schemes` / `backgrounds` fields, keeping matching separate from theme management.

The default tags remain readable words and phrases from this project's own existing lists, while all eleven release highlight categories retain structural recognition and priority. No external terminal theme or keyword source was consulted. Plugin version remains unchanged in this branch; release numbering can continue normally from 0.4.8 to 0.4.9.

## Shared log appearance and host UI

The **Logs** tab and its search results use the same resolved theme, background, semantic entries, enabled switches and matching priority as live terminals. The global semantic-highlight switch now controls both viewers. This replaces the older fixed whole-line warning/error colours. Changes to settings or the DSH theme update an open viewer; switching logs never reuses matches from the previous text. Raw recordings, downloads, search offsets and copied text remain unchanged.

Log matching uses the shared background worker and its timeout/quarantine safeguards. Each viewer submits at most the first 65,536 UTF-16 code units and receives at most 4,096 token spans; text beyond that budget remains visible and copyable in the base foreground. Search hits use a separate bounded request, so long log content cannot consume their budget. While a new match is pending, or if the worker fails, the current text renders without semantic colours.

Quick-command cards, editors and batch-result surfaces use DSH host UI colours. They follow the host's light/dark theme even when Terminal appearance is fixed to a different theme or uses a custom background.

## Backup protocol for agents

Agents may convert other software's exported colors and rules into the plugin's own v2 JSON. The plugin does not parse third-party formats. The stable envelope is `format: "dsh-ssh-ops.color-scheme"`, `version: 2`, `theme: "dark" | "light"` (recommendation), six-digit hex `background`, and an `entries` array; optional top-level `name` and `id` support naming and explicit update matching. Each entry carries `id`, `color`, `enabled`, `mode`, `caseSensitive`, newline-separated `text`, and an optional display `name`. UI edits and exports use regex entries for ordinary keywords and advanced patterns. Legacy v2 word/contains entries remain readable as equivalent regex. Do not silently overwrite an existing theme based on its name; an update requires an explicit target.

The complete-library format is separate and validated before restore. Theme metadata does not add ANSI 16-color, cursor or selection customization; those remain a separate future protocol extension.

## Rendering boundaries

Only default-style xterm cells receive semantic foreground decorations. Existing remote ANSI foreground/background colors and font attributes take priority. The matcher joins automatic wraps and maps Unicode text back to xterm cell widths; it does not modify terminal bytes, copy/search text, session logs, or agent output. Alternate-screen applications such as editors are not decorated.

Highlighting is heuristic, not a complete shell parser or a full shell grammar. Custom prompts can be misclassified. IPv6 support covers common hexadecimal full/compressed forms, not every zone-ID or IPv4-mapped form. Quoted escape subrules, rainbow brackets, folding and links are outside this feature.

Work is coalesced over 60 ms with a **leading throttle**: later events do not restart the timer, so colours keep flowing during a scroll instead of waiting for the wheel to stop. Scrolling into history, resizing, leaving an alternate-screen application, or any repaint after a wheel/scrollbar movement triggers a rescan. xterm 5.5 deliberately suppresses `onScroll` for user wheel scrolling and scrollbar dragging, so the addon tracks the viewport position from render events and polls it every 250 ms as a fallback.

A scan is limited to 200 visible physical rows and **1024 decorations**; the decoration budget fills **from the bottom row up**, so the newest output keeps its colours and the oldest visible lines are left plain when a dense screen exhausts it. Logical reads stop at 16384 cells and wrapped-line backtracking at 256 rows; extreme lines can be partially highlighted. Unchanged rows reuse their markers/decorations. A worker result computed before a scrollback trim is rebased onto the shifted lines (only a result whose anchor row was itself trimmed is discarded and requested again). A decoration API failure disables highlighting for that terminal while keeping theme changes and terminal input/output available. The refresh and recovery strategy is described in [highlight-refresh-fix.md](highlight-refresh-fix.md).

All user regex matching runs in one shared background worker, including preview matching. Queued jobs coalesce per terminal/preview. Matching has a 150 ms deadline after worker startup; a timed-out worker is terminated and that exact scheme is quarantined for 30 seconds, or until the colour scheme is edited (editing clears every quarantine). Other valid schemes can continue in a replacement worker. Releasing a terminal never retires the shared worker while another terminal still holds a lease, so switching tabs or disposing a pooled terminal does not stall the others. A failed scan keeps the last good decorations, reports the cause once, and backs off (500 ms doubling to 5 s) instead of clearing and rescanning every 60 ms. Input and theme changes remain available. If the host cannot create the worker, highlighting stays unavailable with a preview message; regex execution never falls back to the UI thread. The worker bundle is embedded in the client build and has no separate network route or runtime package dependency.

The default ANSI palettes and classification rules are designed in-house for this project (see [implementation review](terminal-appearance-cleanroom.md) and [third-party notices](../THIRD_PARTY_NOTICES.md)); the terminal chrome (background, text and cursor) follows the DSH terminal theme. The semantic palette keeps at least 4.5:1 contrast on each theme's DSH background — enforced by `test/terminal-appearance-contrast.mjs` — while user overrides and server truecolor values are unrestricted.

## Validation

```sh
node --test test/output-highlight.mjs test/terminal-display-settings.mjs test/regex-worker.mjs test/highlight-refresh.mjs test/highlight-drag-order.mjs test/preview-text.mjs test/terminal-appearance-semantic.mjs test/terminal-appearance-contrast.mjs test/terminal-appearance-migration.mjs
npm test
npm run lint
npm run build
git diff --check
```

The feature tests use the real xterm buffer and real worker threads: ANSI/truecolor/styles, wrapped lines, wide-character wrap padding, Chinese/emoji/combining characters, carriage-return overwrites, alternate screen, resize/zoom, bounded scrollback, disposal, failure isolation, persistence, migration, per-theme schemes, regex/Unicode matching, zero-length matches, catastrophic-pattern deadlines, queue coalescing, recovery, entry switches, reset/export and cross-window ordering. The feature files listed above also cover refresh/recovery, drag-order geometry and the preview seed text, which exercises every built-in category and includes CJK characters. They are included in `npm test` and the existing CI matrix.

For browser/DSH acceptance, check follow-DSH and both fixed themes with highlighting on/off, add/edit/delete regex tags, drag entries and use keyboard ordering, test timeout/recovery, restore/export the current theme, verify that the other theme survives reset, edit preview text with undo and scrolling, check Escape/outside-click closing and focus restoration, switch DSH's outer theme, search/select/copy terminal text, resize and split panes, switch tabs/reopen retained terminals, and reload or restart to check persistence. Validate narrow sidebars and both UI languages. Browser component checks do not replace an end-to-end run inside the DSH host.
