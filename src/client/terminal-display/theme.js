/*!
 * WindTerm 2.7.0 palette/rule adaptation (modified).
 * Source: https://github.com/kingToolbox/WindTerm/releases/tag/2.7.0
 * SPDX-License-Identifier: Apache-2.0
 * See THIRD_PARTY_NOTICES.md and licenses/Apache-2.0.txt.
 */
// Dige Black palette from the official WindTerm 2.7.0 distribution.
// https://github.com/kingToolbox/WindTerm/releases/tag/2.7.0
export const WINDTERM_DARK_THEME = Object.freeze({
  background: "#1c1c1c", foreground: "#f8f8f2", cursor: "#ffffff", cursorAccent: "#1c1c1c",
  selectionBackground: "#5050ff80",
  black: "#333333", red: "#c4265e", green: "#86b42b", yellow: "#d0a500",
  blue: "#3465a4", magenta: "#8c6bc8", cyan: "#56adbc", white: "#e3e3dd",
  brightBlack: "#666666", brightRed: "#f92672", brightGreen: "#a6e22e", brightYellow: "#9e862f",
  brightBlue: "#819aff", brightMagenta: "#ae81ff", brightCyan: "#66d9ef", brightWhite: "#f8f8f2"
});

// Dige White-inspired palette, darkened for legibility on white.
export const WINDTERM_LIGHT_THEME = Object.freeze({
  background: "#ffffff", foreground: "#333333", cursor: "#333333", cursorAccent: "#ffffff",
  selectionBackground: "#5050ff40",
  black: "#272822", red: "#b42318", green: "#216e39", yellow: "#8a5a00",
  blue: "#1d4ed8", magenta: "#9d2175", cyan: "#006e80", white: "#5b6573",
  brightBlack: "#595959", brightRed: "#c2413b", brightGreen: "#147d46", brightYellow: "#996600",
  brightBlue: "#2563eb", brightMagenta: "#9333b9", brightCyan: "#007c91", brightWhite: "#475569"
});

export function terminalTheme(theme) {
  return theme === "light" ? WINDTERM_LIGHT_THEME : WINDTERM_DARK_THEME;
}
