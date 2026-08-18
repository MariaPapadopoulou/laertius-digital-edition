import { useSyncExternalStore } from "react";

const GREEK_PREF_KEY = "laertius:show-greek-source";

type Pref = boolean | null;

function readGreekPref(): Pref {
  try {
    const v = window.localStorage.getItem(GREEK_PREF_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // localStorage unavailable (private mode, etc.); fall back to default
  }
  return null;
}

let current: Pref = readGreekPref();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== GREEK_PREF_KEY) return;
  const next = readGreekPref();
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

function getSnapshot(): Pref {
  return current;
}

export function setGreekPref(value: boolean) {
  current = value;
  try {
    window.localStorage.setItem(GREEK_PREF_KEY, value ? "1" : "0");
  } catch {
    // ignore write failures; in-page panels still stay in sync
  }
  notify();
}

export function useGreekSourcePref(): [Pref, (value: boolean) => void] {
  const pref = useSyncExternalStore(subscribe, getSnapshot);
  return [pref, setGreekPref];
}
