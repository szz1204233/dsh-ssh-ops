# Terminal display settings

Click the muted **palette button** on the right of the SSH server bar to open **Terminal appearance**. It configures every SSH terminal in the current browser origin, including split panes and retained terminals. A server connection is not required. The dialog preserves the current tab, traps keyboard focus, closes with Escape or an outside click, and restores focus to the button.

- **Theme:** follow DSH (default for new preferences), dark or light. Existing saved dark/light choices are preserved. Both presets define all 16 ANSI colors, cursor and selection colors. Remote truecolor values are preserved.
- **Semantic highlighting:** off by default. When off, every scheme, backup and preview control below the switch is hidden, without discarding saved configuration. Existing explicit opt-in preferences are preserved on upgrade.
- **Color scheme:** a wide horizontal list, stored independently for dark/light themes. Each entry has an enable switch, color/HEX controls, case-sensitivity toggle and editable tags. Each tag is a JavaScript regex source without `/` delimiters; ordinary keyword text works directly. Enter adds a tag, clicking edits it, and × deletes it. Invalid expressions remain drafts with inline feedback. There is no matching-mode dropdown. Unmodified defaults preserve the original semantic classifications; default keyword categories use readable keyword tags and structured categories expose their patterns. Up to 43 entries, 64 tags per entry, 512 characters per tag and 8192 total characters per entry are supported.
- **Ordering:** drag the left handle to change priority. Keyboard users can focus the handle and use Alt+Up/Down. Dragging preserves current tag edits and scheme identity. Narrow windows wrap the tags beneath the row controls.
- **Reset and backup:** adjacent buttons restore the current theme's entire default scheme (colors, patterns, switches and ordering) or download its full scheme as JSON. The other theme is preserved. Backup does not upload data. Legacy colors and literal/whole-word rules migrate to equivalent regex patterns.
- **Editable preview:** type directly into the colored preview box. A native textarea handles caret, selection, undo and text entry over an inert highlighted mirror; there is no separate editor. Both layers use the same font metrics and scroll together. Preview text is temporary and is not sent to the server.

Settings are saved locally under `dsh-ssh-ops.terminal-display.v1`, synchronized to other same-origin windows, and reused after restart. They are not stored on the SSH server or shared between devices. If local storage is blocked or full, changes remain usable in the current window but may not survive a reload. The previous experimental highlight preference is read when no display-settings record exists.

## Rendering boundaries

Only default-style xterm cells receive semantic foreground decorations. Existing remote ANSI foreground/background colors and font attributes take priority. The matcher joins automatic wraps and maps Unicode text back to xterm cell widths; it does not modify terminal bytes, copy/search text, session logs, or agent output. Alternate-screen applications such as editors are not decorated.

Highlighting is heuristic, not a complete shell parser or a full WindTerm grammar. Custom prompts can be misclassified. IPv6 support covers common hexadecimal full/compressed forms, not every zone-ID or IPv4-mapped form. Quoted escape subrules, rainbow brackets, folding and links are outside this feature.

Work is coalesced over 60 ms and limited to 200 visible physical rows and 4096 decorations per scan. Logical reads stop at 16384 cells and wrapped-line backtracking at 256 rows; extreme lines can be partially highlighted. Unchanged rows reuse their markers/decorations. A decoration API failure disables highlighting for that terminal while keeping theme changes and terminal input/output available.

All user regex matching runs in one shared background worker, including preview matching. Queued jobs coalesce per terminal/preview. Matching has a 150 ms deadline after worker startup; a timed-out worker is terminated and that exact scheme is quarantined until edited. Other valid schemes can continue in a replacement worker. Input and theme changes remain available. If the host cannot create the worker, highlighting stays unavailable with a preview message; regex execution never falls back to the UI thread. The worker bundle is embedded in the client build and has no separate network route or runtime package dependency.

Palettes and classification rules are adapted from WindTerm 2.7.0; see [third-party notices](../THIRD_PARTY_NOTICES.md). The light preset's default text/ANSI colors have at least 4.5:1 contrast on white; user overrides and server truecolor values are unrestricted.

## Validation

```sh
node --test test/output-highlight.mjs test/terminal-display-settings.mjs test/regex-worker.mjs
npm test
npm run lint
npm run build
git diff --check
```

The feature tests use the real xterm buffer and real worker threads: ANSI/truecolor/styles, wrapped lines, wide-character wrap padding, Chinese/emoji/combining characters, carriage-return overwrites, alternate screen, resize/zoom, bounded scrollback, disposal, failure isolation, persistence, migration, per-theme schemes, regex/Unicode matching, zero-length matches, catastrophic-pattern deadlines, queue coalescing, recovery, entry switches, reset/export and cross-window ordering. All three feature files are included in `npm test` and the existing CI matrix.

For browser/DSH acceptance, check follow-DSH and both fixed themes with highlighting on/off, add/edit/delete regex tags, drag entries and use keyboard ordering, test timeout/recovery, restore/export the current theme, verify that the other theme survives reset, edit preview text with undo and scrolling, check Escape/outside-click closing and focus restoration, switch DSH's outer theme, search/select/copy terminal text, resize and split panes, switch tabs/reopen retained terminals, and reload or restart to check persistence. Validate narrow sidebars and both UI languages. Browser component checks do not replace an end-to-end run inside the DSH host.
