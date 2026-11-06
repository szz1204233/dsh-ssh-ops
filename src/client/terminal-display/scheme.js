import { COLORS, colorsForTheme, HIGHLIGHT_RULES } from "./rules.js";
import { DEFAULT_BACKGROUNDS } from "./theme.js";
import { normalizeCustomRules } from "./custom-rules.js";

export const MAX_SCHEME_ENTRIES = 43;
export const MAX_SCHEME_TEXT = 8192;
export const MAX_PATTERN_LENGTH = 512;
export const MAX_PATTERNS = 64;
const KEYWORDS = {
  error: 'ERROR\nerrors\nFATAL\nPANIC\nFAILED\nfail\nfailure\nfalse\ndenied\nrefused\nWARNING\nwarn\nbad\ncannot\nincorrect\ninvalid\nunknown\nunsupported\nwrong\ndeprecated\ndisabled\nimportant\nno\nnone\nnot\nnot successful\nnot supported\ncan\'t be supported',
  success: 'SUCCESS\nsuccessful\nsuccessfully\nSUCCEEDED\ntrue\nyes\nok\npass\npassed\ncorrect\ncorrectly\nknown\nsupported\nvalid\ncan',
  warning: 'debug\nsudo\nclosed\nexited\ndisconnected\nskipped\nstopped\nterminated',
  info: 'INFO\naccess\nany\nauthentication\nconnection\ndisconnection\nlogin\noperation\npassword\npermission'
};
const AUTO_IDS = {
  heading: ["mac", "ipv4", "ipv6", "datetime", "operator"], number: ["number"], string: ["string"], option: ["option"], debug: ["permissions"],
  error: ["error"], success: ["success"], warning: ["warning"], info: ["info"]
};
const CONTEXT_PATTERNS = {
  command: String.raw`(?<=[#$>%]\s)[\w.-]+|(?<=\|\s)[\w.-]+`,
  prompt: String.raw`[$#%>](?=\s)`,
  string: String.raw`(?:~?\/|[\w.-]+\/)[^\s"'|;<>]*`
};
const DEFAULT_TEXT = Object.fromEntries(Object.keys(COLORS).map((id) => [id, KEYWORDS[id] ?? [
  ...(AUTO_IDS[id] ?? []).map((ruleId) => HIGHLIGHT_RULES.find((rule) => rule.id === ruleId).pattern.source),
  ...(CONTEXT_PATTERNS[id] ? [CONTEXT_PATTERNS[id]] : [])
].join("\n")]));
const DEFAULTS = Object.fromEntries(["dark", "light"].map((theme) => [theme, Object.freeze(Object.keys(COLORS).map((id) => Object.freeze({
  id, color: colorsForTheme(theme)[id], enabled: true, text: DEFAULT_TEXT[id], mode: "regex", caseSensitive: false
})))]));
export const defaultScheme = (theme) => DEFAULTS[theme === "light" ? "light" : "dark"];
export const splitPatterns = (text) => [...new Set(text.split("\n").map((value) => value.trim()).filter(Boolean))];
export function patternProblem(source) {
  if (source.length > MAX_PATTERN_LENGTH) return "pattern-too-long";
  try { new RegExp(source, "gu"); return ""; } catch { return "invalid-regex"; }
}
function escapeRegexLiteral(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function legacyPatterns(item) {
  if (item.mode === "regex") return item.text;
  if (item.mode === "auto") return [DEFAULT_TEXT[item.id] ?? "", ...splitPatterns(item.text).map(escapeRegexLiteral)].filter(Boolean).join("\n");
  if (item.mode === "word" && KEYWORDS[item.id] === item.text) return DEFAULT_TEXT[item.id];
  return splitPatterns(item.text).map((text) => {
    const escaped = escapeRegexLiteral(text);
    return item.mode === "word" ? String.raw`(?<![\p{L}\p{N}_])(?:${escaped})(?![\p{L}\p{N}_])` : escaped;
  }).join("\n");
}

export function normalizeScheme(value) {
  if (!Array.isArray(value)) return undefined;
  const ids = new Set(), entries = [];
  for (const item of value) {
    if (entries.length >= MAX_SCHEME_ENTRIES) break;
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 100 || ids.has(item.id)
      || typeof item.color !== "string" || !/^#[0-9a-f]{6}$/i.test(item.color)
      || typeof item.text !== "string" || item.text.length > MAX_SCHEME_TEXT || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(item.text)) continue;
    ids.add(item.id);
    entries.push(Object.freeze({ id: item.id, color: item.color.toLowerCase(), enabled: item.enabled !== false,
      text: legacyPatterns({ ...item, text: item.text.replace(/\r\n?/g, "\n") }).slice(0, MAX_SCHEME_TEXT), mode: "regex",
      caseSensitive: item.caseSensitive === true,
      ...(!Object.hasOwn(COLORS, item.id) ? { name: typeof item.name === "string" ? item.name.slice(0, 80) : "" } : {}) }));
  }
  return Object.freeze(entries);
}

