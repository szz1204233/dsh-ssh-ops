# Terminal display settings

Click the muted **brush button** on the right of the SSH server bar to open **Terminal appearance**. It configures every SSH terminal in the current browser origin, including split panes and retained terminals. A server connection is not required. The dialog preserves the current tab, traps keyboard focus, closes with Escape or an outside click, and restores focus to the button.

- **Theme:** follow DSH (default for new preferences), dark or light. Existing saved dark/light choices are preserved. Both presets define all 16 ANSI colors, cursor and selection colors. Remote truecolor values are preserved.
- **Semantic highlighting:** enabled by default. Colors common log keywords, addresses, dates, numbers, quoted strings, options, permissions, and commands/paths in recognized prompts. Disable it to use only server-provided styling and the selected terminal palette.
- **Highlight colors:** an initially collapsed section with 11 categories, stored separately for dark and light themes. Use a color picker or a complete `#RRGGBB` value; incomplete text resets on blur or a theme change. Restoring defaults only clears overrides for the selected theme. The preview uses the same matcher as the terminal; its sample text can be edited locally for testing.
- **Custom rules:** an initially collapsed editor for adding, editing, ordering, toggling and deleting rules. Each rule selects literal contains/whole-word matching, case sensitivity and a color category. Earlier custom rules win and custom rules take priority over built-in rules, including quoted strings. Built-in rules can be disabled independently. Rule changes take effect after Save; rules apply to both themes using each theme's category colors. Up to 32 rules of 128 characters each are stored. Control characters and blank text are rejected. Punctuation is matched literally; arbitrary regular expressions are not accepted.

Settings are saved locally under `dsh-ssh-ops.terminal-display.v1`, synchronized to other same-origin windows, and reused after restart. They are not stored on the SSH server or shared between devices. If local storage is blocked or full, changes remain usable in the current window but may not survive a reload. The previous experimental highlight preference is read when no display-settings record exists.

## Rendering boundaries

Only default-style xterm cells receive semantic foreground decorations. Existing remote ANSI foreground/background colors and font attributes take priority. The matcher joins automatic wraps and maps Unicode text back to xterm cell widths; it does not modify terminal bytes, copy/search text, session logs, or agent output. Alternate-screen applications such as editors are not decorated.

Highlighting is heuristic, not a complete shell parser or a full WindTerm grammar. Custom prompts can be misclassified. IPv6 support covers common hexadecimal full/compressed forms, not every zone-ID or IPv4-mapped form. Quoted escape subrules, rainbow brackets, folding and links are outside this feature.

Work is coalesced over 60 ms and limited to 200 visible physical rows and 4096 decorations per scan. Logical reads stop at 16384 cells and wrapped-line backtracking at 256 rows; extreme lines can be partially highlighted. Unchanged rows reuse their markers/decorations. A decoration API failure disables highlighting for that terminal while keeping theme changes and terminal input/output available.

Palettes and classification rules are adapted from WindTerm 2.7.0; see [third-party notices](../THIRD_PARTY_NOTICES.md). The light preset's default text/ANSI colors have at least 4.5:1 contrast on white; user overrides and server truecolor values are unrestricted.

## Validation

```sh
node --test test/output-highlight.mjs test/terminal-display-settings.mjs
npm test
npm run lint
npm run build
git diff --check
```

The feature tests run against the real xterm buffer: ANSI/truecolor/styles, wrapped lines, wide-character wrap padding, Chinese/emoji/combining characters, carriage-return overwrites, alternate screen, resize/zoom, bounded scrollback, disposal, failure isolation, persistence, migration, per-theme overrides, literal/Unicode matching, rule priority/CRUD and cross-window event ordering. Both feature files are included in `npm test` and the existing CI matrix.

For browser/DSH acceptance, check follow-DSH and both fixed themes with highlighting on/off, change and reset each theme's colors, add/edit/reorder/toggle/delete custom rules, edit preview text, check Escape/outside-click closing and focus restoration, switch DSH's outer theme, search/select/copy terminal text, resize and split panes, switch tabs/reopen retained terminals, and reload or restart to check persistence. Validate narrow sidebars and both UI languages. Browser component checks do not replace an end-to-end run inside the DSH host.
