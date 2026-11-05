import * as React from "react";
import { t } from "../../i18n/core.js";
import { useLanguage } from "../locale.js";
import { getDisplaySettings, setDisplaySettings, subscribeDisplaySettings, setDisplayColor, resetDisplayColors } from "./settings.js";
import { terminalTheme, resolveDisplayTheme, subscribeHostTheme, getHostTheme } from "./theme.js";
import { colorsForTheme, HIGHLIGHT_RULES } from "./rules.js";
import { compileCustomRules } from "./custom-rules.js";
import { matchText } from "./matcher.js";
import { CustomHighlightRules, appearanceButtonStyle } from "./CustomHighlightRules.jsx";

const PREVIEW_TEXT = 'demo@host:~$ cat --lines=42 /var/log/app.log\n2026-10-30 12:30:15 ERROR connection refused\nSUCCESS service started 192.168.1.10\ndebug retries=42 "text"\ndrwxr-xr-x demo logs';
function previewLine(text, colors, enabled, rules) {
  if (!enabled) return text;
  const parts = [];
  let end = 0;
  for (const span of matchText(text, rules, colors)) {
    parts.push(text.slice(end, span.start));
    parts.push(<span key={span.start} style={{ color: span.color }}>{text.slice(span.start, span.end)}</span>);
    end = span.end;
  }
  parts.push(text.slice(end));
  return parts;
}
function ColorSetting({ label, example, value, onChange }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 36px 92px", gap: 8, alignItems: "center", marginTop: 12 }}>
    <div style={{ minWidth: 0 }}><div style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 11, marginTop: 3, color: "var(--dsh-ssh-ops-muted, #8b93a1)", overflowWrap: "anywhere" }}>{example}</div>
    </div>
    <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}
      style={{ width: 36, height: 30, padding: 2, background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 4, cursor: "pointer" }} />
    <input type="text" aria-label={label + " HEX"} value={draft} maxLength={7} spellCheck={false}
      onChange={(event) => { const next = event.target.value; setDraft(next); if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next); }} onBlur={() => setDraft(value)}
      style={{ width: 92, boxSizing: "border-box", padding: 6, borderRadius: 4, fontFamily: "monospace", fontSize: 12,
        background: "var(--dsh-ssh-ops-input, #101418)", color: "inherit", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" }} />
  </div>;
}
export function TerminalDisplaySettings() {
  useLanguage();
  const settings = React.useSyncExternalStore(subscribeDisplaySettings, getDisplaySettings);
  React.useSyncExternalStore(subscribeHostTheme, getHostTheme);
  const [preview, setPreview] = React.useState(PREVIEW_TEXT);
  const radioName = React.useId();
  const resolved = resolveDisplayTheme(settings.theme);
  const theme = terminalTheme(settings.theme), colors = colorsForTheme(resolved, settings.colors?.[resolved]);
  const rules = React.useMemo(() => [...compileCustomRules(settings.customRules), ...(settings.builtinEnabled === false ? [] : HIGHLIGHT_RULES)], [settings.customRules, settings.builtinEnabled]);
  const labels = [
    ["error", t("错误与否定"), "ERROR / false"], ["success", t("成功与肯定"), "SUCCESS / true"],
    ["warning", t("警示状态"), "debug / stopped"], ["info", t("信息关键词"), "connection / info"],
    ["heading", t("地址、时间与符号"), "192.168.1.10 / 2026-10-30"], ["number", t("数字"), "42 / 3.14"],
    ["string", t("字符串与路径"), '"text" / /var/log'], ["option", t("命令选项"), "--timeout"],
    ["command", t("命令名称"), "cat / grep"], ["debug", t("文件类型"), "d / l"], ["prompt", t("提示符"), "$ / #"]
  ];
  return <section aria-label={t("终端显示")} style={{ padding: "4px 20px 20px", color: "var(--dsh-ssh-ops-text, #d7dbe2)" }}>
    <p style={{ margin: "0 0 18px", fontSize: 12, lineHeight: 1.6, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("适用于所有 SSH 终端，修改后自动保存。")}</p>
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 18px" }}>
      <legend style={{ fontSize: 13, marginBottom: 10 }}>{t("终端主题")}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {[["system", t("跟随 DSH")], ["dark", t("深色")], ["light", t("浅色")]].map(([value, label]) =>
          <label key={value} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
            <input type="radio" name={radioName} value={value} checked={settings.theme === value} onChange={() => setDisplaySettings({ theme: value })} />{label}
          </label>)}
      </div>
    </fieldset>
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={settings.highlightEnabled} onChange={(event) => setDisplaySettings({ highlightEnabled: event.target.checked })} />{t("启用语义高亮")}
    </label>
    <p style={{ fontSize: 12, margin: "8px 0 18px", lineHeight: 1.6, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("按关键词、地址、时间等类型着色，保留服务器原有样式。")}</p>
    <details style={{ margin: "18px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 500 }}>{t("自定义颜色")}</summary>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("支持颜色选择器或 #RRGGBB，按主题分别保存。")}{" "}{resolved === "light" ? t("正在编辑浅色主题。") : t("正在编辑深色主题。")}</p>
      <button type="button" onClick={() => resetDisplayColors(resolved)} disabled={!Object.keys(settings.colors?.[resolved] ?? {}).length} style={appearanceButtonStyle}>{t("恢复当前主题默认颜色")}</button>
      {labels.map(([key, label, example]) => <ColorSetting key={`${resolved}-${key}`} label={label} example={example} value={colors[key]} onChange={(color) => setDisplayColor(resolved, key, color)} />)}
    </details>
    <CustomHighlightRules settings={settings} labels={labels} colors={colors} />
    <div style={{ fontSize: 12, margin: "18px 0 8px" }}>{t("配色预览")}</div>
    <pre aria-label={t("配色预览")} style={{ background: theme.background, color: theme.foreground, padding: 12,
      border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 6, fontSize: 12, lineHeight: 1.7, overflow: "auto", margin: 0 }}>
      {preview.split("\n").map((text, index) => <React.Fragment key={index}>{index > 0 ? "\n" : ""}{previewLine(text, colors, settings.highlightEnabled, rules)}</React.Fragment>)}
    </pre>
    <details style={{ marginTop: 12 }}><summary style={{ fontSize: 12, cursor: "pointer" }}>{t("编辑预览文本")}</summary>
      <textarea aria-label={t("预览文本")} value={preview} maxLength={2048} onChange={(event) => setPreview(event.target.value)} rows={5}
        style={{ boxSizing: "border-box", width: "100%", resize: "vertical", marginTop: 8, padding: 8, fontFamily: "monospace", fontSize: 12,
          color: "inherit", background: "var(--dsh-ssh-ops-input, #101418)", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 5 }} />
    </details>
  </section>;
}
