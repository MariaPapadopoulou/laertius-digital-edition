import { useSyncExternalStore } from "react";

const TEXT_LAYOUT_KEY = "laertius:text-layout";

export type TextLayout = "parallel" | "stacked";

const DEFAULT_LAYOUT: TextLayout = "parallel";

function readLayout(): TextLayout {
  try {
    const v = window.localStorage.getItem(TEXT_LAYOUT_KEY);
    if (v === "parallel" || v === "stacked") return v;
  } catch {
    // localStorage unavailable (private mode, etc.); fall back to default
  }
  return DEFAULT_LAYOUT;
}

let current: TextLayout = readLayout();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== TEXT_LAYOUT_KEY) return;
  const next = readLayout();
  if (next !== current) {
    current = next;
    notify();
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): TextLayout {
  return current;
}

export function setTextLayout(value: TextLayout) {
  current = value;
  try {
    window.localStorage.setItem(TEXT_LAYOUT_KEY, value);
  } catch {
    // ignore write failures; in-page panels still stay in sync
  }
  notify();
}

export function useTextLayoutPref(): [TextLayout, (value: TextLayout) => void] {
  const layout = useSyncExternalStore(subscribe, getSnapshot);
  return [layout, setTextLayout];
}
