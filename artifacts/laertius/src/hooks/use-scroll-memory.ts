import { useCallback, useEffect, useRef } from "react";

// Remembers the reader's scroll position on long list pages so that coming
// back from a section (or any other page) puts them right where they were.
//
// How it works, and why it is shaped this way:
//
// - The position is persisted eagerly on every scroll event into
//   sessionStorage, keyed by the page's current filters. Saving at unmount
//   doesn't work: React removes the DOM (the page height collapses and the
//   browser clamps scrollY toward 0, firing one last bogus scroll event)
//   before effect cleanups run.
// - The moment an internal link is clicked, the position is snapshotted once
//   more in a document-level capture-phase click listener and all further
//   saves are frozen, so the collapse clamp can't overwrite the reader's
//   real position.
// - The same click listener stamps a marker into the CURRENT history entry
//   (via replaceState). Back/forward navigation returns to that entry with
//   the marker intact, so the page knows to restore; a fresh visit through
//   a nav link pushes a NEW entry without the marker, so it starts at the
//   top. This is what distinguishes "back" from "fresh" on pages that are
//   equally reachable both ways with identical URLs.
// - Restoration retries window.scrollTo over a few animation frames (the
//   list may not have its full height on the first frame) and takes over
//   history.scrollRestoration while mounted so native restoration can't
//   fight it.
//
// `key` must encode every filter that changes the rendered list; `ready`
// must be true only once the list for the current key is actually rendered.
//
// Pages whose URL fully determines the list (like Search, which pushes a
// history entry per submit) can pass `initiallyPending: true` to treat a
// mount-with-params as a pending restore even without the history marker,
// and call the returned `armRestore()` from their popstate handler to
// re-arm restoration when back/forward changes the params in place.
export function useScrollMemory(
  key: string,
  ready: boolean,
  options?: { initiallyPending?: boolean },
) {
  const keyRef = useRef(key);
  keyRef.current = key;

  // Read the marker synchronously at first render: the pages' own URL-sync
  // effects call history.replaceState(null, ...) and would wipe it before
  // any effect could see it.
  const pendingRestoreRef = useRef(
    options?.initiallyPending === true ||
      (window.history.state !== null &&
        typeof window.history.state === "object" &&
        (window.history.state as { scrollMemory?: unknown }).scrollMemory ===
          true),
  );
  const navigatingAwayRef = useRef(false);
  // True while the restore loop below is actively enforcing a position;
  // scroll events during enforcement are ours (or the browser's late
  // native restoration), not the reader's, and must not be saved.
  const restoringRef = useRef(false);

  // The browser's automatic history scroll restoration races with our own
  // (it can snap back to a clamped position); take over while mounted.
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(keyRef.current, String(window.scrollY));
      } catch {
        // sessionStorage unavailable: skip scroll memory
      }
    };
    const onScroll = () => {
      if (navigatingAwayRef.current) return;
      // While a restore is pending, any scroll is noise (the browser's
      // native restoration firing against a not-yet-full page, or the
      // height collapsing during the route swap); saving it would
      // overwrite the position we are about to restore.
      if (pendingRestoreRef.current || restoringRef.current) return;
      save();
    };
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const anchor = target?.closest("a");
      // Only in-app navigations collapse this page; new-tab links don't.
      if (!anchor || anchor.target === "_blank") return;
      // A link back to this very page (e.g. the nav link for the page the
      // reader is already on) doesn't unmount it: don't freeze saves or
      // stamp the entry, or scrolling afterwards would stop being saved.
      if (
        anchor.origin === window.location.origin &&
        anchor.pathname === window.location.pathname
      ) {
        return;
      }
      save();
      navigatingAwayRef.current = true;
      // Mark this history entry so only back/forward returns restore.
      try {
        const state =
          window.history.state !== null &&
          typeof window.history.state === "object"
            ? (window.history.state as Record<string, unknown>)
            : {};
        window.history.replaceState(
          { ...state, scrollMemory: true },
          "",
          window.location.href,
        );
      } catch {
        // History unavailable: the next visit simply starts at the top
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  // Re-arm restoration; for pages that handle popstate themselves and keep
  // this component mounted while the params (and key) change in place.
  const armRestore = useCallback(() => {
    pendingRestoreRef.current = true;
  }, []);

  // Once the list for the current filters is rendered, restore the saved
  // position exactly once. `key` is in the deps so a popstate that swaps to
  // an already-cached list (ready stays true, key changes) still restores.
  useEffect(() => {
    if (!ready || !pendingRestoreRef.current) return;
    pendingRestoreRef.current = false;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(keyRef.current);
    } catch {
      saved = null;
    }
    if (saved === null) return;
    const y = parseFloat(saved);
    if (!Number.isFinite(y) || y <= 0) return;
    // The list may not have its full height on the first frame, and the
    // browser's own deferred history restoration (scheduled while the
    // PREVIOUS page still had scrollRestoration "auto") can snap the page
    // to a clamped position AFTER our first successful scroll. So instead
    // of stopping at the first match, keep enforcing the target over a
    // guard window: re-pin whenever the position deviates and only stop
    // once it has been stable for a while (or the window runs out).
    restoringRef.current = true;
    // Real reader input ends enforcement immediately so we never fight the
    // user; without it, keep guarding for a few seconds, because the
    // browser's deferred restoration can snap the page long after our
    // first successful scroll (it waits for the document to grow).
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    const cleanupInput = () => {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
    let tries = 0;
    let stable = 0;
    const attempt = () => {
      if (cancelled) {
        cleanupInput();
        restoringRef.current = false;
        return;
      }
      if (Math.abs(window.scrollY - y) > 2) {
        window.scrollTo(0, y);
        stable = 0;
      } else {
        stable += 1;
      }
      tries += 1;
      if (tries < 300 && stable < 60) {
        requestAnimationFrame(attempt);
      } else {
        cleanupInput();
        restoringRef.current = false;
      }
    };
    requestAnimationFrame(attempt);
  }, [ready, key]);

  return { armRestore };
}
