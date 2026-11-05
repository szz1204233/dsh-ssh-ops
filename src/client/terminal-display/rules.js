/*!
 * WindTerm 2.7.0 palette/rule adaptation (modified).
 * Source: https://github.com/kingToolbox/WindTerm/releases/tag/2.7.0
 * SPDX-License-Identifier: Apache-2.0
 * See THIRD_PARTY_NOTICES.md and licenses/Apache-2.0.txt.
 */
// Hand-ported, dependency-free subset of WindTerm 2.7.0's Linux lexer.
// Priority is deliberate: strings/addresses precede their component tokens;
// negative phrases precede positive words ("not successful" stays negative).
export const COLORS = Object.freeze({
  error: "#f44747", success: "#32cd32", warning: "#cd9731", info: "#6796e6",
  heading: "#a6e22e", number: "#ae81ff", string: "#e6db74", option: "#fd971f",
  command: "#66d9ef", debug: "#b267e6", prompt: "#f92672"
});
export const LIGHT_COLORS = Object.freeze({
  error: "#c62828", success: "#237a32", warning: "#8b5c00", info: "#245da8",
  heading: "#087f72", number: "#7b42a8", string: "#397627", option: "#a25310",
  command: "#006aa6", debug: "#91509f", prompt: "#ad1760"
});
export const colorsForTheme = (theme, overrides = {}) => ({ ...(theme === "light" ? LIGHT_COLORS : COLORS), ...overrides });
const octet = "(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)";
export const HIGHLIGHT_RULES = [
  { id: "string", pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, color: "string" },
  { id: "mac", pattern: /\b(?:[a-f\d]{2}:){5}[a-f\d]{2}\b|\b(?:[a-f\d]{2}-){5}[a-f\d]{2}\b/gi, color: "heading" },
  { id: "ipv4", pattern: new RegExp(`(?<![\\w.])(?:${octet}\\.){3}${octet}(?![\\w.]|\\.\\d)`, "g"), color: "heading" },
  { id: "ipv6", pattern: /(?<![\w:])(?:[a-f\d]{0,4}:){2,7}[a-f\d]{0,4}(?![\w:])/gi, color: "heading",
    accept: (text) => text.includes("::") ? text.indexOf("::") === text.lastIndexOf("::") && text.split(":").filter(Boolean).length < 8 : text.split(":").length === 8 && !text.startsWith(":") && !text.endsWith(":") },
  { id: "datetime", pattern: /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:[ T]\d{1,2}(?::\d{2}){1,2}(?:\.\d+)?Z?)?\b|\b\d{1,2}(?::\d{2}){1,2}(?:\.\d+)?\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|Mon|Tues?|Wed|Thur?|Fri|Sat|Sun)\b/gi, color: "heading" },
  { id: "permissions", pattern: /(?<!\S)[bcdlps-](?:[rw-]{2}[xsStT-]){3}[.+]?(?=\s|$)/g, permissions: true },
  { id: "error", pattern: /\b(?:bad|cannot(?:\s+\w+)?|denied|deprecated|disabled|errors?|fatal|panic|fail(?:ed)?|failure|false|important|incorrect|invalid|no(?:\s+\w+)?|none|(?:(?:do|does|can|will|could|should|would)\s+)?not(?:\s+\w+)?|(?:do|does|ca|wo|could|should|would)n't(?:\s+(?:be\s+)?\w+)?|refused|unknown|unsupported|warn(?:ing)?|wrong)\b/gi, color: "error" },
  { id: "success", pattern: /\b(?:can(?:\s+\w+)?|correct(?:ly)?|known|ok|pass(?:ed)?|success(?:ful(?:ly)?)?|succeeded|supported|true|yes|valid)\b/gi, color: "success" },
  { id: "warning", pattern: /\b(?:closed|exited|debug|disconnected|skipped|stopped|sudo|terminated)\b/gi, color: "warning" },
  { id: "info", pattern: /\b(?:access|any|authentication|connection|disconnection|info|login|operation|password|permission)\b/gi, color: "info" },
  { id: "option", pattern: /(?<!\S)--?\w[\w-]*(?:=\w+)?\b/g, option: true, color: "option" },
  { id: "number", pattern: /(?<![\w.:-])(?:0x[\da-f]+|[\da-f]{8}|[\da-f]{4}|\d+(?:\.\d+)*(?:e[+-]?\d+)?%?)(?![\w.-])/gi, color: "number" },
  { id: "operator", pattern: /[=:;|?*$<>&+()[\]{}-]/g, color: "heading" }
];
