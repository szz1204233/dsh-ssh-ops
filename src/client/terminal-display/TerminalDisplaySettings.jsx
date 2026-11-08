import * as React from "react";
import { t } from "../../i18n/core.js";
import { useLanguage } from "../locale.js";
import { getDisplaySettings, setDisplaySettings, subscribeDisplaySettings, getDisplayPersistence, retryDisplayPersistence, selectDisplayTheme, importDisplayTheme, deleteDisplayTheme, saveDisplayTheme, restoreDisplayLibrary } from "./settings.js";
import { terminalTheme, resolveDisplayTheme, subscribeHostTheme, getHostTheme, DEFAULT_BACKGROUNDS } from "./theme.js";
import { normalizeScheme, MAX_SCHEME_ENTRIES } from "./scheme.js";
import { themeOptions, selectedThemeId, themeName, allThemes, builtinTheme, exportTheme, exportThemeLibrary, parseImportFile, importConflicts, MAX_LIBRARY_BYTES } from "./theme-library.js";
import { EditablePreview } from "./EditablePreview.jsx";
import { PatternTags } from "./PatternTags.jsx";
import { dropSlot, dropIndex, previewShifts, insertionOffset } from "./drag-order.js";
import { DEFAULT_PREVIEW_TEXT } from "./preview-text.js";
const button = { padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "inherit", background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" };
const field = { boxSizing: "border-box", minWidth: 0, padding: "6px 8px", borderRadius: 5, fontSize: 12, color: "inherit",
  background: "var(--dsh-ssh-ops-input, #101418)", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" };
const DRAG_THRESHOLD = 6;

/**
 * Appearance/scheme styles. The drag visuals live here (not inline) because the
 * moved rows are driven by direct DOM writes during the pointer move: React
 * renders only the idle tree plus the one dragged row's placeholder state.
 */
const STYLES = `
.dsh-scheme-list { position: relative; overscroll-behavior: contain; scrollbar-gutter: stable;
  flex: 1 1 380px; min-height: 110px; max-height: min(40vh, 380px); overflow-y: auto; overflow-x: hidden; }
/* Height-adaptive shell: the dialog caps its own height, so only the scheme
   list scrolls; the theme switch, add button and preview stay on screen on
   laptop-height (windowed) windows instead of being scrolled out of view. */
.dsh-appearance-body { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.dsh-appearance-section { display: flex; flex-direction: column; flex: 0 0 auto; min-height: 0;
  padding: 4px 20px 12px; color: var(--dsh-ssh-ops-text, #d7dbe2); }
/* The fieldset only carries the disabled semantics: display:contents keeps it
   out of layout so .dsh-scheme-fill is a normal flex item that can shrink;
   Chrome will not shrink flex children through a fieldset content box. */
.dsh-scheme-fieldset { display: contents; }
.dsh-scheme-fill { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; width: 100%; }
@media (max-height: 780px) {
  .dsh-appearance-section { padding-bottom: 10px; }
  /* Rows carry inline padding/row-gap; the compact spacing must win there. */
  .dsh-scheme-row { padding-top: 6px !important; padding-bottom: 6px !important; row-gap: 4px !important; }
}
/* Very short windows fall back to one scrolling dialog rather than clipping. */
@media (max-height: 620px) {
  .dsh-appearance-body { overflow-y: auto; }
  .dsh-appearance-section { flex: 0 0 auto; }
  .dsh-scheme-fill { flex: 0 0 auto; }
  .dsh-scheme-list { flex: 0 0 auto; }
}
.dsh-scheme-list[data-dragging="true"] { user-select: none; -webkit-user-select: none; }
.dsh-scheme-row { position: relative; touch-action: pan-y; transition: transform .22s cubic-bezier(.22,.61,.36,1), background-color .16s ease, box-shadow .16s ease, border-color .16s ease; }
.dsh-scheme-row:hover { background: color-mix(in srgb, var(--dsh-ssh-ops-text, #d7dbe2) 5%, transparent); border-radius: 8px; }
.dsh-scheme-list[data-dragging="true"] .dsh-scheme-row:hover { background: transparent; }
.dsh-scheme-row[data-drag-source="true"] { border: 1px dashed #2d6cdf !important; border-radius: 8px;
  background: color-mix(in srgb, rgba(45,108,223,.10)) !important; }
.dsh-scheme-row[data-drag-source="true"] > * { visibility: hidden; }
.dsh-scheme-row[data-drop-target="true"] { box-shadow: inset 0 0 0 1px color-mix(in srgb, rgba(45,108,223,.55)); border-radius: 8px; }
.dsh-drag-handle { display: grid; place-items: center; width: 28px; height: 34px; padding: 0; border: 0; border-radius: 6px;
  background: transparent; color: var(--dsh-ssh-ops-muted, #8b93a1); cursor: grab; touch-action: none; }
.dsh-drag-handle:hover, .dsh-drag-handle:focus-visible { background: color-mix(in srgb, var(--dsh-ssh-ops-text, #d7dbe2) 10%, transparent); color: var(--dsh-ssh-ops-text, #d7dbe2); }
.dsh-drag-handle:active, .dsh-scheme-list[data-dragging="true"] .dsh-drag-handle { cursor: grabbing; }
.dsh-scheme-ghost { position: fixed; z-index: 2147483000; pointer-events: none; opacity: .97;
  background: var(--dsh-ssh-ops-surface, #161b21); color: var(--dsh-ssh-ops-text, #d7dbe2);
  border: 1px solid #2d6cdf; border-radius: 8px;
  box-shadow: 0 18px 40px rgba(0,0,0,.38), 0 2px 8px rgba(0,0,0,.24);
  animation: dsh-ghost-in .16s cubic-bezier(.22,.61,.36,1); will-change: left, top; }
@keyframes dsh-ghost-in { from { opacity: 0; box-shadow: 0 2px 8px rgba(0,0,0,.2); } }
.dsh-quick-hint { position: fixed; z-index: 2147483001; pointer-events: none; transform: translateX(-50%);
  padding: 4px 8px; font-size: 11px; line-height: 1.6; white-space: nowrap; color: var(--dsh-ssh-ops-text, #d7dbe2);
  background: var(--dsh-ssh-ops-surface, #161b21); border: 1px solid var(--dsh-ssh-ops-border, #3a414b);
  border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.28); }
.dsh-drop-indicator { position: absolute; top: 0; left: 0; right: 0; height: 2px; margin-top: -1px; border-radius: 2px;
  background: #2d6cdf; box-shadow: 0 0 0 1px color-mix(in srgb, rgba(45,108,223,.30));
  pointer-events: none; display: none; will-change: transform; }
.dsh-scheme-list[data-dragging="true"] { cursor: grabbing; }
.dsh-scheme-list[data-settling="true"] .dsh-scheme-row { transition: none !important; }
.dsh-delete-entry { display: inline-flex; align-items: center; justify-content: center; height: 30px; padding: 0 8px;
  border: 1px solid rgba(229,72,77,.5); border-radius: 5px; background: transparent; color: #e5484d; font-size: 11px; cursor: pointer; }
.dsh-delete-entry:hover, .dsh-delete-entry:focus-visible { background: rgba(229,72,77,.12); border-color: #e5484d; }
.dsh-case-toggle { display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 8px; border-radius: 5px;
  border: 1px solid var(--dsh-ssh-ops-border, #3a414b); background: transparent; color: var(--dsh-ssh-ops-muted, #8b93a1);
  font-size: 11px; cursor: pointer; white-space: nowrap; }
.dsh-case-toggle[aria-pressed="true"] { background: #2d6cdf; border-color: #2d6cdf; color: #fff; }
.dsh-case-toggle:disabled { cursor: not-allowed; opacity: .5; }
.dsh-theme-badge { display: inline-flex; align-items: center; gap: 6px; padding: 1px 8px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--dsh-ssh-ops-border, #3a414b); color: var(--dsh-ssh-ops-muted, #8b93a1); font-size: 11px; line-height: 1.7; }
.dsh-theme-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; border-width: 1px; border-style: solid; }
.dsh-export-toast { position: absolute; right: 0; top: calc(100% + 6px); z-index: 41; width: max-content; max-width: min(340px, 60vw); padding: 6px 10px;
  font-size: 11px; line-height: 1.5; color: var(--dsh-ssh-ops-text, #d7dbe2); background: var(--dsh-ssh-ops-surface, #161b21);
  border: 1px solid #2d6cdf; border-radius: 7px; box-shadow: 0 10px 30px rgba(0,0,0,.28);
  pointer-events: none; animation: dsh-toast-in .16s ease-out; }
@keyframes dsh-toast-in { from { opacity: 0; transform: translateY(-4px); } }
.dsh-scheme-fieldset:disabled input, .dsh-scheme-fieldset:disabled button { cursor: not-allowed; }
.dsh-case-wrap > button:disabled { pointer-events: none; }
/* Settings rows: a muted label column and one control strip per row. */
.dsh-row { display: grid; grid-template-columns: 106px minmax(0, 1fr); align-items: center; column-gap: 12px; min-height: 30px; }
.dsh-row-label { font-size: 12px; color: var(--dsh-ssh-ops-muted, #8b93a1); }
.dsh-hint { font-size: 11px; line-height: 1.6; color: var(--dsh-ssh-ops-muted, #8b93a1); }
.dsh-theme-select { appearance: none; -webkit-appearance: none; min-width: 0; width: 220px; max-width: 100%; height: 28px;
  padding: 0 26px 0 9px; border-radius: 6px; color: inherit; font-size: 12px; font-family: inherit; cursor: pointer;
  border: 1px solid var(--dsh-ssh-ops-border, #3a414b); background-color: var(--dsh-ssh-ops-input, #101418);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%238b93a1' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat; background-position: right 9px center; }
.dsh-theme-select:hover { border-color: var(--dsh-ssh-ops-muted, #8b93a1); }
.dsh-theme-select:focus-visible { outline: 2px solid #2d6cdf; outline-offset: 1px; }
.dsh-text-button { padding: 5px 9px; border-radius: 6px; border: 1px solid var(--dsh-ssh-ops-border, #3a414b);
  background: transparent; color: inherit; font-size: 12px; font-family: inherit; cursor: pointer; }
.dsh-text-button:hover { background: color-mix(in srgb, var(--dsh-ssh-ops-text, #d7dbe2) 8%, transparent); }
.dsh-text-button:focus-visible { outline: 2px solid #2d6cdf; outline-offset: 1px; }
.dsh-text-button:disabled { opacity: .5; cursor: not-allowed; }
.dsh-primary { border-color: #2d6cdf; background: #2d6cdf; color: #fff; }
.dsh-primary:hover:not(:disabled) { background: #3b7ae6; }
.dsh-section-title { font-size: 13px; font-weight: 600; }
.dsh-pill { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 1.7;
  border: 1px solid var(--dsh-ssh-ops-border, #3a414b); color: var(--dsh-ssh-ops-muted, #8b93a1); white-space: nowrap; }
.dsh-pill[data-tone="accent"] { border-color: rgba(45,108,223,.5); background: rgba(45,108,223,.12); color: #2d6cdf; }
/* Each mode's picker is one group so the active badge cannot be read as
   belonging to the neighbouring scheme. Inactive groups keep the same padding
   and a transparent border, so switching modes never shifts the row. */
.dsh-theme-group { display: inline-flex; align-items: center; gap: 8px; min-width: 0;
  padding: 2px 9px; border-radius: 8px; border: 1px solid transparent; }
.dsh-theme-group[data-active="true"] { border-color: rgba(45,108,223,.45); background: rgba(45,108,223,.07); }
@media (prefers-reduced-motion: reduce) {
  .dsh-scheme-row { transition: none; }
  .dsh-scheme-ghost { animation: none; transform: none; }
  .dsh-export-toast { animation: none; }
}
.dsh-popover { position: absolute; right: 0; top: calc(100% + 6px); z-index: 42; width: min(420px, 100%);
  display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; font-size: 12px;
  background: var(--dsh-ssh-ops-surface, #161b21); color: var(--dsh-ssh-ops-text, #d7dbe2);
  border: 1px solid #2d6cdf; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.28); }
.dsh-popover-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
@media (max-width: 720px) {
  .dsh-row { grid-template-columns: 1fr; row-gap: 4px; padding-bottom: 4px; }
  .dsh-hint { margin-left: 0 !important; }
  .dsh-popover { left: 0; right: 0; width: auto; }
  .dsh-theme-group { width: 100%; }
  .dsh-theme-select { flex: 1 1 auto; max-width: none; width: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-scheme-row { transition: none; }
  .dsh-scheme-ghost { animation: none; transform: none; }
  .dsh-export-toast { animation: none; }
}
@media (max-width: 720px) {
  .dsh-scheme-row { grid-template-columns: 28px minmax(0, 1fr) 34px 26px !important;
    grid-template-areas: "grip name color del" "case case case case" "hex hex hex hex" "tags tags tags tags" !important; }
}
`;

/** Background colour swatch + HEX for the active theme, with a reset affordance. */
function BackgroundField({ value, onChange, onReset, resetLabel }) {
  const [hex, setHex] = React.useState(value);
  const label = t("终端背景");
  React.useEffect(() => setHex(value), [value]);
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
    <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}
      style={{ width: 30, height: 24, padding: 2, boxSizing: "border-box", background: "transparent",
        border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 4 }} />
    <input aria-label={label + " HEX"} value={hex} maxLength={7} spellCheck={false}
      onChange={(event) => { setHex(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value); }}
      onBlur={() => setHex(value)}
      style={{ ...field, height: 24, width: 78, padding: "0 6px", fontFamily: "monospace" }} />
    {onReset && <button type="button" aria-label={resetLabel} title={resetLabel} onClick={onReset}
      style={{ ...field, display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: 24, width: 24, padding: 0, cursor: "pointer", fontSize: 13, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>↺</button>}
  </span>;
}

function SchemeEntry({ entry, label, onChange, onDelete, dragging, onHandlePointerDown, onShowHint, onHideHint, rowRef, onPatternDraft }) {
  const [hex, setHex] = React.useState(entry.color);
  const toggleId = React.useId();
  React.useEffect(() => setHex(entry.color), [entry.color]);
  // Every control in the first row shares the same box height so the row reads
  // as one strip instead of four differently sized widgets.
  const control = { height: 30, boxSizing: "border-box" };
  const caseHint = entry.caseSensitive ? t("区分大小写：已开启") : t("区分大小写：已关闭");
  return <div ref={rowRef} className="dsh-scheme-row" data-scheme-id={entry.id} data-drag-source={dragging ? "true" : undefined}
    aria-grabbed={dragging ? "true" : undefined}
    style={{ display: "grid", width: "100%", boxSizing: "border-box",
      gridTemplateColumns: "28px minmax(120px, 220px) 34px 84px auto auto minmax(0, 1fr)",
      gridTemplateAreas: '"grip name color hex case del rest" "tags tags tags tags tags tags tags"',
      columnGap: 8, rowGap: 6, alignItems: "center",
      padding: "10px 6px 10px 2px", borderBottom: "1px solid var(--dsh-ssh-ops-border, #3a414b)" }}>
    <button type="button" data-drag-handle className="dsh-drag-handle" aria-label={t(`拖动排序 ${label}`)}
      onPointerDown={onHandlePointerDown}
      onPointerEnter={(event) => onShowHint(event, t("鼠标拖动或键盘聚焦后 Alt+↑/↓ 排序"), true)} onPointerLeave={onHideHint}
      onFocus={(event) => onShowHint(event, t("鼠标拖动或键盘聚焦后 Alt+↑/↓ 排序"), true)} onBlur={onHideHint}
      style={{ gridArea: "grip" }}>
      <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="4" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="10" cy="12" r="1"/></svg>
    </button>
    <div style={{ gridArea: "name", display: "flex", alignItems: "center", gap: 6, minWidth: 0, height: 30 }}>
      <input id={toggleId} type="checkbox" checked={entry.enabled} aria-label={t(`启用 ${label}`)} onChange={(event) => onChange({ enabled: event.target.checked })} />
      {onDelete
        ? <input aria-label={t("配色项名称")} value={entry.name} placeholder={t("自定义配色项")} maxLength={80} onChange={(event) => onChange({ name: event.target.value })} style={{ ...field, ...control, width: "100%", padding: "0 6px" }} />
        : <label htmlFor={toggleId} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</label>}
    </div>
    <input type="color" aria-label={label} value={entry.color} disabled={!entry.enabled} onChange={(event) => onChange({ color: event.target.value })}
      style={{ ...control, gridArea: "color", width: 34, padding: 2, background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 4 }} />
    <input aria-label={label + " HEX"} value={hex} disabled={!entry.enabled} maxLength={7} spellCheck={false}
      onChange={(event) => { setHex(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange({ color: event.target.value }); }} onBlur={() => setHex(entry.color)}
      style={{ ...field, ...control, gridArea: "hex", width: 84, padding: "0 6px", fontFamily: "monospace" }} />
    {/* The wrapper carries the state hint: a disabled control swallows its
        native title tooltip, so the hint has to hang off an element that still
        hovers while the toggle or the whole scheme is disabled. */}
    <span className="dsh-case-wrap"
      onPointerEnter={(event) => onShowHint(event, caseHint)} onPointerLeave={onHideHint}
      onFocus={(event) => onShowHint(event, caseHint)} onBlur={onHideHint} onClick={onHideHint}
      style={{ gridArea: "case", display: "inline-flex" }}>
      <button type="button" className="dsh-case-toggle" disabled={!entry.enabled} aria-label={t(`${label} 区分大小写`)} aria-pressed={entry.caseSensitive}
        onClick={() => onChange({ caseSensitive: !entry.caseSensitive })}>
        <span aria-hidden="true" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>Aa</span>
      </button>
    </span>
    {onDelete
      ? <button type="button" className="dsh-delete-entry" style={{ gridArea: "del", justifySelf: "end" }} aria-label={t(`删除配色项 ${label}`)} title={t(`删除配色项 ${label}`)} onClick={onDelete}>{t("删除")}</button>
      : <span style={{ gridArea: "del" }} />}
    <div style={{ gridArea: "tags", display: "flex", gap: 6, alignItems: "flex-start", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}><PatternTags label={label} text={entry.text} disabled={!entry.enabled} onPendingChange={onPatternDraft} onChange={(text) => onChange({ text, mode: "regex" })} /></div>
    </div>
  </div>;
}

export function TerminalDisplaySettings({ registerCloseGuard } = {}) {
  useLanguage();
  const settings = React.useSyncExternalStore(subscribeDisplaySettings, getDisplaySettings);
  const persistence = React.useSyncExternalStore(subscribeDisplaySettings, getDisplayPersistence);
  React.useSyncExternalStore(subscribeHostTheme, getHostTheme);
  const radioName = React.useId(), resolved = resolveDisplayTheme(settings.theme);
  const labelFor = (record) => record.id === "builtin:dark" ? t("DSH 默认（深色）") : record.id === "builtin:light" ? t("DSH 默认（浅色）")
    : record.name === "Previous custom dark" ? t("原有深色方案") : record.name === "Previous custom light" ? t("原有浅色方案") : record.name;
  const makeEditor = (record, copy = false, blank = false) => {
    const draft = JSON.parse(JSON.stringify(record));
    const readonly = record.id?.startsWith("builtin:");
    if (copy || readonly) draft.name = blank ? "" : t(`${labelFor(record)} 副本`);
    const id = copy || readonly ? null : record.id;
    return { draft, id, sourceId: copy ? null : record.id, revision: record.revision ?? 0,
      token: Math.random().toString(36), base: copy ? null : JSON.stringify(draft), original: JSON.parse(JSON.stringify(draft)) };
  };
  const activeRecord = themeOptions(settings, resolved).find(item => item.id === selectedThemeId(settings, resolved));
  const [editor, setEditor] = React.useState(() => makeEditor(activeRecord));
  const editorRef = React.useRef(editor); editorRef.current = editor;
  const pendingPatterns = React.useRef(new Map());
  const [, repaintPending] = React.useState(0);
  const replaceEditor = next => { editorRef.current = next; setEditor(next); };
  const isDirty = () => pendingPatterns.current.size > 0 || editorRef.current.base === null || editorRef.current.base !== JSON.stringify(editorRef.current.draft);
  const patternDraft = (id, value) => {
    if (value) pendingPatterns.current.set(id, value); else pendingPatterns.current.delete(id);
    repaintPending(count => count + 1);
  };
  const [notice, setNotice] = React.useState("");
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [transition, setTransition] = React.useState(null);
  const transitionRef = React.useRef(null);
  React.useEffect(() => { if (transition) { transitionRef.current?.scrollIntoView?.({ block: "nearest" }); transitionRef.current?.focus?.(); } }, [transition]);
  const [pendingImport, setPendingImport] = React.useState(null);
  const [pendingDelete, setPendingDelete] = React.useState(null);
  const [confirmReset, setConfirmReset] = React.useState(null);
  const [preview, setPreview] = React.useState(DEFAULT_PREVIEW_TEXT);
  const [dragId, setDragId] = React.useState(null);
  const importRef = React.useRef(null), importSeq = React.useRef(0);
  const listRef = React.useRef(null), rows = React.useRef(new Map()), indicator = React.useRef(null);
  const drag = React.useRef(null), suppressClick = React.useRef(0);
  const dirty = isDirty();
  const entries = editor.draft.entries;
  const activeTheme = terminalTheme(editor.draft.theme, { [editor.draft.theme]: editor.draft.background });
  const updateDraft = patch => { const current = editorRef.current; replaceEditor({ ...current, draft: { ...current.draft, ...patch } }); };
  const updateEntries = update => { const current = editorRef.current; replaceEditor({ ...current, draft: { ...current.draft,
    entries: normalizeScheme(update(current.draft.entries)) ?? current.draft.entries } }); };
  const labels = { error: t("错误与否定"), success: t("成功与肯定"), warning: t("警示状态"), info: t("信息关键词"),
    heading: t("地址、时间与符号"), number: t("数字"), string: t("字符串与路径"), option: t("命令选项"), command: t("命令名称"), debug: t("文件类型"), prompt: t("提示符") };
  const errorText = error => ({
    "invalid-pattern": t("存在无效正则，请修正后保存；草稿仍保留。"),
    "library-too-large": t("主题库文件过大，请分别导出主题。"),
    "settings-not-saved": t("未能写入本机，修改尚未保存。请重试，或先导出草稿。"),
    "theme-changed": t("主题已在另一窗口修改。请另存为新主题，或放弃草稿后重新打开。"),
    "theme-name-conflict": t("主题名称已存在，请修改名称或使用另存为。"),
    "invalid-theme-name": t("请输入有效的主题名称（最多 80 个字符）。"),
    "theme-library-full": t("主题库已满，请先删除不需要的主题。"),
    "theme-not-found": t("主题已被删除，请另存为新主题。"),
  }[error.message] ?? t("操作失败：主题或备份文件无效。"));
  const attempt = action => { try { action(); return true; } catch (error) { setNotice(errorText(error)); return false; } };
  const requestTransition = (action, options = {}) => { if (isDirty()) setTransition({ ...options, run: action }); else action(); };
  const openEditor = (record, copy = false, blank = false) => requestTransition(() => {
    const latest = record.id?.startsWith("builtin:") ? record : allThemes(getDisplaySettings()).find(item => item.id === record.id) ?? record;
    pendingPatterns.current.clear(); replaceEditor(makeEditor(latest, copy, blank)); setNotice(""); setPendingImport(null);
  });
  React.useEffect(() => {
    registerCloseGuard?.(resume => { if (!isDirty()) return true; setTransition({ run: resume }); return false; });
    return () => registerCloseGuard?.(null);
  }, [dirty, registerCloseGuard]);
  const composedDraft = () => ({ ...editorRef.current.draft, entries: editorRef.current.draft.entries.map(entry => pendingPatterns.current.has(entry.id) ? { ...entry, text: pendingPatterns.current.get(entry.id).text } : entry) });
  React.useEffect(() => {
    const protectReload = event => { if (isDirty()) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protectReload);
    return () => window.removeEventListener("beforeunload", protectReload);
  }, []);
  const saveEditor = (asNew = false) => {
    let saved;
    if (!attempt(() => {
      const current = editorRef.current;
      if ([...pendingPatterns.current.values()].some(value => !value.valid)) throw Error("invalid-pattern");
      const draft = composedDraft();
      saved = saveDisplayTheme(draft, !asNew && current.id ? { id: current.id, expectedRevision: current.revision } : {});
    })) return false;
    pendingPatterns.current.clear(); replaceEditor(makeEditor(saved)); setNotice(t(`已保存主题：${saved.name}`)); return true;
  };
  const discardEditor = () => {
    pendingPatterns.current.clear();
    if (editor.base !== null) replaceEditor({ ...editor, token: Math.random().toString(36), draft: JSON.parse(JSON.stringify(editor.original)) });
    else replaceEditor(makeEditor(activeRecord));
    setNotice(t("已放弃未保存的修改。"));
  };
  const change = (id, patch) => updateEntries(scheme => scheme.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  const move = (id, target, side = "before") => updateEntries(scheme => {
    const moved = scheme.find(entry => entry.id === id);
    if (!moved || id === target) return scheme;
    const next = scheme.filter(entry => entry.id !== id), index = next.findIndex(entry => entry.id === target);
    if (index < 0) return scheme;
    next.splice(index + (side === "after" ? 1 : 0), 0, moved); return next;
  });
  const download = (text, name) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url;
    const safe = name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 90);
    link.download = `${safe}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportRecord = record => attempt(() => { download(exportTheme(record), record.name || "theme"); setNotice(t("已导出单个主题，包含背景、配色和关键词规则。")); });
  const backupLibrary = () => attempt(() => {
    download(exportThemeLibrary(getDisplaySettings()), "dsh-theme-library"); setNotice(t("已备份全部已保存主题、深浅选择和显示设置；不含未保存草稿。"));
  });
  const restoreBackup = async event => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    const seq = ++importSeq.current;
    try {
      if (file.size > MAX_LIBRARY_BYTES) throw Error("invalid-backup");
      const text = await file.text(); if (seq !== importSeq.current) return;
      const parsed = parseImportFile(text, file.name ?? "");
      const conflicts = parsed.kind === "theme" ? importConflicts(getDisplaySettings(), parsed.record) : [];
      setPendingImport({ ...parsed, text, name: parsed.record?.name ?? "", strategy: "new", targetId: conflicts[0]?.id ?? "", targetRevision: conflicts[0]?.revision, conflicts });
      setNotice(""); setConfirmReset(null); setPendingDelete(null);
    } catch (error) { if (seq === importSeq.current) setNotice(errorText(error)); }
  };
  const confirmImport = () => {
    const operation = () => {
      const ok = attempt(() => {
        if (pendingImport.kind === "library") restoreDisplayLibrary(pendingImport.text, pendingImport.strategy === "replace" ? "replace" : "merge");
        else {
          const target = allThemes(settings).find(item => item.id === pendingImport.targetId);
          if (pendingImport.strategy === "update" && !target) throw Error("theme-not-found");
          importDisplayTheme(pendingImport.text, pendingImport.name, pendingImport.strategy === "update" ? { targetId: target?.id, expectedRevision: pendingImport.targetRevision } : {});
        }
      });
      if (ok) { setPendingImport(null); setNotice(t("导入完成。新增主题可在深色和浅色下拉框中选择。")); }
      return ok;
    };
    if (pendingImport.kind === "library" && pendingImport.strategy === "replace") requestTransition(() => { if (operation()) { const state = getDisplaySettings(), mode = resolveDisplayTheme(state.theme); pendingPatterns.current.clear(); replaceEditor(makeEditor(themeOptions(state, mode).find(item => item.id === selectedThemeId(state, mode)))); } }, { destructive: true });
    else operation();
  };
  const pendingEntry = entries.find(entry => !Object.hasOwn(labels, entry.id) && !entry.text.trim());
  const addEntry = () => {
    if (pendingEntry || entries.length >= MAX_SCHEME_ENTRIES) return;
    const id = `custom:${globalThis.crypto?.randomUUID?.() ?? Date.now() + "-" + Math.random().toString(36).slice(2)}`;
    updateEntries(scheme => [...scheme, { id, name: "", color: "#ef6f6c", enabled: true, text: "", mode: "regex", caseSensitive: false }]);
    requestAnimationFrame(() => requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      rows.current.get(id)?.querySelector("[data-pattern-input]")?.focus(); }));
  };

  // ---- pointer drag reorder -------------------------------------------------
  const rowElements = () => Array.from(rows.current.values()).filter((element) => element?.isConnected);
  const measureRows = () => {
    const list = listRef.current;
    const listRect = list.getBoundingClientRect();
    return entries.map((entry) => {
      const element = rows.current.get(entry.id);
      const rect = element.getBoundingClientRect();
      return { id: entry.id, top: rect.top - listRect.top + list.scrollTop, height: rect.height };
    });
  };
  const clearVisuals = (state, keepGhost = false) => {
    for (const element of rowElements()) {
      element.style.transform = ""; element.style.zIndex = "";
      element.removeAttribute("data-drop-target"); element.removeAttribute("data-drag-source");
    }
    if (indicator.current) { indicator.current.style.display = "none"; indicator.current.style.transform = ""; }
    if (!keepGhost) state?.ghost?.remove();
    if (listRef.current) listRef.current.removeAttribute("data-dragging");
  };
  const applyShifts = (state, shifts) => {
    for (const row of state.rows) {
      const element = rows.current.get(row.id);
      if (!element) continue;
      const shift = shifts.get(row.id);
      element.style.transform = shift ? `translateY(${shift}px)` : "";
    }
    for (const element of rowElements()) element.removeAttribute("data-drop-target");
    const target = state.slot ? rows.current.get(state.slot.id) : undefined;
    if (target) target.setAttribute("data-drop-target", "true");
  };
  const updateSlot = () => {
    const state = drag.current;
    if (!state?.active) return;
    const list = listRef.current;
    const listRect = list.getBoundingClientRect();
    const slot = dropSlot(state.rows, state.pointerY - listRect.top + list.scrollTop);
    if (!slot || (state.slot && slot.id === state.slot.id && slot.side === state.slot.side)) return;
    state.slot = slot;
    const shifts = previewShifts(state.rows, state.id, slot);
    applyShifts(state, shifts);
    const offset = insertionOffset(state.rows, state.id, slot);
    if (indicator.current) {
      if (offset == null) indicator.current.style.display = "none";
      else { indicator.current.style.display = "block"; indicator.current.style.transform = `translateY(${offset - list.scrollTop}px)`; }
    }
  };
  const autoScroll = (state) => {
    const list = listRef.current;
    const rect = list.getBoundingClientRect();
    const edge = 30;
    const delta = state.pointerY < rect.top + edge ? -14 : state.pointerY > rect.bottom - edge ? 14 : 0;
    if (!delta) return;
    const before = list.scrollTop;
    list.scrollTop = Math.max(0, Math.min(list.scrollHeight - list.clientHeight, before + delta));
    if (list.scrollTop !== before) updateSlot();
  };
  const dragFrame = () => {
    const state = drag.current;
    if (!state?.active) { state && (state.frame = undefined); return; }
    autoScroll(state);
    if (state.ghost) {
      const left = state.pointerX - state.offsetX, top = state.pointerY - state.offsetY;
      state.ghost.style.left = `${left}px`; state.ghost.style.top = `${top}px`;
    }
    state.frame = window.requestAnimationFrame(dragFrame);
  };
  const startGhost = (state, element) => {
    const dialog = element.closest("dialog") ?? document.body;
    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true);
    ghost.removeAttribute("data-scheme-id"); ghost.removeAttribute("data-drag-source"); ghost.setAttribute("aria-hidden", "true");
    ghost.classList.add("dsh-scheme-ghost");
    for (const node of ghost.querySelectorAll("[id]")) node.removeAttribute("id");
    for (const node of ghost.querySelectorAll("input,button,select,textarea")) node.setAttribute("tabindex", "-1");
    ghost.style.left = `${rect.left}px`; ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`; ghost.style.minHeight = `${rect.height}px`;
    dialog.appendChild(ghost);
    state.ghost = ghost;
  };
  const detachDrag = () => {
    window.removeEventListener("pointermove", onPointerMove, { passive: false });
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("keydown", onDragKey, true);
    if (drag.current?.frame) window.cancelAnimationFrame(drag.current.frame);
  };
  const onHandlePointerDown = (event, id) => {
    if (event.button !== 0 || !event.isPrimary) return;
    hideQuickHint();
    const element = rows.current.get(id);
    const list = listRef.current;
    if (!element || !list) return;
    const rowRect = element.getBoundingClientRect();
    drag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      pointerX: event.clientX, pointerY: event.clientY, offsetX: event.clientX - rowRect.left, offsetY: event.clientY - rowRect.top,
      active: false, ghost: undefined, rows: measureRows(), slot: undefined, frame: undefined };
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onDragKey, true);
  };
  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    state.pointerX = event.clientX; state.pointerY = event.clientY;
    if (!state.active) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < DRAG_THRESHOLD) return;
      state.active = true;
      state.rows = measureRows();
      setDragId(state.id);
      const element = rows.current.get(state.id);
      if (element) { element.setAttribute("data-drag-source", "true"); startGhost(state, element); }
      if (listRef.current) listRef.current.setAttribute("data-dragging", "true");
      state.frame = window.requestAnimationFrame(dragFrame);
    }
    event.preventDefault();
    updateSlot();
  };
  const finish = async (commitMove) => {
    const state = drag.current;
    if (!state) return;
    detachDrag();
    drag.current = null;
    const wasActive = state.active;
    if (wasActive) suppressClick.current = Date.now() + 400;
    const ghost = state.ghost;
    const list = listRef.current;
    // Freeze the row transitions while the DOM settles: the rows are already
    // at their previewed offsets, so removing the transforms and committing the
    // new order does not visibly jump, and the destination rect can be measured
    // at its final position (a running transition would return a mid-flight
    // rect, which is why the ghost used to land short of the slot).
    list?.setAttribute("data-settling", "true");
    clearVisuals(state, true);
    setDragId(null);
    if (!wasActive) { list?.removeAttribute("data-settling"); ghost?.remove(); return; }
    if (commitMove && state.slot) {
      const sourceIndex = state.rows.findIndex((row) => row.id === state.id);
      if (dropIndex(state.rows, state.id, state.slot) !== sourceIndex && state.slot.id !== state.id) {
        move(state.id, state.slot.id, state.slot.side);
      }
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    list?.removeAttribute("data-settling");
    const destination = rows.current.get(state.id);
    if (!ghost || !ghost.isConnected || !destination) { ghost?.remove(); return; }
    // The ghost is placed with left/top and tilted with a CSS transform. Glide
    // from its untilted box (left/top + offset size) so the end position is the
    // row's rect exactly, independent of the tilt.
    const to = destination.getBoundingClientRect();
    const fromLeft = Number.parseFloat(ghost.style.left) || 0;
    const fromTop = Number.parseFloat(ghost.style.top) || 0;
    // Only one floating box while the copy glides back: hide the row it is
    // about to land on (keeping its space as an empty slot) and reveal it once
    // the copy has landed.
    destination.style.visibility = "hidden";
    try {
      const animation = ghost.animate([
        { transform: "translate(0, 0)", opacity: 0.92 },
        { transform: `translate(${to.left - fromLeft}px, ${to.top - fromTop}px)`, opacity: 1 }
      ], { duration: 220, easing: "cubic-bezier(.22,.61,.36,1)" });
      try { await animation.finished; } catch { /* interrupted */ }
    } finally {
      ghost.remove();
      destination.style.visibility = "";
    }
    // A plain row div is not focusable, and the drag hides the handle's focus
    // target; give focus back to the handle so keyboard users keep their place.
    destination.querySelector("[data-drag-handle]")?.focus();
  };
  const onPointerUp = (event) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    void finish(true);
  };
  const onPointerCancel = () => { void finish(false); };
  const onDragKey = (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); void finish(false); } };
  const onKeyboardMove = (id, direction) => {
    const index = entries.findIndex((entry) => entry.id === id);
    const target = entries[index + direction];
    if (!target) return;
    move(id, target.id, direction > 0 ? "after" : "before");
    window.setTimeout(() => rows.current.get(id)?.querySelector("[data-drag-handle]")?.focus(), 0);
  };
  const onListClickCapture = (event) => {
    if (Date.now() < suppressClick.current) { event.preventDefault(); event.stopPropagation(); }
  };

  // Tooltips are rendered as fixed elements on the dialog instead of native
  // `title`s, whose ~1 s OS delay felt too slow; 160 ms keeps them snappy and
  // the list's scroll container cannot clip them. Shared by the drag handle and
  // the case-sensitivity toggle.
  const quickHint = React.useRef(undefined);
  const quickHintTimer = React.useRef(undefined);
  const hintAnchor = React.useRef(null);
  const clearQuickHint = () => {
    clearTimeout(quickHintTimer.current);
    quickHint.current?.remove();
    quickHint.current = undefined;
  };
  const hideQuickHint = () => { clearQuickHint(); hintAnchor.current = null; };
  const showQuickHint = (event, text, sortable = false) => {
    const target = event.currentTarget;
    hintAnchor.current = sortable ? target : null;
    clearTimeout(quickHintTimer.current);
    quickHintTimer.current = setTimeout(() => {
      if (!target.isConnected) return;
      clearQuickHint();
      hintAnchor.current = sortable ? target : null;
      const dialog = target.closest("dialog") ?? document.body;
      const tip = document.createElement("div");
      tip.className = "dsh-quick-hint";
      tip.setAttribute("role", "tooltip");
      tip.textContent = text;
      dialog.appendChild(tip);
      quickHint.current = tip;
      const rect = target.getBoundingClientRect();
      tip.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
      const below = rect.bottom + 6;
      tip.style.top = `${Math.round(below + 30 > window.innerHeight ? rect.top - 32 : below)}px`;
    }, 160);
  };
  React.useEffect(() => () => { clearTimeout(quickHintTimer.current); quickHint.current?.remove(); }, []);

  // Alt+Up/Down while a scheme row is focused or hovered reorders it. This
  // listens on the window so the shortcut also works right after hovering the
  // handle (the dialog autofocus stays on its close button), and it prevents
  // the browser default: Chrome on macOS maps Option+Up/Down to page scrolling.
  const keyboardMoveRef = React.useRef(null);
  keyboardMoveRef.current = onKeyboardMove;
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      const active = document.activeElement;
      if (active?.matches?.("input, textarea, select")) return;
      // Only a focused drag handle (or one under the pointer) owns the shortcut:
      // pressing Alt+arrows in another row control should keep its native meaning.
      const anchor = (active?.matches?.("[data-drag-handle]") ? active : null) ?? hintAnchor.current;
      const id = anchor?.closest?.("[data-scheme-id]")?.getAttribute?.("data-scheme-id");
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      keyboardMoveRef.current?.(id, event.key === "ArrowUp" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);


  return <section aria-label={t("终端显示")} className="dsh-appearance-section">
    <style>{STYLES}</style>
    <div style={{ display: "contents" }} inert={transition ? "" : undefined} aria-hidden={transition ? true : undefined}>
    <div className="dsh-row"><span className="dsh-row-label">{t("显示模式")}</span>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[["system", t("跟随 DSH")], ["dark", t("深色")], ["light", t("浅色")]].map(([value, label]) => <label key={value}>
          <input type="radio" name={radioName} checked={settings.theme === value} onChange={() => setDisplaySettings({ theme: value })} />{label}</label>)}
        <label><input type="checkbox" checked={settings.highlightEnabled} onChange={event => setDisplaySettings({ highlightEnabled: event.target.checked })} />{t("启用语义高亮")}</label>
      </div>
    </div>
    <div className="dsh-row"><span className="dsh-row-label">{t("应用主题")}</span>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{["dark", "light"].map(mode => <label key={mode} className="dsh-theme-group" data-active={mode === resolved ? "true" : undefined}>
        {mode === "dark" ? t("深色") : t("浅色")}
        <select className="dsh-theme-select" aria-label={mode === "dark" ? t("深色主题") : t("浅色主题")} value={selectedThemeId(settings, mode)}
          onChange={event => attempt(() => selectDisplayTheme(mode, event.target.value))}>
          {themeOptions(settings, mode).map(item => <option key={item.id} value={item.id}>{labelFor(item)}</option>)}
        </select>{mode === resolved && <span className="dsh-pill">{t("当前显示")}</span>}
      </label>)}</div>
    </div>
    <p className="dsh-hint">{t("所有自定义主题均可用于深色或浅色；主题内的模式只是推荐值。应用主题不改变编辑中的草稿。")}</p>
    {!persistence.saved && <div role="alert" style={{ padding: 8, border: "1px solid #e5484d", borderRadius: 6 }}>
      {t("本次修改尚未写入本机，重新加载可能丢失。可重试保存或导出草稿。")}
      <button type="button" style={button} onClick={() => { if (pendingImport) confirmImport(); else if (isDirty()) saveEditor(); else attempt(retryDisplayPersistence); }}>{t("重试保存")}</button>
    </div>}
    {notice && <div role="status" style={{ padding: "6px 0", fontSize: 12 }}>{notice}</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
      <button type="button" className="dsh-text-button" onClick={() => openEditor(builtinTheme(resolved), true, true)}>{t("新建主题")}</button>
      <button type="button" className="dsh-text-button" onClick={() => setManagerOpen(value => !value)} aria-expanded={managerOpen}>{t("管理主题")}</button>
      <button type="button" className="dsh-text-button" onClick={backupLibrary}>{t("备份全部主题")}</button>
      <button type="button" className="dsh-text-button" onClick={() => { ++importSeq.current; setPendingImport(null); importRef.current?.click(); }}>{t("导入主题或备份")}</button>
      <button type="button" className="dsh-text-button" onClick={() => setConfirmReset(resolved)}>{t("恢复默认主题")}</button>
      <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={restoreBackup}
        onCancel={event => { event.stopPropagation(); ++importSeq.current; setPendingImport(null); setNotice(t("已取消选择文件。")); }} />
    </div>
    {managerOpen && <div aria-label={t("主题列表")} style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 6, padding: 8 }}>
      {[builtinTheme("dark"), builtinTheme("light"), ...allThemes(settings)].map(item => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ flex: "1 1 160px", overflowWrap: "anywhere" }}>{labelFor(item)}{item.id.startsWith("builtin:") ? t("（内置，只读）") : ""}</span>
        <button type="button" style={button} onClick={() => openEditor(item)}>{item.id.startsWith("builtin:") ? t("复制后编辑") : t("编辑")}</button>
        <button type="button" style={button} onClick={() => openEditor(item, true)}>{t("复制")}</button>
        <button type="button" style={button} onClick={() => exportRecord(item)}>{t("导出")}</button>
        {!item.id.startsWith("builtin:") && <>
          <button type="button" style={button} onClick={() => openEditor(item)}>{t("重命名")}</button>
          <button type="button" style={button} onClick={() => requestTransition(() => setPendingDelete(allThemes(getDisplaySettings()).find(record => record.id === item.id) ?? item), { destructive: editor.id === item.id })}>{t("删除")}</button>
        </>}
      </div>)}
    </div>}
    {pendingDelete && <div role="alertdialog" aria-label={t("删除主题确认")} style={{ padding: 10, border: "1px solid #e5484d", borderRadius: 6 }}>
      <p>{t(`删除主题：${pendingDelete.name}？使用它的深色或浅色显示将改用对应的 DSH 默认主题。其他主题不会被覆盖。`)}</p>
      <button type="button" style={button} onClick={() => {
        if (attempt(() => deleteDisplayTheme(null, pendingDelete.id, pendingDelete.revision))) {
          if (editor.id === pendingDelete.id) { pendingPatterns.current.clear(); replaceEditor(makeEditor(builtinTheme(resolved))); }
          setPendingDelete(null); setNotice(t("主题已删除。"));
        }
      }}>{t("确认删除")}</button>
      <button type="button" style={button} onClick={() => setPendingDelete(null)}>{t("取消")}</button>
    </div>}
    {confirmReset && <div role="alertdialog" aria-label={t("恢复默认主题确认")} style={{ padding: 10, border: "1px solid #2d6cdf", borderRadius: 6 }}>
      <p>{confirmReset === "dark" ? t("将深色显示改用 DSH 默认主题，已保存的自定义主题仍保留。") : t("将浅色显示改用 DSH 默认主题，已保存的自定义主题仍保留。")}</p>
      <button type="button" style={button} onClick={() => { if (attempt(() => selectDisplayTheme(confirmReset, `builtin:${confirmReset}`))) setConfirmReset(null); }}>{t("恢复默认")}</button>
      <button type="button" style={button} onClick={() => setConfirmReset(null)}>{t("取消")}</button>
    </div>}
    {pendingImport && <div role="dialog" aria-label={t("确认导入主题")} style={{ padding: 10, border: "1px solid #2d6cdf", borderRadius: 6, margin: "8px 0" }}>
      {pendingImport.kind === "theme" ? <>
        <p>{t("单主题文件。新增导入不会自动应用；更新已应用的主题会同步更新其显示。")}</p>
        <label>{t("主题名称")}<input aria-label={t("自定义主题名称")} value={pendingImport.name} maxLength={80} style={field}
          onChange={event => setPendingImport({ ...pendingImport, name: event.target.value })} /></label>
        <p>{pendingImport.record.theme === "dark" ? t("推荐深色，可在两个下拉框中选择。") : t("推荐浅色，可在两个下拉框中选择。")}
          {t(`背景：${pendingImport.record.background}；规则数：${pendingImport.record.entries.length}`)}</p>
        {pendingImport.conflicts.length > 0 && <p>{t("发现已有同名、同标识或同内容主题。可新增副本、更新已有主题，或跳过。")}</p>}
        <label><input type="radio" checked={pendingImport.strategy === "new"} onChange={() => setPendingImport({ ...pendingImport, strategy: "new" })} />{t("新增副本")}</label>
        <label><input type="radio" checked={pendingImport.strategy === "update"} onChange={() => setPendingImport({ ...pendingImport, strategy: "update" })} />{t("更新已有主题")}</label>
        {pendingImport.strategy === "update" && <select aria-label={t("更新目标主题")} value={pendingImport.targetId} style={field}
          onChange={event => { const target = allThemes(settings).find(item => item.id === event.target.value); setPendingImport({ ...pendingImport, targetId: target?.id ?? "", targetRevision: target?.revision }); }}>
          <option value="">{t("选择更新目标")}</option>{allThemes(settings).map(item => <option key={item.id} value={item.id}>{labelFor(item)}</option>)}
        </select>}
      </> : <>
        <p>{t(`完整主题库备份，包含 ${pendingImport.themes.length} 个自定义主题。`)}</p>
        <label><input type="radio" checked={pendingImport.strategy !== "replace"} onChange={() => setPendingImport({ ...pendingImport, strategy: "new" })} />{t("合并导入，不覆盖现有主题或显示选择")}</label><br />
        <label><input type="radio" checked={pendingImport.strategy === "replace"} onChange={() => setPendingImport({ ...pendingImport, strategy: "replace" })} />{t("完整恢复：替换主题库、深浅选择和显示设置。建议先备份当前主题库。")}</label>
      </>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" style={button} disabled={pendingImport.kind === "theme" && (!themeName(pendingImport.name) || (pendingImport.strategy === "update" && !pendingImport.targetId))} onClick={confirmImport}>{t("确认导入")}</button>
        <button type="button" style={button} onClick={() => { setPendingImport(null); setNotice(t("已跳过导入。")); }}>{t("跳过／取消")}</button>
      </div>
    </div>}
    <div style={{ borderTop: "1px solid var(--dsh-ssh-ops-border, #3a414b)", marginTop: 12, paddingTop: 10 }}>
      <div className="dsh-row"><span className="dsh-row-label">{t("正在编辑")}</span>
        <select aria-label={t("编辑目标主题")} style={field} value={editor.sourceId ?? "new"} onChange={event => {
          const record = [builtinTheme("dark"), builtinTheme("light"), ...allThemes(settings)].find(item => item.id === event.target.value);
          if (record) openEditor(record);
        }}>
          {!editor.sourceId && <option value="new">{t("未保存的新主题")}</option>}
          {[builtinTheme("dark"), builtinTheme("light"), ...allThemes(settings)].map(item => <option key={item.id} value={item.id}>{labelFor(item)}</option>)}
        </select>
      </div>
      <div className="dsh-row"><label className="dsh-row-label" htmlFor={`${radioName}-name`}>{t("主题名称")}</label>
        <input id={`${radioName}-name`} aria-label={t("编辑主题名称")} style={field} maxLength={80} value={editor.draft.name} onChange={event => updateDraft({ name: event.target.value })} />
      </div>
      <div className="dsh-row"><span className="dsh-row-label">{t("推荐模式")}</span>
        <select aria-label={t("推荐模式")} style={field} value={editor.draft.theme} onChange={event => updateDraft({ theme: event.target.value })}>
          <option value="dark">{t("深色")}</option><option value="light">{t("浅色")}</option>
        </select>
      </div>
      <div className="dsh-row"><span className="dsh-row-label">{t("草稿背景")}</span><BackgroundField value={editor.draft.background}
        onChange={background => updateDraft({ background })} onReset={() => updateDraft({ background: DEFAULT_BACKGROUNDS[editor.draft.theme] })} resetLabel={t("恢复推荐模式的默认背景")} /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <button type="button" style={button} disabled={!dirty || !themeName(editor.draft.name)} onClick={() => saveEditor()}>{editor.id ? t("保存主题") : t("保存为新主题")}</button>
        <button type="button" style={button} disabled={!themeName(editor.draft.name)} onClick={() => saveEditor(true)}>{t("另存为新主题")}</button>
        <button type="button" style={button} disabled={!dirty} onClick={discardEditor}>{t("放弃修改")}</button>
        <button type="button" style={button} disabled={!themeName(editor.draft.name)} onClick={() => exportRecord({ ...composedDraft(), id: editor.id ?? undefined })}>{dirty ? t("导出草稿") : t("导出此主题")}</button>
        <span className="dsh-pill">{dirty ? t("未保存") : t("已保存／未修改")}</span>
      </div>
      <p className="dsh-hint">{t("下方仅预览编辑草稿，不影响实时终端。保存已应用的自定义主题后，使用该主题的深浅显示会一起更新。完整备份不包含未保存草稿。")}</p>
    </div>
    <fieldset className="dsh-scheme-fieldset">
      <div className="dsh-scheme-fill">
        <p className="dsh-hint">{t("拖动左侧手柄排序，点击标签编辑。")}</p>
        <div ref={listRef} className="dsh-scheme-list" onClickCapture={onListClickCapture} onScroll={hideQuickHint}>
          {entries.map(entry => {
            const custom = !Object.hasOwn(labels, entry.id), label = custom ? entry.name || t("自定义配色项") : labels[entry.id];
            return <SchemeEntry key={`${editor.token}:${entry.id}`} entry={entry} label={label} dragging={dragId === entry.id}
              rowRef={element => { if (element) rows.current.set(entry.id, element); else rows.current.delete(entry.id); }}
              onPatternDraft={value => patternDraft(entry.id, value)} onChange={patch => change(entry.id, patch)} onHandlePointerDown={(event) => onHandlePointerDown(event, entry.id)} onShowHint={showQuickHint} onHideHint={hideQuickHint}
              onDelete={custom ? () => updateEntries(scheme => scheme.filter(item => item.id !== entry.id)) : undefined} />;
          })}<div ref={indicator} className="dsh-drop-indicator" aria-hidden="true" />
        </div>
        <button type="button" style={{ ...button, alignSelf: "flex-start", marginTop: 8 }} disabled={Boolean(pendingEntry) || entries.length >= MAX_SCHEME_ENTRIES} onClick={addEntry}>{t("添加配色项")}</button>
      </div>
    </fieldset>
    <div className="dsh-section-title" style={{ margin: "12px 0 8px" }}>{t("草稿预览")}</div>
    <EditablePreview text={preview} onChange={setPreview} theme={activeTheme} entries={entries} />
    </div>
    {transition && <div ref={transitionRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label={t("未保存的主题修改")}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setTransition(null); }
        if (event.key === "Tab") {
          const buttons = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
          const first = buttons[0], last = buttons.at(-1), active = document.activeElement;
          if (event.shiftKey && (active === first || active === event.currentTarget)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && active === last) { event.preventDefault(); first?.focus(); }
        }
      }} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(560px, calc(100vw - 64px))", boxSizing: "border-box", padding: 16, zIndex: 100, background: "var(--dsh-ssh-ops-surface, #161b21)", color: "var(--dsh-ssh-ops-text, #d7dbe2)", boxShadow: "0 0 0 100vmax rgba(0,0,0,.3)", border: "2px solid #2d6cdf", borderRadius: 8 }}>
      <p>{transition.destructive ? t("此操作会删除或替换已保存主题。请先导出草稿，或放弃修改后继续。") : t("当前草稿尚未保存。请选择保存后继续、放弃修改后继续，或取消。")}</p>
      <button type="button" style={button} onClick={() => { const ok = transition.destructive ? exportRecord({ ...composedDraft(), id: editor.id ?? undefined }) : saveEditor(); if (ok) { const run = transition.run; setTransition(null); run(); } }}>{transition.destructive ? t("导出草稿后继续") : t("保存后继续")}</button>
      <button type="button" style={button} onClick={() => { const run = transition.run; discardEditor(); setTransition(null); run(); }}>{t("放弃修改后继续")}</button>
      <button type="button" style={button} onClick={() => setTransition(null)}>{t("取消")}</button>
    </div>}
  </section>;

}