// Existing installations keep their colors and custom text rules. A theme's
// explicit scheme supersedes those legacy fields, so reset is theme-local.
export function getScheme(settings, theme) {
  if (settings.schemes?.[theme]) return settings.schemes[theme];
  const defaults = defaultScheme(theme);
  if (!settings.colors?.[theme] && !settings.customRules?.length && settings.builtinEnabled !== false) return defaults;
  return normalizeScheme([
    ...normalizeCustomRules(settings.customRules).map((rule) => ({ id: `custom:${rule.id}`, name: rule.text,
      text: rule.text, color: settings.colors?.[theme]?.[rule.color] ?? colorsForTheme(theme)[rule.color],
      enabled: rule.enabled, mode: rule.match, caseSensitive: rule.caseSensitive })),
    ...defaults.map((entry) => ({ ...entry, color: settings.colors?.[theme]?.[entry.id] ?? entry.color, enabled: settings.builtinEnabled !== false }))
  ]);
}

export function compileScheme(entries) {
  const rules = [], automatic = [], colors = Object.create(null);
  const context = [];
  for (const entry of entries) {
    if (!entry.enabled) continue;
    colors[entry.id] = entry.color;
    const unchanged = entry.text === DEFAULT_TEXT[entry.id] && !entry.caseSensitive;
    if (!unchanged) {
      for (const source of splitPatterns(entry.text).slice(0, MAX_PATTERNS).sort((a, b) => b.length - a.length)) {
        if (!patternProblem(source)) rules.push({ id: `regex:${entry.id}`, color: entry.id, pattern: new RegExp(source, entry.caseSensitive ? "gu" : "giu") });
      }
    }
    if (unchanged && Object.hasOwn(COLORS, entry.id)) {
      if (["command", "string", "prompt"].includes(entry.id)) context.push(entry.id);
      for (const id of AUTO_IDS[entry.id] ?? []) {
        const rule = HIGHLIGHT_RULES.find((item) => item.id === id);
        if (rule) automatic.push({ ...rule, context: false });
      }
    }
  }
  // Text entries have priority over automatic detection; list order breaks ties.
  automatic.sort((a, b) => HIGHLIGHT_RULES.findIndex((rule) => rule.id === a.id) - HIGHLIGHT_RULES.findIndex((rule) => rule.id === b.id));
  return { colors, rules: [...rules, ...automatic.filter((rule) => rule.id === "string"),
    ...(context.length ? [{ id: "context", context }] : []), ...automatic.filter((rule) => rule.id !== "string")] };
}

export function exportScheme(settings, theme) {
  // The backup is the whole look of one theme: its pattern scheme plus the
  // terminal background (custom or DSH default) needed to reproduce it.
  const background = settings.backgrounds?.[theme] ?? DEFAULT_BACKGROUNDS[theme];
  return JSON.stringify({ format: "dsh-ssh-ops.color-scheme", version: 2, theme, background, entries: getScheme(settings, theme) }, null, 2) + "\n";
}
