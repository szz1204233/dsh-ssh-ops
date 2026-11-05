import { test } from "node:test";
import assert from "node:assert/strict";
import xterm from "@xterm/xterm";
import { createDisplaySettings, getDisplaySettings, setDisplaySettings, setDisplayColor, resetDisplayColors } from "../src/client/terminal-display/settings.js";
import { OutputHighlightAddon } from "../src/client/terminal-display/addon.js";
import { COLORS, LIGHT_COLORS } from "../src/client/terminal-display/rules.js";
import { WINDTERM_LIGHT_THEME } from "../src/client/terminal-display/theme.js";
const KEY = "dsh-ssh-ops.terminal-display.v1";
function fixture(entries = {}) {
  const values = new Map(Object.entries(entries)), listeners = new Set();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const eventTarget = { addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) };
  return { storage, eventTarget, listeners, dispatch: (value, key = KEY) => {
    if (value === null) storage.removeItem(KEY); else storage.setItem(KEY, value);
    for (const fn of listeners) fn({ key, newValue: value, storageArea: storage });
  } };
}
test("migrate the previous highlight preference and persist both settings together", () => {
  const f = fixture({ "dsh-ssh-ops.private-output-highlight.enabled": "false" });
  const store = createDisplaySettings(f);
  assert.deepEqual(store.getSnapshot(), { highlightEnabled: false, theme: "dark" });
  store.update({ theme: "light" });
  assert.deepEqual(createDisplaySettings(f).getSnapshot(), { highlightEnabled: false, theme: "light" });
  store.update({ highlightEnabled: true });
  assert.deepEqual(JSON.parse(f.storage.getItem(KEY)), { highlightEnabled: true, theme: "light" });
});
test("stable snapshots, multiple subscribers, other-window updates and clear", () => {
  const f = fixture(), store = createDisplaySettings(f);
  let updates = 0;
  const a = store.subscribe(() => updates++), b = store.subscribe(() => updates++);
  const first = store.getSnapshot();
  store.update({ theme: "dark" }); assert.equal(store.getSnapshot(), first);
  store.update({ theme: "light" }); assert.equal(updates, 2);
  f.dispatch(JSON.stringify({ highlightEnabled: false, theme: "dark" }));
  assert.deepEqual(store.getSnapshot(), { highlightEnabled: false, theme: "dark" });
  assert.equal(updates, 4);
  f.dispatch(null, null); assert.deepEqual(store.getSnapshot(), { highlightEnabled: true, theme: "dark" });
  a(); b(); assert.equal(f.listeners.size, 0);
});
test("invalid stored settings degrade safely and blocked storage stays usable", () => {
  for (const value of ["{broken", 'null', '{"theme":"unknown","highlightEnabled":true}']) {
    assert.deepEqual(createDisplaySettings(fixture({ [KEY]: value })).getSnapshot(), { highlightEnabled: true, theme: "dark" });
  }
  const store = createDisplaySettings({ storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }, eventTarget: {} });
  const stop = store.subscribe(() => {});
  store.update({ theme: "light", highlightEnabled: false });
  assert.deepEqual(store.getSnapshot(), { highlightEnabled: false, theme: "light" }); stop();
});

test("resubscribing observes storage deletion and keeps unsaved changes after quota errors", () => {
  const f = fixture({ [KEY]: JSON.stringify({ theme: "light", highlightEnabled: false }) });
  const store = createDisplaySettings(f);
  store.subscribe(() => {})();
  f.storage.removeItem(KEY);
  const stop = store.subscribe(() => {});
  assert.deepEqual(store.getSnapshot(), { theme: "dark", highlightEnabled: true });
  stop();

  f.storage.setItem(KEY, JSON.stringify({ theme: "dark", highlightEnabled: true }));
  const blocked = createDisplaySettings({ ...f, storage: { ...f.storage, setItem() { throw Error("quota"); } } });
  blocked.update({ theme: "light" });
  const off = blocked.subscribe(() => {});
  assert.equal(blocked.getSnapshot().theme, "light");
  off();
});

