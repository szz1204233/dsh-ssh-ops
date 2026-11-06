/*!
 * WindTerm 2.7.0 palette/rule adaptation (modified).
 * Copyright (c) KingToolbox. All rights reserved.
 * Upstream palette notes:
 * Most colors take from Monokai.
 * Most colors take from Vscode's QuiteLight Theme.
 * Source: https://github.com/kingToolbox/WindTerm/releases/tag/2.7.0
 * SPDX-License-Identifier: Apache-2.0
 * See THIRD_PARTY_NOTICES.md and licenses/Apache-2.0.txt.
 */
import { DARK_TERMINAL_THEME, LIGHT_TERMINAL_THEME, createTerminalThemeWatcher, getTerminalTheme } from "../terminal-theme.js";

// ANSI colours from the official WindTerm 2.7.0 distribution (the Dige Black
// and Dige White families). The terminal chrome (background, foreground,
// cursor, selection) comes from DSH's own terminal theme instead, so a fresh
// install looks native beside the host UI; the tuned ANSI palette stays.
const WINDTERM_ANSI_DARK = Object.freeze({
  black: "#333333", red: "#c4265e", green: "#86b42b", yellow: "#d0a500",
  blue: "#3465a4", magenta: "#8c6bc8", cyan: "#56adbc", white: "#e3e3dd",
  brightBlack: "#666666", brightRed: "#f92672", brightGreen: "#a6e22e", brightYellow: "#9e862f",
  brightBlue: "#819aff", brightMagenta: "#ae81ff", brightCyan: "#66d9ef", brightWhite: "#f8f8f2"
});
const WINDTERM_ANSI_LIGHT = Object.freeze({
  black: "#272822", red: "#b42318", green: "#216e39", yellow: "#8a5a00",
  blue: "#1d4ed8", magenta: "#9d2175", cyan: "#006e80", white: "#5b6573",
  brightBlack: "#595959", brightRed: "#c2413b", brightGreen: "#147d46", brightYellow: "#996600",
  brightBlue: "#2563eb", brightMagenta: "#9333b9", brightCyan: "#007c91", brightWhite: "#475569"
});

// DSH chrome + WindTerm ANSI palette: the defaults for a fresh install.
export const WINDTERM_DARK_THEME = Object.freeze({ ...DARK_TERMINAL_THEME, ...WINDTERM_ANSI_DARK });
export const WINDTERM_LIGHT_THEME = Object.freeze({ ...LIGHT_TERMINAL_THEME, ...WINDTERM_ANSI_LIGHT });

/** DSH's terminal backgrounds: the defaults and the reset values of the setting. */
export const DEFAULT_BACKGROUNDS = Object.freeze({
  dark: DARK_TERMINAL_THEME.background,
  light: LIGHT_TERMINAL_THEME.background
});

const HEX = /^#[0-9a-f]{6}$/i;
// WCAG crossover luminance: above this value a dark foreground reads better on
// the background, below it a light foreground does.
const LIGHT_BACKGROUND_LUMINANCE = 0.179;
function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

let hostTheme = getTerminalTheme().background === LIGHT_TERMINAL_THEME.background ? "light" : "dark";
const listeners = new Set();
let stopWatching;
export const getHostTheme = () => hostTheme;
export function resolveDisplayTheme(theme, host = hostTheme) {
  return theme === "system" ? host : theme === "light" ? "light" : "dark";
}
export function subscribeHostTheme(listener) {
  if (listeners.size === 0) {
    stopWatching = createTerminalThemeWatcher({ apply: (theme) => {
      const next = theme.background === LIGHT_TERMINAL_THEME.background ? "light" : "dark";
      if (next === hostTheme) return;
      hostTheme = next;
      for (const notify of listeners) notify();
    } });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) { stopWatching?.(); stopWatching = undefined; }
  };
}
/**
 * The terminal theme for a display theme, with the user's per-theme background
 * override applied. A custom background can invert the theme's polarity, so the
 * foreground/cursor are re-picked from DSH's dark or light chrome by the
 * background's luminance instead of keeping the preset's (unreadable) pairing.
 */
export function terminalTheme(theme, backgrounds = {}) {
  const resolved = resolveDisplayTheme(theme);
  const preset = resolved === "light" ? WINDTERM_LIGHT_THEME : WINDTERM_DARK_THEME;
  const custom = backgrounds?.[resolved];
  if (typeof custom !== "string" || !HEX.test(custom)) return preset;
  const background = custom.toLowerCase();
  const chrome = relativeLuminance(background) > LIGHT_BACKGROUND_LUMINANCE ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME;
  return Object.freeze({ ...preset, background, foreground: chrome.foreground, cursor: chrome.cursor, cursorAccent: background });
}
