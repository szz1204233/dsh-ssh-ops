import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDisplaySettings } from "../src/client/terminal-display/settings.js";
import { defaultScheme, exportScheme, getScheme } from "../src/client/terminal-display/scheme.js";
import { builtinTheme, allThemes, themeOptions, selectedThemeId, saveThemePatch, selectThemePatch, deleteThemePatch, exportTheme, exportThemeLibrary,
  parseThemeImport, parseLibraryBackup, parseImportFile, importThemePatch, importConflicts, restoreLibraryPatch, MAX_IMPORTED_THEMES } from "../src/client/terminal-display/theme-library.js";
const KEY = "dsh-ssh-ops.terminal-display.v1";
const release = JSON.parse(readFileSync(new URL("./fixtures/terminal-appearance/release-v0.4.8.json", import.meta.url)));
function fixture(initial) {
  const values = new Map(initial ? [[KEY, JSON.stringify(initial)]] : []), listeners = new Set();
  const options = { storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    eventTarget: { addEventListener: (_type, fn) => listeners.add(fn), removeEventListener: (_type, fn) => listeners.delete(fn) } };
  return { values, options, store: createDisplaySettings(options), dispatch() { for (const fn of listeners) fn({ key: KEY, storageArea: options.storage }); } };
}
const record = (name, background = "#123456", theme = "dark") => ({ ...builtinTheme(theme), name, background });
function save(store, item, options) {
  let result; store.update(state => { result = saveThemePatch(state, item, options); return result.patch; }, { requirePersist: true }); return result.record;
}
const select = (store, mode, id) => store.update(state => selectThemePatch(state, mode, id), { requirePersist: true });
const remove = (store, id, revision) => store.update(state => deleteThemePatch(state, null, id, revision), { requirePersist: true });
const importedFile = (name = "A", bg = "#123456") => exportScheme({ backgrounds: { dark: bg } }, "dark", name);
const importOne = (store, text, name, id, options) => store.update(state => importThemePatch(state, text, name, id, options), { requirePersist: true });

test("fresh profiles have no migration writes; custom themes occur in both selectors", () => {
  const f = fixture(); assert.equal(f.values.size, 0);
  assert.equal(selectedThemeId(f.store.getSnapshot(), "dark"), "builtin:dark");
  const a = save(f.store, record("A"));
  for (const mode of ["dark", "light"]) assert.ok(themeOptions(f.store.getSnapshot(), mode).some(item => item.id === a.id));
  select(f.store, "dark", a.id); select(f.store, "light", a.id);
  assert.equal(selectedThemeId(f.store.getSnapshot(), "light"), a.id);
  assert.equal(f.store.getSnapshot().backgrounds.light, "#123456");
  assert.equal(f.store.getSnapshot().theme, "system");
  assert.equal(f.store.getSnapshot().highlightEnabled, false);
});

test("v0.4.8 schemes survive default selection and selection back, without inferred overwrites", () => {
  const initial = { theme: "dark", highlightEnabled: true, schemes: { dark: release.dark.entries, light: release.light.entries }, backgrounds: { dark: "#121212", light: "#eeeeee" } };
  const f = fixture(initial), stored = f.values.get(KEY);
  allThemes(f.store.getSnapshot()); assert.equal(f.values.get(KEY), stored);
  select(f.store, "dark", "builtin:dark"); select(f.store, "dark", "legacy:dark");
  assert.deepEqual(getScheme(f.store.getSnapshot(), "dark"), initial.schemes.dark);
  assert.equal(f.store.getSnapshot().backgrounds.dark, "#121212");
  assert.deepEqual(getScheme(f.store.getSnapshot(), "light"), initial.schemes.light);
});

test("saving A and B and deleting B never overwrites A edits", () => {
  const f = fixture(), a = save(f.store, record("A")), b = save(f.store, record("B", "#222222"));
  const a2 = save(f.store, { ...a, background: "#aaaaaa" }, { id: a.id, expectedRevision: a.revision });
  save(f.store, { ...b, background: "#bbbbbb" }, { id: b.id, expectedRevision: b.revision });
  select(f.store, "dark", b.id); remove(f.store, b.id);
  assert.deepEqual(allThemes(f.store.getSnapshot()).find(item => item.id === a.id), a2);
  assert.equal(selectedThemeId(f.store.getSnapshot(), "dark"), "builtin:dark");
  select(f.store, "dark", a.id); assert.equal(f.store.getSnapshot().backgrounds.dark, "#aaaaaa");
});

