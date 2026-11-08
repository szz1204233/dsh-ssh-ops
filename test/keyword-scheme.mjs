import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDisplaySettings } from "../src/client/terminal-display/settings.js";
import { defaultScheme, getScheme, compileScheme, exportScheme, parseSchemeBackup } from "../src/client/terminal-display/scheme.js";
import { matchText } from "../src/client/terminal-display/matcher.js";
import { acquireTestMatcher } from "./helpers/highlight-worker.mjs";

// Captured from the tagged v0.4.8 exporter, not from an unreleased draft.
const release = JSON.parse(readFileSync(new URL("./fixtures/terminal-appearance/release-v0.4.8.json", import.meta.url)));
const KEY = "dsh-ssh-ops.terminal-display.v1";
function storeWith(data) {
  const values = new Map(data ? [[KEY, JSON.stringify(data)]] : []);
  const options = { storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, eventTarget: {} };
  return { store: createDisplaySettings(options), options };
}

test("all 11 release categories survive readable keyword defaults and worker matching", async () => {
  const lease = acquireTestMatcher();
  try {
    const samples = ["service ERROR WARNING success INFO debug", "root@host$ sudo -n systemctl status /var/log/app --lines=20",
      'drwxr-xr-x 2 root root 4096 2026-11-08 12:30 "hello"', "peer 10.2.3.4 fe80::abcd aa:bb:cc:dd:ee:ff -> target 12%"];
    for (const theme of ["dark", "light"]) {
      const entries = defaultScheme(theme), compiled = compileScheme(entries), previous = compileScheme(release[theme].entries);
      assert.equal(entries.length, 11);
      assert.deepEqual(entries.map(e => e.id), release[theme].entries.map(e => e.id));
      for (const id of ["error", "success", "warning", "info", "debug"]) {
        const entry = entries.find(e => e.id === id);
        assert.equal(entry.mode, "regex");
        assert.ok(entry.text.length < release[theme].entries.find(e => e.id === id).text.length);
        assert.ok(!entry.text.includes("\\b"));
      }
      for (const line of samples) assert.deepEqual(matchText(line, compiled.rules, compiled.colors), matchText(line, previous.rules, previous.colors), line);
      assert.deepEqual((await lease.match(entries, samples)).lines, samples.map(line => matchText(line, previous.rules, previous.colors)));
      assert.deepEqual(parseSchemeBackup(exportScheme({}, theme)).entries, entries);
    }
    const mixed = [{ ...defaultScheme("dark")[0], text: "fatal\nERROR\\s+\\d+" }];
    const result = await lease.match(mixed, ["fatal ERROR 42"]);
    assert.deepEqual(result.lines[0].map(span => "fatal ERROR 42".slice(span.start, span.end)), ["fatal", "ERROR 42"]);
  } finally { lease.release(); }
});

test("v0.4.8 saved user rules, colors, ordering and both themes remain unchanged", () => {
  const dark = release.dark.entries.map(e => ({ ...e }));
  dark[0] = { ...dark[0], text: "OUTAGE.*", color: "#123456", enabled: false, caseSensitive: true };
  dark.reverse();
  dark.push({ id: "custom:mine", name: "mine", text: "APP\\d+", mode: "regex", color: "#abcdef", enabled: true, caseSensitive: false });
  const data = { theme: "dark", highlightEnabled: true, schemes: { dark, light: release.light.entries }, backgrounds: { dark: "#112233", light: "#fefefe" } };
  const { store, options } = storeWith(data);
  assert.deepEqual(store.getSnapshot(), data);
  for (const theme of ["dark", "light"]) assert.deepEqual(getScheme(store.getSnapshot(), theme), data.schemes[theme]);
  store.update({ theme: "light" });
  assert.deepEqual(createDisplaySettings(options).getSnapshot().schemes, data.schemes);
  assert.deepEqual(createDisplaySettings(options).getSnapshot().backgrounds, data.backgrounds);
  const partial = storeWith({ theme: "dark", highlightEnabled: true, colors: { dark: { error: "#123456" } }, customRules: [{ id: "mine", text: "APP", color: "success", match: "contains" }] }).store;
  assert.equal(getScheme(partial.getSnapshot(), "dark").length, 12);
  assert.equal(getScheme(partial.getSnapshot(), "dark")[0].color, "#123456");
});

test("fresh settings keep the release storage shape without a second preset or version", () => {
  const { store, options } = storeWith();
  assert.deepEqual(store.getSnapshot(), { highlightEnabled: false, theme: "system" });
  store.update({ highlightEnabled: true });
  assert.deepEqual(createDisplaySettings(options).getSnapshot(), { highlightEnabled: true, theme: "system" });
  assert.deepEqual(getScheme(store.getSnapshot(), "dark"), defaultScheme("dark"));
});
