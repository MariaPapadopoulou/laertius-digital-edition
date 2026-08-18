import { useEffect, useRef } from "react";
import { shouldResetOnSamePageNav } from "./same-page-nav-reset";

// Clicking a link back to the very page the reader is already on (the nav
// link for the current page, or the logo on the home page) doesn't remount
// the component, so the page would keep its filters, results, and scroll
// position. This hook makes such a click behave like a fresh visit: it runs
// the page's reset callback and scrolls to the top.
//
// Only PLAIN links to the current pathname trigger a reset: links that carry
// a query string (e.g. a "with X" badge linking to /anecdotes?involves=X
// while already on /anecdotes) are in-place filter navigations and must be
// left alone. New-tab links don't affect this page either.
//
// The shared scroll-memory hook deliberately ignores same-page clicks (it
// neither freezes saves nor stamps the history entry), so back/forward
// restore behavior is unaffected by this reset.
export function useResetOnSamePageNav(reset: () => void) {
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      if (
        !shouldResetOnSamePageNav(
          {
            origin: anchor.origin,
            pathname: anchor.pathname,
            search: anchor.search,
            target: anchor.target,
          },
          {
            origin: window.location.origin,
            pathname: window.location.pathname,
          },
        )
      ) {
        return;
      }
      resetRef.current();
      window.scrollTo(0, 0);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);
}
