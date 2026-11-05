import * as React from "react";
import { t } from "../../i18n/core.js";
import { matchText } from "./matcher.js";

function highlightLine(text, colors, rules) {
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

// A single native text editor sits over its colored mirror. The browser owns
// caret, selection, undo, paste and IME; highlighting never rewrites its DOM.
export function EditablePreview({ text, onChange, theme, colors, rules }) {
  const mirror = React.useRef(null);
  const typography = { fontFamily: 'Menlo, Monaco, "Courier New", monospace', fontSize: 12, lineHeight: "20px", tabSize: 4, letterSpacing: "normal" };
  return <div style={{ position: "relative", height: 164, background: theme.background,
    border: "1px solid var(--dsh-ssh-ops-border, #3a414b)", borderRadius: 6, overflow: "hidden" }}>
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <pre ref={mirror} style={{ ...typography, margin: 0, padding: 12, color: theme.foreground, whiteSpace: "pre", boxSizing: "border-box", minHeight: "100%", width: "max-content", minWidth: "100%" }}>
        {text.split("\n").map((line, index) => <React.Fragment key={index}>{index > 0 ? "\n" : ""}{highlightLine(line, colors, rules)}</React.Fragment>)}{"\n"}
      </pre>
    </div>
    <textarea aria-label={t("配色预览")} value={text} maxLength={4096} spellCheck={false} wrap="off"
      onChange={(event) => onChange(event.target.value)}
      onScroll={(event) => { if (mirror.current) mirror.current.style.transform = `translate(${-event.currentTarget.scrollLeft}px, ${-event.currentTarget.scrollTop}px)`; }}
      style={{ ...typography, display: "block", position: "relative", boxSizing: "border-box", width: "100%", height: "100%", margin: 0, padding: 12,
        border: 0, borderRadius: 6, resize: "none", background: "transparent", color: "transparent", caretColor: theme.foreground, whiteSpace: "pre", overflow: "auto" }} />
  </div>;
}
