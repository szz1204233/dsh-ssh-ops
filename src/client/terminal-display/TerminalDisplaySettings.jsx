import * as React from "react";
import { t } from "../../i18n/core.js";
import { useLanguage } from "../locale.js";
import { getDisplaySettings, setDisplaySettings, subscribeDisplaySettings, updateScheme, resetScheme } from "./settings.js";
import { terminalTheme, resolveDisplayTheme, subscribeHostTheme, getHostTheme } from "./theme.js";
import { getScheme, exportScheme, MAX_SCHEME_ENTRIES } from "./scheme.js";
import { EditablePreview } from "./EditablePreview.jsx";
import { PatternTags } from "./PatternTags.jsx";

const PREVIEW_TEXT = 'demo@host:~$ cat --lines=42 /var/log/app.log\n2026-10-30 12:30:15 ERROR connection refused\nSUCCESS service started 192.168.1.10\ndebug retries=42 "text"\ndrwxr-xr-x demo logs';
const button = { padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "inherit", background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" };
const field = { boxSizing: "border-box", minWidth: 0, padding: "6px 8px", borderRadius: 5, fontSize: 12, color: "inherit",
  background: "var(--dsh-ssh-ops-input, #101418)", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" };
function SchemeEntry({ entry, label, onChange, onDelete, onDragStart, onDragOver, onDrop, onDragEnd, dragging, dropSide, onKeyboardMove }) {
  const [hex, setHex] = React.useState(entry.color);
  const toggleId = React.useId();
  React.useEffect(() => setHex(entry.color), [entry.color]);
  return <div className="dsh-scheme-row" data-scheme-id={entry.id} onDragOver={onDragOver} onDrop={onDrop}
    style={{ display: "grid", gridTemplateColumns: "20px 144px minmax(0, 1fr) 32px 82px 22px", gap: 8, alignItems: "start", padding: "10px 0",
      borderBottom: "1px solid var(--dsh-ssh-ops-border, #3a414b)", opacity: dragging ? 0.45 : 1,
      boxShadow: dropSide === "before" ? "0 -2px 0 var(--dsw-alias-button-primary-fill, #2d6cdf)" : dropSide === "after" ? "0 2px 0 var(--dsw-alias-button-primary-fill, #2d6cdf)" : undefined }}>
    <button type="button" draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      aria-label={t(`拖动排序 ${label}`)} title={t("拖动排序；也可使用 Alt + 方向键")}
      onKeyDown={(event) => { if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); onKeyboardMove(event.key === "ArrowUp" ? -1 : 1); } }}
      style={{ border: 0, background: "transparent", color: "var(--dsh-ssh-ops-muted, #8b93a1)", cursor: "grab", padding: "7px 0" }}>
      <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="4" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="10" cy="12" r="1"/></svg>
    </button>
    <div className="dsh-scheme-name" style={{ minWidth: 0, paddingTop: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
        <input id={toggleId} type="checkbox" checked={entry.enabled} aria-label={t(`启用 ${label}`)} onChange={(event) => onChange({ enabled: event.target.checked })} />
        {onDelete ? <input aria-label={t("配色项名称")} value={entry.name} placeholder={t("自定义配色项")} maxLength={80} onChange={(event) => onChange({ name: event.target.value })} style={{ ...field, width: "100%", padding: "3px 4px" }} /> : <label htmlFor={toggleId}>{label}</label>}
      </div>
      <button type="button" disabled={!entry.enabled} aria-label={t(`${label} 区分大小写`)} aria-pressed={entry.caseSensitive} title={t("区分大小写")}
        onClick={() => onChange({ caseSensitive: !entry.caseSensitive })}
        style={{ ...button, margin: "5px 0 0 22px", padding: "0 5px", lineHeight: "18px", opacity: entry.caseSensitive ? 1 : 0.55 }}>Aa</button>
    </div>
    <div className="dsh-scheme-patterns" style={{ minWidth: 0 }}><PatternTags label={label} text={entry.text} disabled={!entry.enabled} onChange={(text) => onChange({ text, mode: "regex" })} /></div>
    <input type="color" aria-label={label} value={entry.color} disabled={!entry.enabled} onChange={(event) => onChange({ color: event.target.value })}
      style={{ width: 32, height: 30, padding: 2, background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 4 }} />
    <input aria-label={label + " HEX"} value={hex} disabled={!entry.enabled} maxLength={7} spellCheck={false}
      onChange={(event) => { setHex(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange({ color: event.target.value }); }} onBlur={() => setHex(entry.color)}
      style={{ ...field, width: 82, padding: "6px", fontFamily: "monospace" }} />
    {onDelete ? <button type="button" style={{ ...button, border: 0, padding: "5px 2px" }} aria-label={t(`删除配色项 ${label}`)} onClick={onDelete}>×</button> : <span />}
  </div>;
}
export function TerminalDisplaySettings() {
  useLanguage();
  const settings = React.useSyncExternalStore(subscribeDisplaySettings, getDisplaySettings);
  React.useSyncExternalStore(subscribeHostTheme, getHostTheme);
  const [preview, setPreview] = React.useState(PREVIEW_TEXT);
  const [backupStatus, setBackupStatus] = React.useState(false);
  const radioName = React.useId(), resolved = resolveDisplayTheme(settings.theme);
  const entries = React.useMemo(() => getScheme(settings, resolved), [settings, resolved]);
  const dragged = React.useRef(null);
  const [dragId, setDragId] = React.useState(null);
  const [drop, setDrop] = React.useState(null);
  const finishDrag = () => { dragged.current = null; setDragId(null); setDrop(null); };
  React.useEffect(() => { dragged.current = null; setDragId(null); setDrop(null); }, [resolved]);
  const labels = { error: t("错误与否定"), success: t("成功与肯定"), warning: t("警示状态"), info: t("信息关键词"),
    heading: t("地址、时间与符号"), number: t("数字"), string: t("字符串与路径"), option: t("命令选项"), command: t("命令名称"), debug: t("文件类型"), prompt: t("提示符") };
  const change = (id, patch) => updateScheme(resolved, (scheme) => scheme.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  const move = (id, target, side = "before") => updateScheme(resolved, (scheme) => {
    const moved = scheme.find((entry) => entry.id === id);
    if (!moved || id === target) return scheme;
    const next = scheme.filter((entry) => entry.id !== id), index = next.findIndex((entry) => entry.id === target);
    if (index < 0) return scheme;
    next.splice(index + (side === "after" ? 1 : 0), 0, moved); return next;
  });
  const backup = () => {
    const url = URL.createObjectURL(new Blob([exportScheme(getDisplaySettings(), resolved)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `dsh-ssh-ops-${resolved}-scheme-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupStatus(true);
  };
  return <section aria-label={t("终端显示")} style={{ padding: "4px 20px 20px", color: "var(--dsh-ssh-ops-text, #d7dbe2)" }}>
    <style>{`@media (max-width: 720px) { .dsh-scheme-row { grid-template-columns: 20px minmax(0, 1fr) 32px 82px 22px !important; } .dsh-scheme-patterns { grid-column: 2 / -1; grid-row: 2; } }`}</style>
    <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.6, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("适用于所有 SSH 终端，修改后自动保存。")}</p>
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
      <legend style={{ fontSize: 13, marginBottom: 10 }}>{t("终端主题")}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {[["system", t("跟随 DSH")], ["dark", t("深色")], ["light", t("浅色")]].map(([value, label]) => <label key={value} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
          <input type="radio" name={radioName} value={value} checked={settings.theme === value} onChange={() => { setDisplaySettings({ theme: value }); setBackupStatus(false); }} />{label}
        </label>)}
      </div>
    </fieldset>
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={settings.highlightEnabled} onChange={(event) => setDisplaySettings({ highlightEnabled: event.target.checked })} />{t("启用语义高亮")}
    </label>
    {settings.highlightEnabled && <>
      <h4 style={{ fontSize: 13, margin: "20px 0 10px" }}>{t("配色方案")}</h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={button} onClick={() => resetScheme(resolved)}>{t("恢复当前主题默认配色方案")}</button>
        <button type="button" style={button} onClick={backup}>{t("备份当前配色方案")}</button>
      </div>
      {backupStatus && <div role="status" style={{ fontSize: 11, marginTop: 8 }}>{t("已导出当前主题配色方案（JSON）。")}</div>}
      <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{resolved === "light" ? t("正在编辑浅色主题。") : t("正在编辑深色主题。")}{" "}{t("每个标签是一个关键词或正则，无需 / 分隔符。Enter 添加，点击标签编辑，拖动左侧手柄调整优先级。")}</p>
      {entries.map((entry, index) => {
        const custom = !Object.hasOwn(labels, entry.id), label = custom ? (entry.name || t("自定义配色项")) : labels[entry.id];
        return <SchemeEntry key={`${resolved}:${entry.id}`} entry={entry} label={label} dragging={dragId === entry.id} dropSide={drop?.id === entry.id ? drop.side : undefined}
          onChange={(patch) => change(entry.id, patch)}
          onDragStart={(event) => { dragged.current = entry.id; setDragId(entry.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", entry.id); }}
          onDragEnd={finishDrag}
          onDragOver={(event) => {
            if (!dragged.current || dragged.current === entry.id) return;
            event.preventDefault(); event.dataTransfer.dropEffect = "move";
            const rect = event.currentTarget.getBoundingClientRect();
            setDrop({ id: entry.id, side: event.clientY < rect.top + rect.height / 2 ? "before" : "after" });
          }}
          onDrop={(event) => { if (dragged.current) { event.preventDefault(); move(dragged.current, entry.id, drop?.id === entry.id ? drop.side : "before"); finishDrag(); } }}
          onKeyboardMove={(direction) => { const target = entries[index + direction]; if (target) move(entry.id, target.id, direction > 0 ? "after" : "before"); }}
          onDelete={custom ? () => updateScheme(resolved, (scheme) => scheme.filter((item) => item.id !== entry.id)) : undefined} />;
      })}
      <button type="button" disabled={entries.length >= MAX_SCHEME_ENTRIES} style={{ ...button, marginTop: 12 }} onClick={() => updateScheme(resolved, (scheme) => [...scheme, {
        id: `custom:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, name: "", enabled: true,
        color: entries.find((entry) => entry.id === "error")?.color ?? "#f44747", mode: "regex", caseSensitive: false, text: ""
      }])}>{t("添加配色项")}</button>
      <div style={{ fontSize: 12, margin: "20px 0 8px" }}>{t("配色预览")}</div>
      <EditablePreview text={preview} onChange={setPreview} theme={terminalTheme(settings.theme)} entries={entries} />
    </>}
  </section>;
}