test("save-as and rename retain stable identity and update both active assignments", () => {
  const f = fixture(), a = save(f.store, record("A"));
  select(f.store, "dark", a.id); select(f.store, "light", a.id);
  const clone = save(f.store, a);
  assert.notEqual(clone.id, a.id); assert.equal(clone.name, "A (2)");
  const updated = save(f.store, { ...a, name: "Renamed", background: "#abcdef" }, { id: a.id, expectedRevision: a.revision });
  assert.equal(updated.id, a.id);
  assert.deepEqual(f.store.getSnapshot().backgrounds, { dark: "#abcdef", light: "#abcdef" });
  assert.equal(allThemes(f.store.getSnapshot()).find(item => item.id === clone.id).background, "#123456");
  assert.throws(() => save(f.store, { ...updated, name: clone.name }, { id: a.id }), /theme-name-conflict/);
  assert.throws(() => save(f.store, builtinTheme("dark"), { id: "builtin:dark" }), /builtin-read-only/);
});

test("single-theme import previews conflicts and supports explicit update or copy", () => {
  const f = fixture(), text = importedFile();
  importOne(f.store, text, "A", "import:a");
  assert.equal(selectedThemeId(f.store.getSnapshot(), "dark"), "builtin:dark");
  const a = allThemes(f.store.getSnapshot())[0];
  const exported = exportTheme(a), parsed = parseThemeImport(exported);
  assert.equal(parsed.id, a.id); assert.ok(importConflicts(f.store.getSnapshot(), parsed).some(item => item.id === a.id));
  importOne(f.store, exported, "A", "import:copy");
  assert.equal(allThemes(f.store.getSnapshot()).length, 2);
  importOne(f.store, importedFile("A", "#aaaaaa"), "A", "unused", { targetId: a.id, expectedRevision: a.revision });
  assert.equal(allThemes(f.store.getSnapshot()).find(item => item.id === a.id).background, "#aaaaaa");
  assert.equal(allThemes(f.store.getSnapshot()).length, 2);
  const before = f.store.getSnapshot(); assert.throws(() => importOne(f.store, "bad", "A", "import:bad"), /invalid-backup/);
  assert.equal(f.store.getSnapshot(), before);
  assert.equal(parseThemeImport(JSON.stringify(release.dark), "old.json").name, "old");
});

test("whole-library backup restores all themes, both selections and display settings", () => {
  const source = fixture({ theme: "light", highlightEnabled: true }), a = save(source.store, record("A")), b = save(source.store, record("B", "#eeeeee", "light"));
  select(source.store, "dark", a.id); select(source.store, "light", b.id);
  const text = exportThemeLibrary(source.store.getSnapshot());
  assert.equal(parseImportFile(text).kind, "library");
  const target = fixture(); save(target.store, record("Old"));
  target.store.update(state => restoreLibraryPatch(state, text, "replace"), { requirePersist: true });
  const reloaded = createDisplaySettings(target.options).getSnapshot();
  assert.equal(reloaded.themeLibrary.length, 2);
  assert.equal(selectedThemeId(reloaded, "dark"), a.id); assert.equal(selectedThemeId(reloaded, "light"), b.id);
  assert.equal(reloaded.theme, "light"); assert.equal(reloaded.highlightEnabled, true);
  assert.deepEqual(reloaded.backgrounds, source.store.getSnapshot().backgrounds);
  assert.deepEqual(reloaded.schemes, source.store.getSnapshot().schemes);
});

test("merge is repeatable and retains selections and existing conflicting content", () => {
  const a = fixture(), original = save(a.store, record("A")); select(a.store, "dark", original.id);
  const text = exportThemeLibrary(a.store.getSnapshot());
  save(a.store, { ...original, background: "#aaaaaa" }, { id: original.id });
  a.store.update(state => restoreLibraryPatch(state, text, "merge"));
  const after = a.store.getSnapshot();
  assert.equal(after.themeLibrary.length, 2);
  assert.equal(after.backgrounds.dark, "#aaaaaa"); assert.equal(selectedThemeId(after, "dark"), original.id);
  a.store.update(state => restoreLibraryPatch(state, text, "merge"));
  assert.equal(a.store.getSnapshot().themeLibrary.length, 2);
});

