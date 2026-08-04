# Home hydration performance — design

**Date:** 2026-08-04
**Branch:** `perf/home-hydration-islands` (off `perf/home-lcp-hydration`)
**Status:** Approved (design), pending implementation plan

## Problem

A production Chrome DevTools profile of the home page (`/`) under 20× CPU throttle + 3G shows
a **~2.7 s `Next.js-hydration` long task** dominating the main thread, with the JS heap and node
count climbing to **~9,819 nodes / ~3,096 listeners**. LCP/FCP fire early off the SSG HTML (the
existing SSR work holds), so the remaining cost is **static content being hydrated as if it were
interactive**.

This app is **Pages Router + static export** (`output: "export"`), so there is no RSC boundary —
the entire page tree hydrates on the client. Three stacked culprits:

1. **~1,000-anchor `BrowseIndex`** (A–Z `<details>` of all Pokémon links) — no listeners, but
   React reconciles ~3,000 static nodes at hydration. Largest node contributor.
2. **~122 KB `__NEXT_DATA__`** — all 1,025 Pokémon (`id,name,types,stats,evolvesFrom,slug`)
   inlined and parsed synchronously on the main thread, though only 48 cards render initially.
3. **48 mounted `next/link` cards** — each a client component with a viewport-entry prefetch
   effect + several hooks.

`VirtualGrid` already caps initial mount to 48 cards; that win stays. This work targets the three
sources above plus a CLS cleanup.

## Non-goals

- No migration to the App Router (out of scope for this pass; noted as the long-term fix).
- No CSS sprite sheet for images — it would remove `<img alt>` and kill image-search/GEO
  discoverability. Rejected.
- No AVIF/byte-shaving pipeline in this pass — scoped as an optional follow-up.

## SEO / GEO invariant

**All 1,025 internal Pokémon links must remain in the served static HTML**, because non-JS AI
crawlers (GPTBot, ClaudeBot, PerplexityBot) and Googlebot read the HTML, not the hydrated tree.
Every change below preserves the raw HTML bytes crawlers see. This is the hard gate for #1.

## Changes

### 1. De-hydrate `BrowseIndex` (static island)

`BrowseIndex` never changes and has no interactivity (native `<details>` + `<a>` need zero JS).
Build its markup to an HTML string at build time (in `getStaticProps`) and render it via
`dangerouslySetInnerHTML` + `suppressHydrationWarning` inside a `memo`'d wrapper. React then owns
**one opaque node** instead of reconciling ~3,000. It also stops consuming the runtime Pokémon
array, which unblocks change #2.

- Generate the string with `renderToStaticMarkup` of the existing `BrowseIndex` JSX (same
  component, same output) at build time; pass as a `browseIndexHtml` prop.
- Client render: `<nav ... dangerouslySetInnerHTML={{ __html: browseIndexHtml }} suppressHydrationWarning />`.
- **Verification gate:** `diff` the `<details>` block in `out/index.html` before vs after — must be
  **byte-identical**. Any diff fails the change.

### 2. Async Pokémon list (out of the sync hydration parse)

Only 48 cards render initially, but `VirtualGrid` windows over all 1,025. Deliver the full list
without inlining it in `__NEXT_DATA__`:

- Inline only the first ~48 items (what the SSR grid needs) in props.
- Emit the full 1,025-item list as a static `public/data/pokemons.json` at build time.
- Client: grid seeds its window from the inlined 48; a `requestIdleCallback` (with a first-scroll
  fallback) fetches `pokemons.json`, then `setState` fills the full window. Skeleton placeholders
  cover any gap so a fast scroll degrades gracefully rather than breaking.
- On fetch failure: retry once, then fall back to the 48 (grid still usable; deep pages remain
  reachable via BrowseIndex + search).
- Seed `PokemonContext` from the inlined 48 first, eliminating the current post-hydration
  full-list re-seed re-render.

### 3. Cheaper cards

- `prefetch={false}` on the card `next/link`. In the **Pages Router**, `false` disables
  *viewport-entry* prefetch (the costly part firing ×48 at hydration) but **keeps prefetch on
  hover** — so SPA nav is preserved and a card the user is about to click still preloads on
  mouse-enter. (Verified against Next 16 docs.)
- Gate `useCenterSpotlight` out **at the call site** for non-touch devices so the hook (state +
  effect + IntersectionObserver) does not run on desktop across 48 cards.

### 4. Image CLS

- Add intrinsic `width`/`height` to every card `<img>` to remove the layout-shift markers seen in
  the trace (CLS is a positive ranking signal).
- Confirm the 6 above-the-fold images keep `loading="eager"` + `fetchPriority="high"` + the
  existing `ReactDOM.preload`.

## Affected files (initial estimate)

- `pages/index.tsx` — `getStaticProps` (emit `browseIndexHtml` + slim props + write JSON), grid
  seeding, PokemonContext seed.
- `ui/components/BrowseIndex/BrowseIndex.tsx` — split into build-time markup source + de-hydrated
  wrapper.
- `ui/templates/VirtualGrid/VirtualGrid.tsx` — accept an async-filled list, skeletons.
- `ui/components/Pokemon/Pokemon.tsx` — `prefetch={false}`, gate `useCenterSpotlight`, `<img>`
  dimensions.
- Build step for `public/data/pokemons.json` (in `getStaticProps` or a small build script).

## Verification

1. **SEO gate:** `out/index.html` `<details>` block byte-identical before/after (#1).
2. **Perf:** re-run the same 20× CPU / 3G profile; expect the ~2.7 s hydration long task to shrink
   and node count to drop well below ~9,819.
3. **Functional:** manual click-through — grid nav (SPA + hover prefetch), BrowseIndex links,
   scroll-to-fill (idle load + skeletons), no CLS on card images.
4. **Regression:** `npm test` stays green (155 baseline); `tsc --noEmit` + `next lint` clean.

## Rollback

Each change is independent and can be reverted in isolation. #1 and #2 are the high-value pair; #3
and #4 are low-risk polish.
