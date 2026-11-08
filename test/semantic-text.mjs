import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { segmentTextLine, textHighlightInput, TEXT_HIGHLIGHT_LIMIT } from "../src/client/terminal-display/text-view.js";
import { defaultScheme, parseSchemeBackup } from "../src/client/terminal-display/scheme.js";
import { acquireTestMatcher } from "./helpers/highlight-worker.mjs";

test("log text rendering preserves Unicode, whitespace, newlines and literal markup", async () => {
  const text = 'ERROR 中文 😀 <script>\n  WARNING: retry\n\n';
  const lease = acquireTestMatcher();
  try {
    for (const theme of ["dark", "light"]) {
      const entries = defaultScheme(theme);
      const result = await lease.match(entries, textHighlightInput(text).split("\n"));
      assert.equal(result.error, undefined);
      const parts = text.split("\n").map((line, index) => segmentTextLine(line, result.lines[index]));
      assert.equal(parts.map((line) => line.map((part) => part.text).join("")).join("\n"), text);
      assert.ok(parts[0].some((part) => part.color === entries.find((entry) => entry.id === "error").color));
      assert.ok(parts[1].some((part) => part.color === entries.find((entry) => entry.id === "warning").color));
    }
    const custom = [{ id: "custom:bird", name: "bird", text: "中文 😀", color: "#123456", mode: "regex", caseSensitive: true, enabled: true }];
    const matched = await lease.match(custom, [text.split("\n")[0]]);
    assert.ok(segmentTextLine(text.split("\n")[0], matched.lines[0]).some((part) => part.text === "中文 😀" && part.color === "#123456"));
    assert.deepEqual((await lease.match([{ ...custom[0], enabled: false }], [text])).lines, [[]]);
  } finally { lease.release(); }
});

test("bounded matching leaves the rest of a long line readable and copyable", () => {
  const text = "a".repeat(TEXT_HIGHLIGHT_LIMIT - 1) + "😀 <b>tail</b>";
  assert.equal(textHighlightInput(text).length, TEXT_HIGHLIGHT_LIMIT);
  const parts = segmentTextLine(text, [{ start: 0, end: 1, color: "#123456" }]);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(segmentTextLine(text), [{ text }]);
  assert.deepEqual(segmentTextLine(""), []);
});

test("documented v2 example is a complete importable backup", async () => {
  const backup = parseSchemeBackup(await readFile(new URL("../docs/terminal-color-scheme.example.json", import.meta.url), "utf8"));
  assert.deepEqual(backup.entries, defaultScheme("dark"));
  assert.equal(backup.theme, "dark");
});