test("library backup validation rejects unsupported versions and dangling references atomically", () => {
  const f = fixture(), raw = JSON.parse(exportThemeLibrary(f.store.getSnapshot()));
  for (const invalid of [{ ...raw, version: 999 }, { ...raw, selectedThemes: { dark: "user:missing", light: "builtin:light" } }, { ...raw, themes: [{ id: "builtin:dark" }] }]) {
    const before = f.store.getSnapshot();
    assert.throws(() => f.store.update(state => restoreLibraryPatch(state, JSON.stringify(invalid), "replace")));
    assert.equal(f.store.getSnapshot(), before);
  }
  assert.ok(parseLibraryBackup(JSON.stringify(raw)));
});

test("storage errors are observable, strict saves are atomic, and retry recovers", () => {
  let blocked = true; const values = new Map();
  const options = { storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (blocked) throw Error("quota"); values.set(key, value); } }, eventTarget: {} };
  const store = createDisplaySettings(options), before = store.getSnapshot();
  assert.throws(() => save(store, record("A")), /settings-not-saved/);
  assert.equal(store.getSnapshot(), before); assert.equal(store.getPersistenceSnapshot().saved, false);
  blocked = false; save(store, record("A"));
  assert.equal(store.getPersistenceSnapshot().saved, true);
  assert.equal(createDisplaySettings(options).getSnapshot().themeLibrary.length, 1);
});

test("latest-window edits merge and revision conflicts preserve newer content", () => {
  const f = fixture(), second = createDisplaySettings(f.options), a = save(f.store, record("A"));
  const off = second.subscribe(() => {});
  const stale = allThemes(second.getSnapshot())[0];
  save(f.store, { ...a, background: "#aaaaaa" }, { id: a.id, expectedRevision: a.revision });
  assert.throws(() => save(second, { ...stale, background: "#bbbbbb" }, { id: a.id, expectedRevision: stale.revision }), /theme-changed/);
  save(second, record("B")); f.dispatch();
  assert.equal(createDisplaySettings(f.options).getSnapshot().themeLibrary.length, 2);
  assert.equal(createDisplaySettings(f.options).getSnapshot().themeLibrary.find(item => item.id === a.id).background, "#aaaaaa"); off();
});

test("unused theme deletion does not activate it and deleting shared applied theme uses safe defaults", () => {
  const f = fixture(), a = save(f.store, record("A")), b = save(f.store, record("B")); select(f.store, "dark", a.id);
  remove(f.store, b.id); assert.equal(selectedThemeId(f.store.getSnapshot(), "dark"), a.id);
  select(f.store, "light", a.id); remove(f.store, a.id);
  assert.equal(selectedThemeId(f.store.getSnapshot(), "dark"), "builtin:dark");
  assert.equal(selectedThemeId(f.store.getSnapshot(), "light"), "builtin:light");
  assert.deepEqual(getScheme(f.store.getSnapshot(), "dark"), defaultScheme("dark"));
});

test("capacity rejection cannot partially overwrite the library", () => {
  const f = fixture(); for (let i = 0; i < MAX_IMPORTED_THEMES; i++) save(f.store, record("T" + i));
  const before = f.store.getSnapshot(); assert.throws(() => save(f.store, record("Extra")), /theme-library-full/); assert.equal(f.store.getSnapshot(), before);
});

test("import update prefers stable identity over a same-content theme", () => {
  const f = fixture(), a = save(f.store, record("A")), b = save(f.store, record("B"));
  assert.notEqual(a.id, b.id);
  assert.equal(importConflicts(f.store.getSnapshot(), parseThemeImport(exportTheme(b)))[0].id, b.id);
  const backup = JSON.parse(exportThemeLibrary(f.store.getSnapshot()));
  backup.selectedThemes.dark = "builtin:light";
  assert.throws(() => parseLibraryBackup(JSON.stringify(backup)), /invalid-library-backup/);
});

test("full restore invalidates editors opened before that restore", () => {
  const f = fixture(), a = save(f.store, record("A"));
  const text = exportThemeLibrary(f.store.getSnapshot());
  f.store.update(state => restoreLibraryPatch(state, text, "replace"), { requirePersist: true });
  assert.throws(() => save(f.store, { ...a, background: "#999999" }, { id: a.id, expectedRevision: a.revision }), /theme-changed/);
});
