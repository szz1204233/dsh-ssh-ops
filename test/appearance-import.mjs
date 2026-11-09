// Exercise the actual component callbacks with a small hook host. No browser
// file chooser or native confirm is required, and effects never open a window.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const react = `
let slots = [], cursor = 0;
export const begin = () => { cursor = 0; };
export const reset = () => { slots = []; cursor = 0; };
export const Fragment = 'fragment';
export function createElement(type, props, ...children) { return { type, props: { ...props, children } }; }
export function useState(initial) { const key = cursor++; if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial; return [slots[key], value => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; }]; }
export function useRef(initial) { const key = cursor++; return slots[key] ??= { current: initial }; }
export const useId = () => 'test-id';
export const useEffect = () => {};
export const useMemo = fn => fn();
export const useSyncExternalStore = (_subscribe, get) => get();
`;
const bundle = (await build({ stdin: { contents: `
export { TerminalDisplaySettings } from './src/client/terminal-display/TerminalDisplaySettings.jsx';
export { TerminalAppearanceButton } from './src/client/terminal-display/TerminalAppearanceButton.jsx';
export { PatternTags } from './src/client/terminal-display/PatternTags.jsx';
export { getDisplaySettings, setDisplaySettings, getDisplayPersistence, saveDisplayTheme } from './src/client/terminal-display/settings.js';
export { allThemes, exportThemeLibrary, builtinTheme } from './src/client/terminal-display/theme-library.js';
export { exportScheme, defaultScheme } from './src/client/terminal-display/scheme.js';
export { begin, reset } from 'react';`, resolveDir: root, loader: "jsx" },
  bundle: true, write: false, platform: "browser", format: "esm",
  plugins: [{ name: "hook-host", setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "hook-host" }));
    build.onLoad({ filter: /.*/, namespace: "hook-host" }, () => ({ contents: react, loader: "js" }));
  } }],
})).outputFiles[0].text;
let storageBlocked = false;
const stored = new Map();
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => { if (storageBlocked) throw Error("quota"); stored.set(key, value); } };
const app = await import(`data:text/javascript;base64,${Buffer.from(bundle).toString("base64")}`);
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function render() { app.begin(); return app.TerminalDisplaySettings(); }
function button(tree, label) {
  return nodes(tree).find((node) => node.type === "button" && node.props.children.includes(label));
}


const downloads = [];
globalThis.URL.createObjectURL = blob => { downloads.push(blob); return "blob:test"; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
function fresh() {
  app.reset(); storageBlocked = false; downloads.length = 0;
  app.setDisplaySettings({ theme: "dark", highlightEnabled: false, schemes: undefined, backgrounds: undefined, colors: undefined,
    customRules: undefined, builtinEnabled: true, themeLibrary: [], selectedThemes: {} });
  return render();
}
const field = (tree, label) => nodes(tree).find(node => node.props?.["aria-label"] === label);
const setName = (tree, name) => field(tree, "当前主题").props.onRename(name);
const setBackground = (tree, color) => nodes(tree).find(node => typeof node.type === "function" && node.type.name === "BackgroundField").props.onChange(color);
const selectEditor = (tree, id) => field(tree, "当前主题").props.onSelect([app.builtinTheme("dark"), app.builtinTheme("light"), ...library()].find(item => item.id === id));
const selectMode = (tree, value) => nodes(tree).find(node => node.type === "input" && node.props.type === "radio" && node.props.value === value).props.onChange();
const library = () => app.allThemes(app.getDisplaySettings());
function create(name, color) {
  let tree = render(); button(tree, "新建主题副本").props.onClick(); tree = render();
  setName(tree, name); setBackground(tree, color); tree = render(); button(tree, "保存主题").props.onClick();
  return library().find(item => item.name === name);
}
function radio(tree, text) {
  const label = nodes(tree).find(node => node.type === "label" && node.props.children.includes(text));
  return nodes(label).find(node => node.type === "input");
}
async function chooseFile(tree, text, filename = "theme.json") {
  await nodes(tree).find(node => node.type === "input" && node.props.type === "file").props.onChange({ target: { files: [{ size: text.length, name: filename, text: async () => text }], value: filename } });
  return render();
}

test("file cancellation cannot close appearance, and registered close guards can defer closing", () => {
  fresh(); app.reset(); app.begin(); let tree = app.TerminalAppearanceButton({});
  nodes(tree).find(node => node.type === "button").props.onClick();
  app.begin(); tree = app.TerminalAppearanceButton({});
  const child = nodes(tree).find(node => typeof node.type === "function"), dialog = child.type(child.props);
  dialog.props.onCancel({ target: {}, currentTarget: {}, preventDefault() { assert.fail("child cancellation"); } });
  const settingsChild = nodes(dialog).find(node => typeof node.type === "function");
  let resume;
  settingsChild.props.registerCloseGuard(value => { resume = value; return false; });
  const target = {};
  dialog.props.onCancel({ target, currentTarget: target, preventDefault() {} });
  app.begin(); tree = app.TerminalAppearanceButton({}); assert.ok(nodes(tree).some(node => typeof node.type === "function"));
  resume(); app.begin(); tree = app.TerminalAppearanceButton({}); assert.ok(!nodes(tree).some(node => typeof node.type === "function"));
});

test("built-in template edits save and apply a new custom theme without overwriting the built-in", () => {
  let tree = fresh();
  const builtin = app.builtinTheme("dark");
  assert.equal(field(tree, "当前主题").props.selectedId, "builtin:dark");
  assert.equal(button(tree, "保存主题").props.disabled, true);
  assert.ok(button(tree, "新建主题副本"));
  setBackground(tree, "#abcdef"); tree = render();
  assert.equal(button(tree, "保存主题").props.disabled, false);
  assert.equal(field(tree, "当前主题").props.value, "自定义主题");
  assert.equal(field(tree, "当前主题").props.selectedId, null);
  button(tree, "保存主题").props.onClick(); tree = render();
  assert.equal(library().length, 1);
  assert.equal(library()[0].background, "#abcdef");
  assert.equal(field(tree, "当前主题").props.selectedId, library()[0].id);
  assert.deepEqual(app.builtinTheme("dark"), builtin);
  assert.equal(app.getDisplaySettings().selectedThemes.dark, library()[0].id);
  assert.equal(app.getDisplaySettings().backgrounds.dark, "#abcdef");
  assert.ok(button(tree, "保存主题"));
  const id = library()[0].id;
  setBackground(tree, "#aabbcc"); tree = render(); button(tree, "保存主题").props.onClick();
  assert.equal(library().length, 1);
  assert.equal(library()[0].id, id);
  assert.equal(library()[0].name, "自定义主题");
  assert.equal(library()[0].background, "#aabbcc");
});

test("selecting a theme edits it and save-as selects an independent named copy", () => {
  fresh(); const a = create("A", "#aaaaaa"), b = create("B", "#bbbbbb");
  assert.ok(a && b && a.id !== b.id); assert.equal(app.getDisplaySettings().backgrounds.dark, "#bbbbbb");
  let tree = render(); selectEditor(tree, a.id); tree = render(); setBackground(tree, "#abcdef"); tree = render();
  assert.equal(library().find(item => item.id === a.id).background, "#aaaaaa");
  button(tree, "保存主题").props.onClick(); tree = render();
  assert.equal(library().find(item => item.id === a.id).background, "#abcdef");
  selectEditor(tree, b.id); tree = render(); setBackground(tree, "#eeeeee"); tree = render(); button(tree, "保存主题").props.onClick(); tree = render();
  assert.equal(library().find(item => item.id === a.id).background, "#abcdef");
  button(tree, "新建主题副本").props.onClick(); assert.equal(library().length, 3);
  tree = render(); assert.notEqual(app.getDisplaySettings().selectedThemes.dark, b.id);
  assert.equal(app.getDisplaySettings().selectedThemes.dark, field(tree, "当前主题").props.selectedId);
  for (const mode of ["dark", "light"]) { selectMode(tree, mode); tree = render(); assert.ok(field(tree, "当前主题").props.themes.some(item => item.id === a.id)); }
});

test("explicit copy preserves the original custom theme while including unsaved edits", () => {
  fresh(); const original = create("Original", "#112233"); let tree = render();
  setBackground(tree, "#aabbcc"); tree = render();
  button(tree, "新建主题副本").props.onClick(); tree = render();
  assert.equal(library().length, 2);
  assert.equal(library().find(item => item.id === original.id).background, "#112233");
  const copied = library().find(item => item.id !== original.id);
  assert.equal(copied.background, "#aabbcc");
  assert.equal(copied.name, "Original 副本");
  assert.equal(field(tree, "当前主题").props.selectedId, copied.id);
});

test("switching editors offers save, discard or cancel and preserves pending changes", () => {
  fresh(); const a = create("A", "#aaaaaa"), b = create("B", "#bbbbbb");
  let tree = render(); selectEditor(tree, a.id); tree = render(); setBackground(tree, "#123456"); tree = render();
  selectEditor(tree, b.id); tree = render(); assert.ok(field(tree, "未保存的主题修改"));
  assert.equal(field(tree, "未保存的主题修改").props["aria-modal"], "true");
  assert.ok(nodes(tree).some(node => node.props?.inert === ""));
  button(field(tree, "未保存的主题修改"), "取消").props.onClick(); tree = render();
  assert.equal(field(tree, "当前主题").props.selectedId, a.id);
  selectEditor(tree, b.id); tree = render(); button(tree, "保存后继续").props.onClick(); tree = render();
  assert.equal(field(tree, "当前主题").props.selectedId, b.id);
  assert.equal(library().find(item => item.id === a.id).background, "#123456");
  setBackground(tree, "#654321"); tree = render(); selectEditor(tree, a.id); tree = render(); button(tree, "放弃修改后继续").props.onClick();
  assert.equal(library().find(item => item.id === b.id).background, "#bbbbbb");
});

test("display-mode switching protects edits and loads the selected theme for each mode", () => {
  fresh(); const a = create("Dark theme", "#123456"); let tree = render();
  selectMode(tree, "light"); tree = render();
  assert.equal(field(tree, "当前主题").props.selectedId, "builtin:light");
  setBackground(tree, "#eeeecc"); tree = render();
  selectMode(tree, "dark"); tree = render();
  assert.equal(app.getDisplaySettings().theme, "light");
  assert.ok(field(tree, "未保存的主题修改"));
  button(tree, "取消").props.onClick(); tree = render();
  assert.equal(field(tree, "当前主题").props.value, "自定义主题");
  selectMode(tree, "dark"); tree = render(); button(tree, "放弃修改后继续").props.onClick(); tree = render();
  assert.equal(field(tree, "当前主题").props.selectedId, a.id);
  assert.equal(field(tree, "当前主题").props.value, "Dark theme");
  assert.equal(app.getDisplaySettings().selectedThemes.light, "builtin:light");
});

test("single-theme import supports copy and update and is available in both modes", async () => {
  let tree = fresh(); const text = app.exportScheme({ backgrounds: { dark: "#112233" } }, "dark", "Imported");
  tree = await chooseFile(tree, text); assert.ok(field(tree, "确认导入主题"));
  button(tree, "确认导入").props.onClick(); tree = render(); const a = library().find(item => item.name === "Imported");
  assert.ok(a); assert.equal(app.getDisplaySettings().backgrounds, undefined);
  for (const mode of ["dark", "light"]) { selectMode(tree, mode); tree = render(); selectEditor(tree, a.id); tree = render(); }
  assert.deepEqual(app.getDisplaySettings().backgrounds, { dark: "#112233", light: "#112233" });
  tree = await chooseFile(render(), app.exportScheme({ backgrounds: { dark: "#abcdef" } }, "dark", "Imported"));
  radio(tree, "更新已有主题").props.onChange(); tree = render(); button(tree, "确认导入").props.onClick();
  assert.equal(library().length, 1); assert.deepEqual(app.getDisplaySettings().backgrounds, { dark: "#abcdef", light: "#abcdef" });
  const snapshot = app.getDisplaySettings(); tree = await chooseFile(render(), "bad"); assert.equal(app.getDisplaySettings(), snapshot);
  const picker = nodes(tree).find(node => node.type === "input" && node.props.type === "file"); let stopped = false;
  picker.props.onCancel({ stopPropagation() { stopped = true; } }); assert.ok(stopped);
});

test("draft export uses its explicit target, and full backup excludes unsaved drafts", async () => {
  fresh(); const a = create("A", "#aaaaaa"); let tree = render();
  selectEditor(tree, "builtin:light"); tree = render(); setName(tree, "Light draft"); setBackground(tree, "#eeeeee"); tree = render();
  button(tree, "导出草稿").props.onClick(); const single = JSON.parse(await downloads.at(-1).text());
  assert.equal(single.theme, "light"); assert.equal(single.background, "#eeeeee");
  button(tree, "备份全部主题").props.onClick(); const whole = JSON.parse(await downloads.at(-1).text());
  assert.equal(whole.themes.length, 1); assert.equal(whole.themes[0].id, a.id); assert.equal(whole.themes[0].background, "#aaaaaa");
});

test("storage failure keeps the draft and retry actually saves that draft", () => {
  let tree = fresh(); setName(tree, "Rescue"); setBackground(tree, "#abcdef"); tree = render();
  const before = app.getDisplaySettings();
  storageBlocked = true; button(tree, "保存主题").props.onClick(); tree = render();
  assert.deepEqual(app.getDisplaySettings().selectedThemes, before.selectedThemes);
  assert.equal(library().length, 0); assert.equal(field(tree, "当前主题").props.value, "Rescue"); assert.equal(app.getDisplayPersistence().saved, false);
  storageBlocked = false; button(tree, "重试保存").props.onClick();
  assert.equal(library()[0].name, "Rescue"); assert.equal(app.getDisplayPersistence().saved, true);
});

test("pending keyword input is reported before Enter and included when saving the editor", () => {
  let tree = fresh(); const row = nodes(tree).find(node => typeof node.type === "function" && node.props.entry);
  row.props.onPatternDraft({ text: "ERROR\\s+\\d+", valid: true }); tree = render();
  button(tree, "保存主题").props.onClick();
  assert.equal(library()[0].entries.find(item => item.id === row.props.entry.id).text, "ERROR\\s+\\d+");
  app.reset(); let pending;
  const props = { label: "test", text: "fatal", onChange() {}, onPendingChange(value) { pending = value; } };
  const renderTags = () => { app.begin(); return app.PatternTags(props); };
  tree = renderTags(); const input = nodes(tree).find(node => node.type === "input" && "data-pattern-input" in node.props);
  input.props.onChange({ target: { value: "ERROR\\s+\\d+" } });
  assert.equal(pending.text, "fatal\nERROR\\s+\\d+"); assert.equal(pending.valid, true);
});

test("manager deletes an unused theme without applying it or overwriting another theme", () => {
  fresh(); const a = create("A", "#aaaaaa"), b = create("B", "#bbbbbb"); let tree = render();
  selectEditor(tree, a.id); tree = render();
  button(tree, "管理主题").props.onClick(); tree = render();
  const row = nodes(tree).find(node => node.type === "div" && node.props.children.flat(Infinity).some(child => child?.type === "span" && child.props.children.includes("B")));
  button(row, "删除").props.onClick(); tree = render(); button(tree, "确认删除").props.onClick();
  assert.ok(!library().some(item => item.id === b.id));
  assert.equal(app.getDisplaySettings().selectedThemes.dark, a.id); assert.equal(app.getDisplaySettings().backgrounds.dark, "#aaaaaa");
});

test("full restore with a dirty draft offers export-before-restore rather than save-then-delete", async () => {
  fresh(); create("A", "#aaaaaa"); const text = app.exportThemeLibrary(app.getDisplaySettings());
  create("B", "#bbbbbb"); let tree = render(); setBackground(tree, "#abcdef"); tree = render();
  tree = await chooseFile(tree, text, "library.json");
  radio(tree, "完整恢复：替换主题库、深浅选择和显示设置。建议先备份当前主题库。").props.onChange(); tree = render();
  button(tree, "确认导入").props.onClick(); tree = render();
  assert.ok(button(tree, "导出草稿后继续")); assert.ok(!button(tree, "保存后继续"));
  button(tree, "导出草稿后继续").props.onClick(); tree = render();
  const rescued = JSON.parse(await downloads.at(-1).text()); assert.equal(rescued.name, "B"); assert.equal(rescued.background, "#abcdef");
  assert.deepEqual(library().map(item => item.name), ["A"]);
  assert.ok(!field(tree, "未保存的主题修改"));
});
