import * as React from "react";
import { t } from "../../i18n/core.js";
import { saveDisplayRule, deleteDisplayRule, moveDisplayRule, setDisplaySettings } from "./settings.js";
import { MAX_CUSTOM_RULES, MAX_RULE_TEXT } from "./custom-rules.js";

const field = { boxSizing: "border-box", width: "100%", minWidth: 0, padding: "6px 8px", borderRadius: 5,
  border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", background: "var(--dsh-ssh-ops-input, #101418)", color: "inherit", fontSize: 12 };
export const appearanceButtonStyle = { padding: "4px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "inherit",
  background: "transparent", border: "1px solid var(--dsh-ssh-ops-border, #3a414b)" };
const empty = () => ({ id: "", text: "", match: "contains", color: "error", caseSensitive: false, enabled: true });

export function CustomHighlightRules({ settings, labels, colors }) {
  const [draft, setDraft] = React.useState(empty);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState("");
  const rules = settings.customRules ?? [];
  const save = (event) => {
    event.preventDefault();
    const rule = { ...draft, id: draft.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) };
    if (!saveDisplayRule(rule)) { setError(t("请输入有效文本，最多 128 个字符；最多保存 32 条规则。")); return; }
    setDraft(empty()); setEditing(false); setError("");
  };
  return <details style={{ margin: "18px 0" }}>
    <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 500 }}>{t("自定义规则")}{rules.length ? ` (${rules.length})` : ""}</summary>
    <p style={{ fontSize: 12, color: "var(--dsh-ssh-ops-muted, #8b93a1)", lineHeight: 1.6 }}>{t("按字面文本匹配，自定义规则优先于内置规则，列表靠前的规则优先。保存后应用于所有终端和两套主题。")}</p>
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
      <input type="checkbox" checked={settings.builtinEnabled !== false}
        onChange={(event) => setDisplaySettings({ builtinEnabled: event.target.checked })} />{t("使用内置高亮规则")}
    </label>
    {rules.map((rule, index) => <div key={rule.id} style={{ borderBottom: "1px solid var(--dsh-ssh-ops-border, #3a414b)", padding: "10px 0" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <input type="checkbox" checked={rule.enabled} aria-label={t(`启用规则 ${rule.text}`)}
          onChange={(event) => saveDisplayRule({ ...rule, enabled: event.target.checked })} />
        <code style={{ color: colors[rule.color], overflowWrap: "anywhere" }}>{rule.text}</code>
      </label>
      <div style={{ fontSize: 11, color: "var(--dsh-ssh-ops-muted, #8b93a1)", margin: "5px 0 8px 22px" }}>
        {rule.match === "word" ? t("完整词") : t("包含文本")}{" · "}{labels.find(([key]) => key === rule.color)?.[1]}{" · "}
        {rule.caseSensitive ? t("区分大小写") : t("忽略大小写")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginLeft: 22 }}>
        <button type="button" style={appearanceButtonStyle} disabled={index === 0} aria-label={t(`上移规则 ${rule.text}`)} onClick={() => moveDisplayRule(rule.id, -1)}>↑</button>
        <button type="button" style={appearanceButtonStyle} disabled={index === rules.length - 1} aria-label={t(`下移规则 ${rule.text}`)} onClick={() => moveDisplayRule(rule.id, 1)}>↓</button>
        <button type="button" style={appearanceButtonStyle} aria-label={t(`编辑规则 ${rule.text}`)} onClick={() => { setDraft({ ...rule }); setEditing(true); setError(""); }}>{t("编辑")}</button>
        <button type="button" style={appearanceButtonStyle} aria-label={t(`删除规则 ${rule.text}`)} onClick={() => {
          deleteDisplayRule(rule.id); if (draft.id === rule.id) { setDraft(empty()); setEditing(false); }
        }}>{t("删除")}</button>
      </div>
    </div>)}
    {!editing && <button type="button" disabled={rules.length >= MAX_CUSTOM_RULES} style={{ ...appearanceButtonStyle, marginTop: 12 }}
      onClick={() => { setDraft(empty()); setEditing(true); setError(""); }}>{t("添加规则")}</button>}
    {editing && <form onSubmit={save} style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <label style={{ fontSize: 12 }}>{t("匹配文本")}
        <input autoFocus value={draft.text} maxLength={MAX_RULE_TEXT} placeholder={t("例如：timeout、WARN、业务关键词")}
          onChange={(event) => setDraft({ ...draft, text: event.target.value })} style={{ ...field, marginTop: 5 }} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 12 }}>{t("匹配方式")}<select value={draft.match} style={{ ...field, marginTop: 5 }} onChange={(event) => setDraft({ ...draft, match: event.target.value })}>
          <option value="contains">{t("包含文本")}</option><option value="word">{t("完整词")}</option>
        </select></label>
        <label style={{ fontSize: 12 }}>{t("颜色类别")}<select value={draft.color} style={{ ...field, marginTop: 5 }} onChange={(event) => setDraft({ ...draft, color: event.target.value })}>
          {labels.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <input type="checkbox" checked={draft.caseSensitive} onChange={(event) => setDraft({ ...draft, caseSensitive: event.target.checked })} />{t("区分大小写")}
      </label>
      {error && <div role="alert" style={{ fontSize: 12, color: "#e5484d" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={!draft.text.trim()} style={appearanceButtonStyle}>{t("保存规则")}</button>
        <button type="button" onClick={() => { setDraft(empty()); setEditing(false); setError(""); }} style={appearanceButtonStyle}>{t("取消")}</button>
      </div>
    </form>}
  </details>;
}
