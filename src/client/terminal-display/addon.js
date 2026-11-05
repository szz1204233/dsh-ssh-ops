import { matchLogicalLine, readLogicalLine } from "./matcher.js";
import { terminalTheme, resolveDisplayTheme, subscribeHostTheme } from "./theme.js";
import { colorsForTheme, HIGHLIGHT_RULES } from "./rules.js";
import { compileCustomRules } from "./custom-rules.js";
import { getDisplaySettings, subscribeDisplaySettings } from "./settings.js";
import { applyTerminalTheme } from "../terminal-theme.js";

const MAX_DECORATIONS = 4096;
export class OutputHighlightAddon {
  activate(term) {
    this.term = term;
    this.resources = [];
    this.rows = [];
    this.disposed = false;
    this.failed = false;
    this.originalTheme = term.options.theme;
    try {
      this.resources.push({ dispose: subscribeHostTheme(() => {
        if (getDisplaySettings().theme === "system") this.syncDisplay();
      }) });
      this.applyTheme();
      this.resources.push(term.onWriteParsed(() => this.request()));
      this.resources.push(term.onScroll(() => this.request()));
      this.resources.push(term.onResize(() => { this.clear(); this.request(); }));
      this.resources.push(term.buffer.onBufferChange(() => { this.clear(); this.request(); }));
      this.resources.push({ dispose: subscribeDisplaySettings(() => this.syncDisplay()) });
      this.request();
    } catch { this.fail(); }
  }
  syncDisplay() {
    try {
      this.applyTheme();
      clearTimeout(this.timer);
      this.timer = undefined;
      this.clear();
      this.request();
    } catch { this.fail(); }
  }
  applyTheme() {
    // A decoration failure must not disable the user's theme preference.
    if (this.disposed) return;
    const theme = this.term.options.theme;
    if (Object.entries(terminalTheme(getDisplaySettings().theme)).some(([key, value]) => theme?.[key] !== value)) {
      applyTerminalTheme(this.term, { ...terminalTheme(getDisplaySettings().theme) });
    }
  }
  request() {
    if (this.disposed || this.failed || !getDisplaySettings().highlightEnabled || this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      try { this.scan(); } catch { this.fail(); }
    }, 60);
  }
  disposeRow(row) {
    for (const decoration of row.decorations) decoration.dispose();
    row.marker.dispose();
  }
  clear() {
    for (const row of this.rows ?? []) this.disposeRow(row);
    this.rows = [];
  }
  scan() {
    if (this.disposed || this.failed) return;
    const term = this.term, buffer = term.buffer.active;
    const settings = getDisplaySettings();
    if (!settings.highlightEnabled || buffer.type !== "normal") { this.clear(); return; }
    const theme = resolveDisplayTheme(settings.theme);
    const colors = colorsForTheme(theme, settings.colors?.[theme]);
    // Compile only when rules change, not for each row or write event.
    if (this.customRules !== settings.customRules || this.builtinEnabled !== settings.builtinEnabled) {
      this.customRules = settings.customRules;
      this.builtinEnabled = settings.builtinEnabled;
      this.rules = [...compileCustomRules(settings.customRules), ...(settings.builtinEnabled === false ? [] : HIGHLIGHT_RULES)];
    }
    this.rules ??= HIGHLIGHT_RULES;
    const start = buffer.viewportY, end = Math.min(buffer.length, start + Math.min(term.rows, 200));
    const byRow = new Map();
    let y = start, backtrack = 0, count = 0;
    while (y > 0 && buffer.getLine(y)?.isWrapped && backtrack++ < 256) y--;
    while (y < end && count < MAX_DECORATIONS) {
      const logical = readLogicalLine(buffer, y);
      for (const run of matchLogicalLine(logical, start, end, MAX_DECORATIONS - count, colors, this.rules)) {
        if (!byRow.has(run.y)) byRow.set(run.y, []);
        byRow.get(run.y).push(run);
        count++;
      }
      y = Math.max(y + 1, logical.next);
    }
    // Reuse unchanged row decorations: high-throughput output should not
    // churn thousands of markers and DOM nodes for already-visible history.
    for (const row of [...this.rows]) {
      if (row.marker.isDisposed) { this.disposeRow(row); this.rows.splice(this.rows.indexOf(row), 1); }
    }
    const previous = new Map(this.rows.map((row) => [row.marker.line, row]));
    for (const [line, runs] of byRow) {
      // Markers track row movement when scrollback trims. Absolute y would
      // invalidate otherwise identical decorations on every trimmed line.
      const signature = JSON.stringify(runs.map(({ x, width, foregroundColor }) => ({ x, width, foregroundColor })));
      const old = previous.get(line);
      if (old && !old.marker.isDisposed && old.signature === signature) { previous.delete(line); continue; }
      if (old) { this.disposeRow(old); this.rows.splice(this.rows.indexOf(old), 1); previous.delete(line); }
      const marker = term.registerMarker(line - buffer.baseY - buffer.cursorY);
      if (!marker) continue;
      const row = { marker, signature, decorations: [] };
      this.rows.push(row); // Own the marker before any fallible API call.
      for (const { x, width, foregroundColor } of runs) {
        const decoration = term.registerDecoration({ marker, x, width, foregroundColor, layer: "bottom" });
        if (decoration) row.decorations.push(decoration);
      }
    }
    for (const row of previous.values()) { this.disposeRow(row); this.rows.splice(this.rows.indexOf(row), 1); }
  }
  fail() {
    if (this.failed) return;
    this.failed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.clear();
    console.warn("[dsh-ssh-ops] Semantic highlighting disabled for this terminal");
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.clear();
    for (const resource of this.resources ?? []) resource.dispose();
    try { this.term.options.theme = this.originalTheme; } catch {}
  }
}
