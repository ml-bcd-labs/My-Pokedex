# Home-grid virtualization — design

## Problem

The home page grid renders every loaded Pokémon card into the DOM. It grows via
an infinite-scroll "load 16 more" sentinel up to the full ~1025 entries — tens of
thousands of DOM nodes. Fast scrolling feels janky, and the target is smooth
scrolling (aiming at the display's refresh ceiling) even on very old, weak
hardware.

Two causes were found by profiling (6× CPU-throttled Chrome over CDP, real
wheel-fling input, instrumented `IntersectionObserver`):

1. **Discarded per-card observers (fixed already).** `useCenterSpotlight` created
   one center-line `IntersectionObserver` per card on *every* device — 176 at 176
   cards. Each fired `setState` on scroll, re-rendering the card, and on desktop
   the result (`touch && …`) was always discarded: 242 wasted re-renders per
   fling. Fixed by gating observer creation on `touch` in
   `hooks/useIntersectionObserver.ts` (new `enabled` option) +
   `hooks/useCenterSpotlight.ts`. This restores the original intent of the
   scroll-spotlight spec, whose code only gated the return value, not the
   observer.
2. **Unbounded node count (this spec).** No virtualization and no
   `content-visibility`; every card stays fully laid-out and paintable. This is
   what the windowed grid below addresses.

`content-visibility: auto` was rejected: an A/B injection showed negligible gain
at realistic card counts, it leaves the full ~40k-node DOM resident in memory
(unaffordable on the target device), and `contain: paint` would clip the sprite
that breaks 86px out of the top of each card (`.heroWrap { margin: -86px … }`).

## Measured facts (drive the design)

- Every card is a **uniform 280×288px** — no exceptions across the loaded set.
  This makes it fixed-size grid windowing, not masonry.
- Grid gap is **28px**, `justify-content: center`. Columns depend on container
  width (4 at 1280px, 8 at ~2560px).
- All ~1025 entries are already in memory client-side (SSG props), so the full
  list can be windowed directly — no data fetching on scroll.

## Behavior

- The visible rows (plus a small overscan) are the only cards in the DOM
  (~30–80 nodes regardless of list length or scroll depth).
- The page scrolls natively (document scroll, not an inner scroller). Scrollbar
  reflects the **full** height of all matches from first render after mount.
- Search/type filtering feeds a shorter `items` array; height recomputes and
  scroll resets to top.
- Touch center-spotlight still works — it observes only the live cards, still
  gated to touch.
- `BrowseIndex` (all ~1025 crawlable links) is untouched — SEO unaffected.

## Mechanism

### Layout — absolute positioning at true coordinates

- An outer container has an explicit height = `rows × rowPitch − gap`, where
  `rows = ceil(itemCount / columns)`. This gives the native scrollbar the correct
  full range.
- Each visible card is absolutely positioned at its true coordinate:
  `top = row × rowPitch`, `left = rowLeftInset + col × colPitch`, where
  `colPitch = cardW + gap`, `rowPitch` is measured (see below), and
  `rowLeftInset` centres the row (`(containerWidth − (columns×cardW +
  (columns−1)×gap)) / 2`) to preserve `justify-content: center`.
- Because cards sit at their true document positions, **native scrolling moves
  them with zero JS/React per frame** — the browser composites; nothing runs.

### Windowing — React renders only the current slice

- React renders `items[start … end]` where the range covers the visible rows +
  `OVERSCAN` rows above and below.
- Cards use stable `key={id}`, so shifting the window unmounts only the row
  leaving and mounts the row entering; the rest are reused.
- The slice is re-rendered **only when the visible range crosses the overscan
  buffer edge** — a few times per fling, never per row or per frame. Scroll
  position is read from the event into a ref, never stored in React state.

### Scroll handling — plain JS on the hot path

- A single **passive, `requestAnimationFrame`-coalesced** scroll listener (plain
  JS, attached once) reads `scrollY`, computes the needed range with integer
  math, and **early-returns while still inside the mounted buffer** — the common
  case, so most frames do nothing. Only a buffer-edge crossing hands React a new
  range.

### Measurement — the only unavoidable DOM read

- Card size, `rowPitch` (row-to-row distance, which includes the `margin-top`
  that makes room for the −86px sprite overhang), and column count are read from
  two real rendered cards after first paint — **measured, never hardcoded**, so
  the component can't drift if CSS changes.
- Re-measured on container resize via `ResizeObserver` (rAF-coalesced) and on
  resolution-context change (low-res pixel mode may alter pitch).

### Resize

On width change: columns recompute, total height recomputes
(`rows = ceil(n/columns)`), positions and the live window re-derive from the new
measured width/height. To avoid teleporting the user when column count changes
the row an item sits on, the component **anchors to the first visible item's
index and restores the scroll offset to that item after recompute**. Covers
window drags, devtools, rotation, and browser zoom.

### SSR / hydration — viewport-agnostic

The server has no viewport, so it must not compute rows. Instead:

- **Server + first hydration pass:** render the first `INITIAL_SSR_COUNT`
  (~48) items as the existing responsive **centered flex-wrap** (no absolute
  positioning, no row math). Flexbox reflows correctly at every width by
  construction — 2 columns on a phone, 8 on a 5K — so the LCP hero and
  above-the-fold copy are in the static HTML and correct at any viewport.
  `INITIAL_SSR_COUNT` is over-provisioned to fill the largest realistic fold.
- **After mount:** `useSyncExternalStore` reports client, the measurement runs,
  and the component switches to windowed mode (absolute positions, full height,
  small DOM). Only the scrollbar thumb resizes at handoff; content does not move
  (no CLS).

## `useEffect` audit

React's "You Might Not Need an Effect" warns against Effects that derive state
from props or cascade renders. This design has none of those. Column count, row
range, total height, and positions are **computed during render**, not synced by
an Effect. The Effects that remain are the sanctioned "connect to an external
system / measure the DOM" category:

1. **Layout measurement** (`useLayoutEffect` / ref callback) — cannot measure
   rendered layout during render. Re-runs on resize / resolution change.
2. **Subscription** — attach/detach the window scroll + resize (`ResizeObserver`)
   listeners.
3. **Client detection** — `useSyncExternalStore` (the no-Effect idiom) for the
   SSR→windowed handoff.

## Components

- **`ui/templates/VirtualGrid/VirtualGrid.tsx`** (new) — generic, Pokémon-unaware.
  Props: `items: T[]`, `renderItem: (item: T, index: number) => JSX.Element`,
  `getKey: (item: T) => string | number`, `priorityCount: number` (first-row
  eager/priority hint), `initialCount: number` (SSR batch). Owns measurement,
  windowing, scroll/resize subscription, SSR handoff.
- **`ui/templates/VirtualGrid/windowing.ts`** (new) — **pure functions**, no DOM,
  unit-tested:
  - `columnsFor(containerWidth, cardW, gap) → columns`
  - `visibleRange(scrollTop, containerTop, viewportH, rowPitch, totalRows,
    overscan) → { startRow, endRow }`
  - `totalHeight(itemCount, columns, rowPitch, gap) → px`
  - `positionFor(index, columns, cardW, colPitch, rowPitch, rowLeftInset) →
    { top, left }`
- **`pages/index.tsx`** — replace `FlexboxList` + the infinite-scroll state
  (`numberOfPokemonShown`, `POKEMON_STACK_SIZE`, `ABOVE_THE_FOLD`,
  `incrementNumberOfPokemonShown`, `areThereMorePokemonsToShow`) with
  `<VirtualGrid items={listSource} … />`. Keep the first-row image-preload
  effect and the `EmptyListPlaceholder` branch.
- **`ui/templates/FlexboxList/`** — **retained unchanged.** Only `pages/index.tsx`
  migrates to `VirtualGrid`; `pages/fr/index.tsx` still imports and uses
  `FlexboxList`, so it is not removed. (The `/fr/` grid migrates to `VirtualGrid`
  in a later change — see Out of scope.)
- **`hooks/useIntersectionObserver.ts`**, **`hooks/useCenterSpotlight.ts`** —
  already changed (observer gating); no further change.

## Testing

- **Unit (Vitest):** `windowing.ts` pure functions — columns across widths, range
  across scroll positions and overscan, total height, positions, and the
  resize-anchor index math. No DOM needed.
- **Behavioral:** `VirtualGrid` with injected measurements (jsdom has no layout)
  — asserts only the windowed slice mounts, keys are stable across a shift, and
  the SSR pass renders `initialCount` items.
- **Verification (CDP harness, reused from profiling):** 6× CPU-throttled
  fast-fling on the built export — assert live node count stays bounded
  (~≤80 cards) at full list length, and record long-task / dropped-frame stats.

## Performance-escalation path (documented, not built)

If the throttled fling misses frame budget because the occasional slice
re-render is too heavy, escalate in order — measuring after each: (1) imperatively
set the visible block's `transform` between renders; (2) recycle a fixed DOM pool
imperatively (the "DoD" end state), accepting the maintainability cost of
reimplementing the card outside React. Not built speculatively: the measured
bottleneck was observers + node count, not card rendering.

## Out of scope

- The French `/fr/` grid (same component applies later; not this change).
- Detail-page scrolling.
- `content-visibility` (rejected above).
