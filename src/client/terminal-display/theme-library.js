import { defaultScheme, getScheme, normalizeScheme, parseSchemeBackup, MAX_SCHEME_ENTRIES } from "./scheme.js";
import { DEFAULT_BACKGROUNDS } from "./theme.js";

export const MAX_IMPORTED_THEMES = 64;
export const LIBRARY_FORMAT = "dsh-ssh-ops.theme-library";
export const MAX_LIBRARY_BYTES = 8 * 1024 * 1024;
const MODES = ["dark", "light"];
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^(?:(?:user|import):[a-z0-9-]{1,80}|(?:legacy|draft):(dark|light))$/i;
export const newThemeId = () => "user:" + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
export function themeName(value, fallback = "") {
  return typeof value === "string" && value.trim() && value.trim().length <= 80 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : fallback;
}
export function builtinTheme(mode) {
  return { id: `builtin:${mode}`, name: mode === "dark" ? "DSH Default Dark" : "DSH Default Light", theme: mode,
    background: DEFAULT_BACKGROUNDS[mode], entries: defaultScheme(mode), revision: 0 };
}
function normalizeRecord(raw) {
  if (!raw || typeof raw.id !== "string" || !ID.test(raw.id) || !MODES.includes(raw.theme) || !themeName(raw.name)
    || typeof raw.background !== "string" || !HEX.test(raw.background) || !Array.isArray(raw.entries) || raw.entries.length > MAX_SCHEME_ENTRIES) return;
  const entries = normalizeScheme(raw.entries);
  if (!entries || entries.length !== raw.entries.length) return;
  return Object.freeze({ id: raw.id, name: themeName(raw.name), theme: raw.theme, background: raw.background.toLowerCase(), entries,
    ...(typeof raw.originId === "string" && ID.test(raw.originId) ? { originId: raw.originId } : {}),
    revision: Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0 });
}
export function normalizeThemeLibrary(value) {
  const result = [], ids = new Set();
  for (const raw of Array.isArray(value) ? value.slice(0, MAX_IMPORTED_THEMES + 4) : []) {
    const item = normalizeRecord(raw);
    if (!item || ids.has(item.id)) continue;
    ids.add(item.id); result.push(item);
  }
  return Object.freeze(result);
}
export function findTheme(state, mode, id) {
  if (id === "builtin:dark") return mode === "dark" ? builtinTheme("dark") : undefined;
  if (id === "builtin:light") return mode === "light" ? builtinTheme("light") : undefined;
  return state.themeLibrary?.find(item => item.id === id);
}
export function currentAppearance(state, mode) {
  const background = state.backgrounds?.[mode];
  return { background: typeof background === "string" && HEX.test(background) ? background.toLowerCase() : DEFAULT_BACKGROUNDS[mode], entries: getScheme(state, mode) };
}
function canonical(entries) { return getScheme({ schemes: { dark: entries } }, "dark"); }
export function sameAppearance(a, b) {
  return a.background === b.background && JSON.stringify(canonical(a.entries)) === JSON.stringify(canonical(b.entries));
}
function customized(state, mode) {
  return state.schemes?.[mode] !== undefined || state.backgrounds?.[mode] !== undefined || Object.keys(state.colors?.[mode] ?? {}).length > 0
    || state.customRules?.length > 0 || state.builtinEnabled === false;
}
export function selectedThemeId(state, mode) {
  const current = currentAppearance(state, mode), requested = findTheme(state, mode, state.selectedThemes?.[mode]);
  if (requested && sameAppearance(current, requested)) return requested.id;
  const legacy = findTheme(state, mode, `legacy:${mode}`);
  if (legacy && sameAppearance(current, legacy)) return legacy.id;
  if (!customized(state, mode) && sameAppearance(current, builtinTheme(mode))) return `builtin:${mode}`;
  return legacy ? `current:${mode}` : `legacy:${mode}`;
}
function ephemeral(state, mode) {
  return { id: selectedThemeId(state, mode), name: mode === "dark" ? "Previous custom dark" : "Previous custom light", theme: mode,
    ...currentAppearance(state, mode), revision: 0 };
}
export function allThemes(state) {
  const list = [...(state.themeLibrary ?? [])];
  for (const mode of MODES) {
    const id = selectedThemeId(state, mode);
    if (!findTheme({ themeLibrary: list }, mode, id)) list.push(ephemeral(state, mode));
  }
  return list;
}
export function themeOptions(state, mode) {
  return [builtinTheme(mode), ...allThemes(state)];
}
function uniqueName(list, name, exceptId) {
  const base = themeName(name);
  if (!base) throw Error("invalid-theme-name");
  let result = base, suffix = 2;
  while (list.some(item => item.id !== exceptId && item.name.toLocaleLowerCase() === result.toLocaleLowerCase())) result = `${base.slice(0, 70)} (${suffix++})`;
  return result;
}
// Capture released settings lazily. No UI read writes a migration or guesses
// which user entries were intentional edits. There are no shared draft slots.
function capture(state) {
  const list = [...(state.themeLibrary ?? [])], selectedThemes = {}, aliases = {};
  for (const mode of MODES) {
    let id = selectedThemeId(state, mode);
    if (!findTheme({ themeLibrary: list }, mode, id)) {
      const item = ephemeral(state, mode);
      if (id.startsWith("current:")) { const previous = id; id = newThemeId(); aliases[previous] = id; }
      list.push({ ...item, id, name: uniqueName(list, item.name) });
    }
    selectedThemes[mode] = id;
  }
  return { themeLibrary: list, selectedThemes, aliases };
}
function capacity(list) {
  if (list.filter(item => !item.id.startsWith("legacy:")).length > MAX_IMPORTED_THEMES || list.length > MAX_IMPORTED_THEMES + 4) throw Error("theme-library-full");
}
function materialize(state, library, assignments, modes) {
  const schemes = { ...state.schemes }, backgrounds = { ...state.backgrounds };
  if (state.builtinEnabled === false) for (const mode of MODES) schemes[mode] = getScheme(state, mode);
  for (const mode of modes) {
    const record = findTheme({ themeLibrary: library }, mode, assignments[mode]);
    if (!record) throw Error("invalid-theme-reference");
    schemes[mode] = record.entries; backgrounds[mode] = record.background;
  }
  return { themeLibrary: library, selectedThemes: assignments, schemes, backgrounds, builtinEnabled: true };
}
export function selectThemePatch(state, mode, id) {
  if (!MODES.includes(mode)) throw Error("invalid-theme-mode");
  const captured = capture(state), target = captured.aliases[id] ?? id;
  if (!findTheme(captured, mode, target)) throw Error("theme-not-found");
  return materialize(state, captured.themeLibrary, { ...captured.selectedThemes, [mode]: target }, [mode]);
}
export function saveThemePatch(state, record, { id, expectedRevision, newId } = {}) {
  if (id?.startsWith("builtin:")) throw Error("builtin-read-only");
  const captured = capture(state), key = captured.aliases[id] ?? id ?? newId ?? newThemeId();
  const existing = captured.themeLibrary.find(item => item.id === key);
  if (!id && existing) throw Error("duplicate-theme-id");
  if (id && !existing) throw Error("theme-not-found");
  if (existing && expectedRevision !== undefined && existing.revision !== expectedRevision) throw Error("theme-changed");
  const name = themeName(record.name);
  if (!name) throw Error("invalid-theme-name");
  if (existing && captured.themeLibrary.some(item => item.id !== key && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error("theme-name-conflict");
  const saved = normalizeRecord({ ...record, ...(!existing ? { originId: undefined } : {}), id: key, name: existing ? name : uniqueName(captured.themeLibrary, name), revision: (existing?.revision ?? -1) + 1 });
  if (!saved) throw Error("invalid-theme");
  const list = existing ? captured.themeLibrary.map(item => item.id === key ? saved : item) : [...captured.themeLibrary, saved];
  capacity(list);
  const affected = MODES.filter(mode => captured.selectedThemes[mode] === key);
  return { id: key, record: saved, patch: affected.length ? materialize(state, list, captured.selectedThemes, affected)
    : { themeLibrary: list, selectedThemes: captured.selectedThemes } };
}
export function deleteThemePatch(state, _mode, id, expectedRevision) {
  if (id?.startsWith("builtin:")) throw Error("builtin-read-only");
  const captured = capture(state), key = captured.aliases[id] ?? id;
  const record = captured.themeLibrary.find(item => item.id === key);
  if (!record) throw Error("theme-not-found");
  if (expectedRevision !== undefined && record.revision !== expectedRevision) throw Error("theme-changed");
  const assignments = { ...captured.selectedThemes }, affected = MODES.filter(mode => assignments[mode] === key);
  for (const mode of affected) assignments[mode] = `builtin:${mode}`;
  const list = captured.themeLibrary.filter(item => item.id !== key);
  return affected.length ? materialize(state, list, assignments, affected) : { themeLibrary: list, selectedThemes: assignments };
}
export function exportTheme(record) {
  const valid = normalizeRecord({ ...record, id: typeof record.id === "string" && ID.test(record.id) ? record.id : "user:export" });
  if (!valid) throw Error("invalid-theme");
  return JSON.stringify({ format: "dsh-ssh-ops.color-scheme", version: 2, ...(record.id && !record.id.startsWith("builtin:") && !record.id.startsWith("current:") ? { id: record.id } : {}),
    name: valid.name, theme: valid.theme, background: valid.background, entries: valid.entries }, null, 2);
}
export function parseThemeImport(text, filename = "") {
  const restored = parseSchemeBackup(text), raw = JSON.parse(text);
  return { ...restored, name: themeName(raw.name, themeName(filename.replace(/\.json$/i, ""), "Custom theme")),
    ...(typeof raw.id === "string" && ID.test(raw.id) ? { id: raw.id } : {}), revision: 0 };
}
export function importThemePatch(state, text, name, id = newThemeId(), { targetId, expectedRevision } = {}) {
  const restored = parseThemeImport(text);
  return saveThemePatch(state, { ...restored, name: themeName(name, restored.name) }, targetId ? { id: targetId, expectedRevision } : { newId: id }).patch;
}
export function importConflicts(state, record) {
  const priority = item => item.id === record.id ? 0 : item.name.toLocaleLowerCase() === record.name.toLocaleLowerCase() ? 1 : 2;
  return allThemes(state).filter(item => priority(item) < 2 || sameAppearance(item, record)).sort((a, b) => priority(a) - priority(b));
}
export function exportThemeLibrary(state) {
  const captured = capture(state); capacity(captured.themeLibrary);
  const text = JSON.stringify({ format: LIBRARY_FORMAT, version: 1, themes: captured.themeLibrary, selectedThemes: captured.selectedThemes,
    display: { theme: state.theme, highlightEnabled: state.highlightEnabled } }, null, 2);
  if (text.length > MAX_LIBRARY_BYTES) throw Error("library-too-large");
  return text;
}
export function parseLibraryBackup(text) {
  if (typeof text !== "string" || text.length > MAX_LIBRARY_BYTES) throw Error("invalid-library-backup");
  let raw; try { raw = JSON.parse(text); } catch { throw Error("invalid-library-backup"); }
  if (raw?.format !== LIBRARY_FORMAT || raw.version !== 1 || !Array.isArray(raw.themes) || raw.themes.length > MAX_IMPORTED_THEMES + 4) throw Error("invalid-library-backup");
  const themes = normalizeThemeLibrary(raw.themes);
  if (themes.length !== raw.themes.length) throw Error("invalid-library-backup");
  capacity(themes);
  const selectedThemes = {};
  for (const mode of MODES) {
    const id = raw.selectedThemes?.[mode];
    if (typeof id !== "string" || !findTheme({ themeLibrary: themes }, mode, id)) throw Error("invalid-library-backup");
    selectedThemes[mode] = id;
  }
  if (!MODES.concat("system").includes(raw.display?.theme) || typeof raw.display?.highlightEnabled !== "boolean") throw Error("invalid-library-backup");
  return { themes, selectedThemes, display: { theme: raw.display.theme, highlightEnabled: raw.display.highlightEnabled } };
}
export function parseImportFile(text, filename) {
  if (typeof text !== "string" || text.length > MAX_LIBRARY_BYTES) throw Error("invalid-backup");
  let raw; try { raw = JSON.parse(text); } catch { throw Error("invalid-backup"); }
  return raw?.format === LIBRARY_FORMAT ? { kind: "library", ...parseLibraryBackup(text) } : { kind: "theme", record: parseThemeImport(text, filename), text };
}
export function restoreLibraryPatch(state, text, strategy = "merge") {
  const backup = parseLibraryBackup(text);
  if (strategy === "replace") {
    // A restore is a new local write, not a rollback of concurrency tokens.
    const themes = backup.themes.map(item => ({ ...item, revision: Math.max(item.revision, state.themeLibrary?.find(existing => existing.id === item.id)?.revision ?? -1) + 1 }));
    return { ...materialize(state, themes, backup.selectedThemes, MODES), theme: backup.display.theme,
      highlightEnabled: backup.display.highlightEnabled, colors: undefined, customRules: undefined };
  }
  if (strategy !== "merge") throw Error("invalid-import-strategy");
  const captured = capture(state); let list = [...captured.themeLibrary];
  for (const item of backup.themes) {
    if (list.some(existing => ((existing.id === item.id && existing.name === item.name) || existing.originId === item.id) && existing.theme === item.theme && sameAppearance(existing, item))) continue;
    const key = list.some(existing => existing.id === item.id) ? newThemeId() : item.id;
    list.push({ ...item, id: key, ...(key !== item.id ? { originId: item.id } : {}), name: uniqueName(list, item.name), revision: 0 });
  }
  capacity(list);
  return { themeLibrary: list, selectedThemes: captured.selectedThemes };
}
