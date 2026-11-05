import { COLORS } from "./rules.js";

const KEY = "dsh-ssh-ops.terminal-display.v1";
const LEGACY_KEY = "dsh-ssh-ops.private-output-highlight.enabled";
const DEFAULTS = Object.freeze({ highlightEnabled: true, theme: "dark" });
function parse(value) {
  try {
    const data = JSON.parse(value);
    if (typeof data?.highlightEnabled === "boolean" && ["dark", "light"].includes(data.theme)) {
      const colors = {};
      for (const theme of ["dark", "light"]) {
        const overrides = {};
        for (const key of Object.keys(COLORS)) {
          const color = data.colors?.[theme]?.[key];
          if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) overrides[key] = color.toLowerCase();
        }
        if (Object.keys(overrides).length) colors[theme] = Object.freeze(overrides);
      }
      return Object.freeze({ highlightEnabled: data.highlightEnabled, theme: data.theme,
        ...(Object.keys(colors).length ? { colors: Object.freeze(colors) } : {}) });
    }
  } catch {}
  return DEFAULTS;
}

// One origin-wide snapshot for every connection and pane. Storage events
// propagate changes from other DSH windows; same-window changes notify directly.
export function createDisplaySettings({ storage, eventTarget = globalThis } = {}) {
  let snapshot = DEFAULTS;
  let lastStoredValue;
  try {
    storage ??= globalThis.localStorage;
    const saved = storage?.getItem(KEY);
    lastStoredValue = saved;
    snapshot = saved === null || saved === undefined
      ? Object.freeze({ ...DEFAULTS, highlightEnabled: storage?.getItem(LEGACY_KEY) !== "false" })
      : parse(saved);
  } catch {}
  const listeners = new Set();
  const apply = (next) => {
    if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const refresh = () => {
    try {
      const saved = storage?.getItem(KEY);
      // Preserve in-memory changes when storage writes are blocked. Only an
      // actual change on disk should replace the local snapshot.
      if (saved !== lastStoredValue) {
        lastStoredValue = saved;
        apply(parse(saved));
      }
    } catch {}
  };
  const onStorage = (event) => {
    if ((event.key === KEY || event.key === null) && (!event.storageArea || event.storageArea === storage)) {
      // Read the current value: queued storage events may already be stale.
      refresh();
    }
  };
  return {
    getSnapshot: () => snapshot,
    update(patch) {
      refresh();
      const next = parse(JSON.stringify({ ...snapshot, ...(typeof patch === "function" ? patch(snapshot) : patch) }));
      try {
        const saved = JSON.stringify(next);
        storage?.setItem(KEY, saved);
        lastStoredValue = storage?.getItem(KEY);
      } catch {}
      apply(next);
    },
    subscribe(listener) {
      if (listeners.size === 0) {
        // A retained terminal may subscribe again after a different window
        // changed storage while no settings UI/terminal was listening.
        refresh();
        eventTarget.addEventListener?.("storage", onStorage);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) eventTarget.removeEventListener?.("storage", onStorage);
      };
    }
  };
}
const settings = createDisplaySettings();
export const getDisplaySettings = settings.getSnapshot;
export const setDisplaySettings = settings.update;
export const subscribeDisplaySettings = settings.subscribe;

export function setDisplayColor(theme, key, color) {
  if (!["dark", "light"].includes(theme) || !Object.hasOwn(COLORS, key) || !/^#[0-9a-f]{6}$/i.test(color)) return;
  settings.update((state) => ({ colors: { ...state.colors, [theme]: { ...state.colors?.[theme], [key]: color } } }));
}
export function resetDisplayColors(theme) {
  if (!["dark", "light"].includes(theme)) return;
  settings.update((state) => ({ colors: { ...state.colors, [theme]: {} } }));
}
