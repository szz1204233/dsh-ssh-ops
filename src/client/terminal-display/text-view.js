// Bound worker input without changing the text that the reader can copy.
export const TEXT_HIGHLIGHT_LIMIT = 64 * 1024;

export function textHighlightInput(text) {
  return text.slice(0, TEXT_HIGHLIGHT_LIMIT);
}

export function segmentTextLine(text, spans = []) {
  const parts = [];
  let end = 0;
  for (const span of spans) {
    if (span.start < end || span.end > text.length) continue;
    if (span.start > end) parts.push({ text: text.slice(end, span.start) });
    parts.push({ text: text.slice(span.start, span.end), color: span.color });
    end = span.end;
  }
  if (end < text.length) parts.push({ text: text.slice(end) });
  return parts;
}
