import * as React from "react";
import { t } from "../../i18n/core.js";
import { useLanguage } from "../locale.js";
import { getDisplaySettings, setDisplaySettings, subscribeDisplaySettings, updateScheme, resetScheme } from "./settings.js";
import { terminalTheme, resolveDisplayTheme, subscribeHostTheme, getHostTheme } from "./theme.js";
import { compileScheme, getScheme, exportScheme, MAX_SCHEME_ENTRIES, MAX_SCHEME_TEXT } from "./scheme.js";
import { EditablePreview } from "./EditablePreview.jsx";

const PREVIEW_TEXT = 'demo@host:~$ cat --lines=42 /var/log/app.log\n2026-10-30 12:30:15 ERROR connection refused\nSUCCESS service started 192.168.1.10\ndebug retries=42 "text"\ndrwxr-xr-x demo logs';
const button = { padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "inherit", background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" };
const field = { boxSizing: "border-box", minWidth: 0, padding: "6px 8px", borderRadius: 5, fontSize: 12, color: "inherit",
  background: "var(--dsh-ssh-ops-input, #101418)", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" };
function SchemeEntry({ entry, label, onChange, onDelete, onMove, first, last }) {
  const [hex, setHex] = React.useState(entry.color);
  const toggleId = React.useId();
  React.useEffect(() => setHex(entry.color), [entry.color]);
  return <div style={{ padding: "14px 0", borderBottom: "1px solid var(--dsh-ssh-ops-border, #3a414b)" }}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 32px 86px", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, minWidth: 0 }}>
        <input id={toggleId} type="checkbox" checked={entry.enabled} aria-label={t(`启用 ${label}`)} onChange={(event) => onChange({ enabled: event.target.checked })} />
        {onDelete ? <input aria-label={t("配色项名称")} value={entry.name} placeholder={t("自定义配色项")} maxLength={80}
          onChange={(event) => onChange({ name: event.target.value })} style={{ ...field, width: "100%" }} /> : <label htmlFor={toggleId}>{label}</label>}
      </div>
      <input type="color" aria-label={label} value={entry.color} disabled={!entry.enabled} onChange={(event) => onChange({ color: event.target.value })}
        style={{ width: 32, height: 30, padding: 2, background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 4 }} />
      <input aria-label={label + " HEX"} value={hex} disabled={!entry.enabled} maxLength={7} spellCheck={false}
        onChange={(event) => { setHex(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange({ color: event.target.value }); }} onBlur={() => setHex(entry.color)}
        style={{ ...field, width: 86, padding: "6px", fontFamily: "monospace" }} />
    </div>
    <textarea aria-label={t(`${label} 匹配文本`)} value={entry.text} rows={2} maxLength={MAX_SCHEME_TEXT} disabled={!entry.enabled} spellCheck={false}
      placeholder={entry.mode === "auto" ? t("自动识别；可补充匹配文本，每行一项") : t("匹配文本，每行一项")}
      onChange={(event) => onChange({ text: event.target.value })} style={{ ...field, width: "100%", resize: "vertical", marginTop: 8, fontFamily: "monospace", lineHeight: 1.5 }} />
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 7, fontSize: 11 }}>
      <select aria-label={t(`${label} 匹配方式`)} value={entry.mode} disabled={!entry.enabled} onChange={(event) => onChange({ mode: event.target.value })} style={{ ...field, padding: "4px" }}>
        {!onDelete && <option value="auto">{t("自动识别")}</option>}<option value="contains">{t("包含文本")}</option><option value="word">{t("完整词")}</option>
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 3 }}><input type="checkbox" checked={entry.caseSensitive} disabled={!entry.enabled} onChange={(event) => onChange({ caseSensitive: event.target.checked })} />{t("区分大小写")}</label>
      <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
        <button type="button" disabled={first} style={{ ...button, padding: "2px 6px" }} aria-label={t(`上移配色项 ${label}`)} onClick={() => onMove(-1)}>↑</button>
        <button type="button" disabled={last} style={{ ...button, padding: "2px 6px" }} aria-label={t(`下移配色项 ${label}`)} onClick={() => onMove(1)}>↓</button>
        {onDelete && <button type="button" style={{ ...button, padding: "2px 6px" }} aria-label={t(`删除配色项 ${label}`)} onClick={onDelete}>×</button>}
      </div>
    </div>
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
  const compiled = React.useMemo(() => compileScheme(entries), [entries]);
  const labels = { error: t("错误与否定"), success: t("成功与肯定"), warning: t("警示状态"), info: t("信息关键词"),
    heading: t("地址、时间与符号"), number: t("数字"), string: t("字符串与路径"), option: t("命令选项"), command: t("命令名称"), debug: t("文件类型"), prompt: t("提示符") };
  const change = (id, patch) => updateScheme(resolved, (scheme) => scheme.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  const move = (id, direction) => updateScheme(resolved, (scheme) => {
    const next = [...scheme], index = next.findIndex((entry) => entry.id === id), target = index + direction;
    if (index >= 0 && target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
    return next;
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
    <p style={{ margin: "0 0 18px", fontSize: 12, lineHeight: 1.6, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("适用于所有 SSH 终端，修改后自动保存。")}</p>
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 18px" }}>
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
      <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{resolved === "light" ? t("正在编辑浅色主题。") : t("正在编辑深色主题。")}{" "}{t("每行填写一个匹配文本，靠前的配色项优先。自动识别可补充文本；其他方式只匹配填写的内容。")}</p>
      {entries.map((entry, index) => {
        const custom = !Object.hasOwn(labels, entry.id), label = custom ? (entry.name || t("自定义配色项")) : labels[entry.id];
        return <SchemeEntry key={`${resolved}:${entry.id}`} entry={entry} label={label} first={index === 0} last={index === entries.length - 1}
          onChange={(patch) => change(entry.id, patch)} onMove={(direction) => move(entry.id, direction)}
          onDelete={custom ? () => updateScheme(resolved, (scheme) => scheme.filter((item) => item.id !== entry.id)) : undefined} />;
      })}
      <button type="button" disabled={entries.length >= MAX_SCHEME_ENTRIES} style={{ ...button, marginTop: 12 }} onClick={() => updateScheme(resolved, (scheme) => [...scheme, {
        id: `custom:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, name: "", enabled: true,
        color: compiled.colors.error ?? "#f44747", mode: "contains", caseSensitive: false, text: ""
      }])}>{t("添加配色项")}</button>
      <div style={{ fontSize: 12, margin: "20px 0 8px" }}>{t("配色预览")}</div>
      <EditablePreview text={preview} onChange={setPreview} theme={terminalTheme(settings.theme)} colors={compiled.colors} rules={compiled.rules} />
    </>}
  </section>;
}
