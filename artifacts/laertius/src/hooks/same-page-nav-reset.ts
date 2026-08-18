// Pure decision logic for the same-page nav reset, kept free of React and
// DOM types so the validate-nav-reset script can unit-test it directly.
//
// A click on a link resets the current page only when ALL of these hold:
// - the link opens in this tab (no target="_blank")
// - it points at the same origin
// - it points at the exact pathname the reader is already on
// - it carries NO query string (links like /anecdotes?involves=X while on
//   /anecdotes are in-place filter navigations and must be left alone)

export interface NavLinkTarget {
  origin: string;
  pathname: string;
  search: string;
  target: string;
}

export interface CurrentLocation {
  origin: string;
  pathname: string;
}

export function shouldResetOnSamePageNav(
  link: NavLinkTarget,
  location: CurrentLocation,
): boolean {
  if (link.target === "_blank") return false;
  if (link.origin !== location.origin) return false;
  if (link.pathname !== location.pathname) return false;
  if (link.search !== "") return false;
  return true;
}
