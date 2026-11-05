# Terminal display settings

Click the muted **palette button** on the right of the SSH server bar to open **Terminal appearance**. It configures every SSH terminal in the current browser origin, including split panes and retained terminals. A server connection is not required. The dialog preserves the current tab, traps keyboard focus, closes with Escape or an outside click, and restores focus to the button.

- **Theme:** follow DSH (default for new preferences), dark or light. Existing saved dark/light choices are preserved. Both presets define all 16 ANSI colors, cursor and selection colors. Remote truecolor values are preserved.
- **Semantic highlighting:** off by default. When off, every scheme, backup and preview control below the switch is hidden, without discarding saved configuration. Existing explicit opt-in preferences are preserved on upgrade.
- **Color scheme:** an expanded list combining colors and matching rules, stored independently for dark/light themes. The 11 built-in entries each have an enable switch, color picker/HEX input and editable multiline match text. Each line is one literal text; contains/whole-word modes only match that text. Automatic mode retains built-in detection and accepts extra text. Earlier text entries have priority over automatic detection. Unmodified built-in entries preserve the original semantic classifications. Case sensitivity applies to entered text. Additional named entries can be added, ordered and deleted; up to 43 total entries and 2048 characters per entry are stored.
- **Reset and backup:** adjacent buttons restore the current theme's entire default scheme (colors, text, modes, switches and ordering) or download its full scheme as JSON. The other theme is preserved. Backup does not upload data. Legacy colors/custom rules are migrated when a theme has no explicit scheme.
- **Editable preview:** type directly into the colored preview box. A native textarea handles caret, selection, undo and text entry over an inert highlighted mirror; there is no separate editor. Both layers use the same font metrics and scroll together. Preview text is temporary and is not sent to the server.

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

The feature tests run against the real xterm buffer: ANSI/truecolor/styles, wrapped lines, wide-character wrap padding, Chinese/emoji/combining characters, carriage-return overwrites, alternate screen, resize/zoom, bounded scrollback, disposal, failure isolation, persistence, migration, per-theme schemes, literal/Unicode matching, entry switches, reset/export and cross-window event ordering. Both feature files are included in `npm test` and the existing CI matrix.

For browser/DSH acceptance, check follow-DSH and both fixed themes with highlighting on/off, change scheme text/colors and entry switches, restore/export the current theme, verify that the other theme survives reset, edit preview text with undo and scrolling, check Escape/outside-click closing and focus restoration, switch DSH's outer theme, search/select/copy terminal text, resize and split panes, switch tabs/reopen retained terminals, and reload or restart to check persistence. Validate narrow sidebars and both UI languages. Browser component checks do not replace an end-to-end run inside the DSH host.
