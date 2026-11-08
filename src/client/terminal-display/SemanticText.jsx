import * as React from "react";
import { getDisplaySettings, subscribeDisplaySettings } from "./settings.js";
import { getHostTheme, subscribeHostTheme, resolveDisplayTheme, terminalTheme } from "./theme.js";
import { getScheme } from "./scheme.js";
import { useRegexMatches } from "./use-regex-matches.js";
import { segmentTextLine, textHighlightInput } from "./text-view.js";

const EMPTY = Object.freeze([]);

// One worker request for each text surface (all search hits share one). Never run
// user expressions on the UI thread; stale/failed results render plain text.
export function useSemanticText(text) {
  const settings = React.useSyncExternalStore(subscribeDisplaySettings, getDisplaySettings);
  const host = React.useSyncExternalStore(subscribeHostTheme, getHostTheme);
  const resolved = resolveDisplayTheme(settings.theme, host);
  const entries = React.useMemo(() => settings.highlightEnabled ? getScheme(settings, resolved) : EMPTY, [settings, resolved]);
  const input = textHighlightInput(text);
  const { lines } = useRegexMatches(entries, input, false);
  const theme = terminalTheme(resolved, settings.backgrounds);
  return { lines: settings.highlightEnabled ? lines : EMPTY, theme };
}

export function SemanticLine({ text, spans }) {
  return segmentTextLine(text, spans).map((part, index) => part.color
    ? <span key={index} style={{ color: part.color }}>{part.text}</span>
    : <React.Fragment key={index}>{part.text}</React.Fragment>);
}

export function SemanticText({ text, lines }) {
  return text.split("\n").map((line, index) => <React.Fragment key={index}>
    {index > 0 ? "\n" : ""}<SemanticLine text={line} spans={lines[index]} />
  </React.Fragment>);
}
