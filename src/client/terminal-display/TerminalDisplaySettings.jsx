import * as React from "react";
import { t } from "../../i18n/core.js";
import { useLanguage } from "../locale.js";
import { getDisplaySettings, setDisplaySettings, subscribeDisplaySettings, setDisplayColor, resetDisplayColors } from "./settings.js";
import { terminalTheme } from "./theme.js";
import { colorsForTheme } from "./rules.js";
import { matchText } from "./matcher.js";

const PREVIEW_LINES = [
  'demo@host:~$ cat --lines=42 /var/log/app.log',
  '2026-10-30 12:30:15 ERROR connection refused',
  'SUCCESS service started 192.168.1.10',
  'debug retries=42 "text"',
  'drwxr-xr-x demo logs'
];

function previewLine(text, colors, enabled) {
  if (!enabled) return text;
  const parts = [];
  let end = 0;
  for (const span of matchText(text, undefined, colors)) {
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
      onChange={(event) => { const next = event.target.value; setDraft(next); if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next); }}
      onBlur={() => setDraft(value)}
      style={{ width: 92, boxSizing: "border-box", padding: "6px", borderRadius: 4, fontFamily: "monospace", fontSize: 12,
        background: "var(--dsh-ssh-ops-input, #101418)", color: "inherit", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" }} />
  </div>;
}

export function TerminalDisplaySettings() {
  useLanguage();
  const settings = React.useSyncExternalStore(subscribeDisplaySettings, getDisplaySettings);
  const radioName = React.useId();
  const theme = terminalTheme(settings.theme), colors = colorsForTheme(settings.theme, settings.colors?.[settings.theme]);
  return <section style={{ padding: 20, overflow: "auto", width: "100%", boxSizing: "border-box", color: "var(--dsh-ssh-ops-text, #d7dbe2)" }}>
    <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{t("终端显示")}</h3>
    <p style={{ margin: "0 0 24px", fontSize: 12, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("适用于所有 SSH 终端，修改后自动保存。")}</p>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={settings.highlightEnabled}
        onChange={(event) => setDisplaySettings({ highlightEnabled: event.target.checked })} />
      {t("启用语义高亮")}
    </label>
    <p style={{ fontSize: 12, margin: "8px 0 24px", color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("按关键词、地址、时间等类型着色，保留服务器原有样式。")}</p>
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 24px" }}>
      <legend style={{ fontSize: 13, marginBottom: 12 }}>{t("终端主题")}</legend>
      <div style={{ display: "flex", gap: 24 }}>
        {[["dark", t("深色")], ["light", t("浅色")]].map(([value, label]) =>
          <label key={value} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
            <input type="radio" name={radioName} value={value} checked={settings.theme === value}
              onChange={() => setDisplaySettings({ theme: value })} />{label}
          </label>)}
      </div>
    </fieldset>
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h4 style={{ fontSize: 14, margin: 0 }}>{t("高亮颜色")}</h4>
        <button type="button" onClick={() => resetDisplayColors(settings.theme)}
          disabled={!Object.keys(settings.colors?.[settings.theme] ?? {}).length}
          style={{ padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "inherit",
            background: "var(--dsh-ssh-ops-tab, #1a1f26)", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" }}>
          {t("恢复当前主题默认颜色")}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--dsh-ssh-ops-muted, #8b93a1)" }}>{t("支持颜色选择器或 #RRGGBB，按主题分别保存。")}</p>
      {[
        ["error", t("错误与否定"), "ERROR / false"],
        ["success", t("成功与肯定"), "SUCCESS / true"],
        ["warning", t("警示状态"), "debug / stopped"],
        ["info", t("信息关键词"), "connection / info"],
        ["heading", t("地址、时间与符号"), "192.168.1.10 / 2026-10-30"],
        ["number", t("数字"), "42 / 3.14"],
        ["string", t("字符串与路径"), '"text" / /var/log'],
        ["option", t("命令选项"), "--timeout"],
        ["command", t("命令名称"), "cat / grep"],
        ["debug", t("文件类型"), "d / l"],
        ["prompt", t("提示符"), "$ / #"]
      ].map(([key, label, example]) => <ColorSetting key={`${settings.theme}-${key}`} label={label} example={example} value={colors[key]}
        onChange={(color) => setDisplayColor(settings.theme, key, color)} />)}
    </div>
    <div style={{ fontSize: 12, marginBottom: 8 }}>{t("配色预览")}</div>
    <pre aria-label={t("配色预览")} style={{ background: theme.background, color: theme.foreground, padding: 16,
      border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 8, fontSize: 12, lineHeight: 1.8, overflow: "auto", margin: 0 }}>
      {PREVIEW_LINES.map((text, index) => <React.Fragment key={text}>
        {index > 0 ? "\n" : ""}{previewLine(text, colors, settings.highlightEnabled)}
      </React.Fragment>)}
    </pre>
  </section>;
}