test("updates merge the latest other-window settings before queued storage events arrive", () => {
  const f = fixture(), store = createDisplaySettings(f);
  const stop = store.subscribe(() => {});
  f.storage.setItem(KEY, JSON.stringify({ theme: "light", highlightEnabled: true, colors: { light: { error: "#123456" } } }));
  store.update({ highlightEnabled: false });
  assert.deepEqual(store.getSnapshot(), { theme: "light", highlightEnabled: false, colors: { light: { error: "#123456" } } });
  // A delayed event contains an older value; the on-disk value wins.
  for (const listener of f.listeners) listener({ key: KEY, newValue: null, storageArea: f.storage });
  assert.equal(store.getSnapshot().highlightEnabled, false);
  stop();
});
function contrast(hex, background) {
  const luminance = (color) => {
    const c = color.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const a = luminance(hex), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
test("light semantic and ANSI palettes maintain readable contrast on white", () => {
  const entries = { ...LIGHT_COLORS, ...WINDTERM_LIGHT_THEME };
  for (const [name, color] of Object.entries(entries)) {
    if (["background", "cursorAccent", "selectionBackground"].includes(name)) continue;
    assert.ok(contrast(color, "#ffffff") >= 4.5, `${name}: ${color}`);
  }
});
test("theme and highlighting apply to all live terminals, including while disabled", async () => {
  const original = getDisplaySettings();
  setDisplaySettings({ theme: "dark", highlightEnabled: true });
  const terminals = [new xterm.Terminal({ cols: 40, rows: 3, allowProposedApi: true }), new xterm.Terminal({ cols: 40, rows: 3, allowProposedApi: true })];
  const addons = terminals.map((term) => { const addon = new OutputHighlightAddon(); term.loadAddon(addon); return addon; });
  try {
    for (const term of terminals) await new Promise((resolve) => term.write('ERROR 42 SUCCESS', resolve));
    for (const addon of addons) addon.scan();
    const before = addons.map((addon) => addon.rows[0].signature);
    assert.ok(before.every((signature) => signature.includes(COLORS.error)));
    setDisplaySettings({ theme: "light" });
    for (let i = 0; i < terminals.length; i++) {
      assert.equal(terminals[i].options.theme.background, "#ffffff");
      addons[i].scan(); assert.ok(addons[i].rows[0].signature.includes(LIGHT_COLORS.error));
    }
    setDisplaySettings({ highlightEnabled: false });
    assert.ok(addons.every((addon) => addon.rows.length === 0));
    setDisplaySettings({ theme: "dark" });
    assert.ok(terminals.every((term) => term.options.theme.background === "#1c1c1c"));
    const added = new xterm.Terminal({ allowProposedApi: true }); added.loadAddon(new OutputHighlightAddon());
    assert.equal(added.options.theme.background, "#1c1c1c"); added.dispose();
  } finally { terminals.forEach((term) => term.dispose()); setDisplaySettings(original); }
});

test("custom colors are validated and survive recreation independently for each theme", () => {
  const f = fixture(), store = createDisplaySettings(f);
  store.update({ colors: { dark: { error: "#FF8800", unknown: "#ffffff", info: "red" }, light: { error: "#0055aa", number: "#xyz123" } } });
  const expected = { dark: { error: "#ff8800" }, light: { error: "#0055aa" } };
  assert.deepEqual(store.getSnapshot().colors, expected);
  assert.deepEqual(createDisplaySettings(f).getSnapshot().colors, expected);
  store.update({ colors: { ...store.getSnapshot().colors, dark: {} } });
  assert.deepEqual(store.getSnapshot().colors, { light: { error: "#0055aa" } });
  store.update({ colors: {} }); assert.equal(store.getSnapshot().colors, undefined);
});

test("custom color updates propagate across windows even when base settings are unchanged", () => {
  const f = fixture(), store = createDisplaySettings(f);
  let updates = 0;
  const stop = store.subscribe(() => updates++);
  f.dispatch(JSON.stringify({ theme: "dark", highlightEnabled: true, colors: { dark: { error: "#123456" } } }));
  assert.equal(updates, 1);
  assert.equal(store.getSnapshot().colors.dark.error, "#123456");
  stop();
});

test("all live terminals recolor immediately, reset per theme, and reject invalid user colors", async () => {
  const original = getDisplaySettings();
  setDisplaySettings({ theme: "dark", highlightEnabled: true, colors: {} });
  const terminals = Array.from({ length: 2 }, () => new xterm.Terminal({ cols: 30, rows: 3, allowProposedApi: true }));
  const addons = terminals.map((term) => { const addon = new OutputHighlightAddon(); term.loadAddon(addon); return addon; });
  try {
    for (const term of terminals) await new Promise((resolve) => term.write('ERROR', resolve));
    setDisplayColor("dark", "error", "#FF8800");
    for (const addon of addons) { addon.scan(); assert.ok(addon.rows[0].signature.includes("#ff8800")); }
    const snapshot = getDisplaySettings();
    setDisplayColor("dark", "error", "red"); setDisplayColor("unknown", "error", "#123456");
    assert.equal(getDisplaySettings(), snapshot);
    setDisplayColor("light", "error", "#0055aa"); resetDisplayColors("dark");
    assert.equal(getDisplaySettings().colors.light.error, "#0055aa");
    for (const addon of addons) { addon.scan(); assert.ok(addon.rows[0].signature.includes(COLORS.error)); }
    setDisplaySettings({ theme: "light" });
    for (const addon of addons) { addon.scan(); assert.ok(addon.rows[0].signature.includes("#0055aa")); }
  } finally { terminals.forEach((term) => term.dispose()); setDisplaySettings({ ...original, colors: original.colors ?? {} }); }
});
