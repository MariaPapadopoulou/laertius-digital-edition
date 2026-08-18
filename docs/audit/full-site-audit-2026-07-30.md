# Full-Site Page Audit — 30 July 2026

Every routed page of the Laertius edition (including the integrated Legomena pages) was
loaded in a real headless Chromium browser in **light and dark themes at desktop width
(1280px)** and in **light theme at mobile width (390px)** — 96 page loads in total.
For each load the audit captured a full-page screenshot, browser console errors,
uncaught page errors, failed network requests, horizontal-overflow measurement, and
(in dark mode) any large light-background blocks. On top of that, a functional pass
exercised a representative interaction on all twelve interactive pages.

Artifacts: screenshots and machine-readable results live in
`docs/verification/full-audit/` (`shots/`, `audit-light.json`, `audit-dark.json`,
`audit-mobile.json`); the sweep and interaction scripts are
`scripts/src/e2e-full-audit.mts` and `scripts/src/e2e-audit-interactions.mts`.

## Summary

| | |
|---|---|
| Routes audited | 32 (30 pages + a dynamic-route sample each for section reader, terminology object, Legomena entity/passage + the 404 page) |
| Console / page errors | 1 issue found — **fixed** |
| Failed network requests | 1 issue found (same root cause) — **fixed** |
| Dark-theme problems | none (all pages apply `.dark`, no light blocks) except the homepage, which is intentionally light-only (see Deferred) |
| Mobile overflow | 4 pages affected — **all fixed** |
| Functional interactions | 12/12 pass (Ask, Search, Browse, Competency, Graph, Map, Timeline, Entities, Legomena Ask/SPARQL/Reader/Entity) |

## Issues found and fixed

### 1. Section reader fired a 404 on every Prologue section (functional)
**Pages:** `/section/1.prol.*` (all Book I Prologue sections). **Severity:** medium.
Opening any prologue section requested `/api/claims/Prologue`, which returned
**404 Not Found** (visible as a console error on every load), because "Prologue" is a
corpus chapter owner but not a knowledge-graph philosopher. The API now answers with an
empty claims list for corpus-known chapter owners, while still 404-ing unknown names.
*(`artifacts/api-server/src/routes/graph.ts`)*

### 2. Homepage overflowed 514px horizontally on mobile (layout)
**Page:** `/`. **Severity:** high on phones.
The desktop nav bar and search box never wrapped, pushing the page to ~900px wide, and
the long Greek word **εὐδοκιμησάντων** in the cover headline could not break. The header
now wraps on narrow screens and the headline allows emergency word-breaking.
*(`artifacts/laertius/src/pages/home.tsx`)*

### 3. Letters page filter row overflowed 59px on mobile (layout)
**Page:** `/letters`. **Severity:** low.
The Authenticity chip row (`All / authentic / disputed / spurious`) was `nowrap`; it now
wraps. *(`artifacts/laertius/src/pages/epistles.tsx`)*

### 4. Terminology pages overflowed on mobile (layout)
**Pages:** `/terminology` (23px), `/terminology/concepts` (414px). **Severity:** medium.
- Overview: the ontology **Base URI** code string could not break — now `break-all`.
- Concepts: a long LSJ/Logeion URL inside the *Person* concept definition forced every
  concept card to ~790px width — the definition block now uses `overflow-wrap: anywhere`.
  (Note: `break-words` alone does **not** fix this; it doesn't reduce min-content width.)
*(`artifacts/laertius/src/pages/terminology/overview.tsx`, `concepts.tsx`)*

All four fixes were re-verified with the same headless-browser probes: zero horizontal
overflow and zero console/network errors on the affected pages afterwards.

## Clean pages (no issues in any theme/viewport)

Ask, Search, Browse, Verses, Sayings, Doxography, Anecdotes, Testaments, Graph,
Competency, Map, Timeline, Entities (Index), Stats, About, Section reader (post-fix),
Terminology Objects / Object detail / Proper Names / About the Model, Legomena Ask,
Legomena Graph, Legomena Entities, Legomena Entity detail, Legomena Reader,
Legomena Passage detail, Legomena SPARQL console, and the 404 page.

Highlights confirmed working end-to-end: Ask answers with citations; semantic search
returns section links; the graph responds to node clicks; Leaflet map renders 171
places; the Legomena SPARQL console executes example queries against the live store;
the assertion-store status pill stays hidden when the store is healthy.

## Deferred / noted (owned elsewhere or out of scope)

- **Homepage stays white in dark mode.** The editorial homepage is deliberately a
  self-contained crimson-and-white page and does not adopt the dark theme; theme
  consistency is owned by the theme-drift tasks (#601/#597) and homepage font
  harmonization by #603. Flagged, not changed.
- **Homepage nav dropdowns are hover-only.** On touch devices the submenus (The Text,
  Textual Genres, …) cannot be hovered; the top-level items are however reachable via
  the inner pages' mobile menu. Related to the homepage-dropdown task (#627). Deferred.
- **Terminology "Ontology Viewer (HTML)" button** links root-relative to
  `/api/otb/viewer.html`; fine in dev, but it is the class of link that task #591
  (links escaping the `/laertius` subpath) guards. Noted for that task.
- **Ctrl+Enter vs ⌘+Enter hint** on query editors is owned by task #608. Not touched.

## Source-code export

A zip of the full project source (laertius app, legomena artifact + API, api-server,
shared libs, scripts; excluding `node_modules`, `dist`, build output and data caches)
was produced alongside this report.
