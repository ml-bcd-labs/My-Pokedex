# Home-Grid Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page's grow-forever card grid with a hand-rolled fixed-size grid virtualizer so only the visible rows (+overscan) are in the DOM, giving smooth fast-scroll on weak/old hardware.

**Architecture:** A generic `<VirtualGrid>` renders only the current slice of items, absolutely positioned at their true coordinates inside a full-height container, so native scrolling is compositor-driven and React re-renders only when the visible row-range crosses an overscan boundary. All windowing math is pure functions (unit-tested); the component adds DOM measurement, a passive rAF-throttled scroll listener, a `ResizeObserver`, and a viewport-agnostic SSR path (first N items as the existing centered flex-wrap, then measure-then-window on mount via `useSyncExternalStore`).

**Tech Stack:** Next.js (Pages Router), React 19, TypeScript, CSS Modules, Vitest + Testing Library (jsdom).

## Global Constraints

- **No new third-party dependencies.** Hand-rolled only.
- **No `useEffect` that derives state from props / cascades renders.** Only "subscribe to external system" and "measure the DOM" Effects are allowed. Client detection uses `useSyncExternalStore`, not an Effect.
- **`VirtualGrid` stays domain-agnostic** — it knows nothing about Pokémon. Anything app-specific (priority hint, resolution) is passed in via props/closures.
- **SSR must not compute rows** (server has no viewport). Server + first hydration pass render `initialCount` items as a normal centered flex-wrap.
- **Card geometry is measured at runtime, never hardcoded.** (Reference values from profiling: card 280×288, gap 28. Used only for test fixtures.)
- **`FlexboxList` is retained** — `pages/fr/index.tsx` still uses it. Only `pages/index.tsx` migrates.
- **Preserve:** LCP first-row eager/priority images, `EmptyListPlaceholder` empty state, `role="status"` count, `BrowseIndex`, touch center-spotlight.
- Test command: `npx vitest run <file>`. Typecheck: `npx tsc --noEmit`. Lint: `npx next lint`.
- Commit trailers (every commit):
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01N5Mf8exi93hVcD2bTvmt7c
  ```

---

### Task 1: Pure windowing math

**Files:**
- Create: `ui/templates/VirtualGrid/windowing.ts`
- Test: `ui/templates/VirtualGrid/windowing.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `columnsFor(containerWidth: number, cardW: number, colGap: number): number`
  - `totalRowsFor(itemCount: number, columns: number): number`
  - `totalHeightFor(totalRows: number, rowPitch: number, cardH: number): number`
  - `rowLeftInset(containerWidth: number, columns: number, cardW: number, colGap: number): number`
  - `positionFor(index: number, columns: number, colPitch: number, rowPitch: number, rowLeftInset: number): { top: number; left: number }`
  - `visibleRange(scrollTop: number, containerTop: number, viewportH: number, rowPitch: number, totalRows: number, overscan: number): { startRow: number; endRow: number }`
  - `firstVisibleIndex(scrollTop: number, containerTop: number, rowPitch: number, columns: number): number`
  - `scrollTopForIndex(index: number, containerTop: number, rowPitch: number, columns: number): number`

- [ ] **Step 1: Write the failing tests**

```ts
// ui/templates/VirtualGrid/windowing.test.ts
import { describe, it, expect } from "vitest";
import {
  columnsFor, totalRowsFor, totalHeightFor, rowLeftInset,
  positionFor, visibleRange, firstVisibleIndex, scrollTopForIndex,
} from "./windowing";

// Reference geometry from profiling: card 280x288, gap 28 => colPitch 308.
const CARD_W = 280, CARD_H = 288, GAP = 28, COL_PITCH = 308, ROW_PITCH = 350;

describe("columnsFor", () => {
  it("fits N columns for a given width", () => {
    expect(columnsFor(1280, CARD_W, GAP)).toBe(4);  // (1280+28)/308 = 4.24 -> 4
    expect(columnsFor(2560, CARD_W, GAP)).toBe(8);  // (2560+28)/308 = 8.40 -> 8
  });
  it("never returns less than 1", () => {
    expect(columnsFor(100, CARD_W, GAP)).toBe(1);
    expect(columnsFor(0, CARD_W, GAP)).toBe(1);
  });
});

describe("totalRowsFor", () => {
  it("ceils items over columns", () => {
    expect(totalRowsFor(1025, 8)).toBe(129);
    expect(totalRowsFor(16, 4)).toBe(4);
  });
  it("is 0 for no columns or no items", () => {
    expect(totalRowsFor(0, 4)).toBe(0);
    expect(totalRowsFor(10, 0)).toBe(0);
  });
});

describe("totalHeightFor", () => {
  it("is (rows-1)*pitch + cardH so the last row has no trailing gap", () => {
    expect(totalHeightFor(4, ROW_PITCH, CARD_H)).toBe(3 * 350 + 288); // 1338
    expect(totalHeightFor(1, ROW_PITCH, CARD_H)).toBe(288);
  });
  it("is 0 for no rows", () => {
    expect(totalHeightFor(0, ROW_PITCH, CARD_H)).toBe(0);
  });
});

describe("rowLeftInset", () => {
  it("centers the row block within the container", () => {
    // 4 cols: rowWidth = 4*280 + 3*28 = 1204; inset = (1280-1204)/2 = 38
    expect(rowLeftInset(1280, 4, CARD_W, GAP)).toBe(38);
  });
  it("never goes negative", () => {
    expect(rowLeftInset(200, 1, CARD_W, GAP)).toBe(0);
  });
});

describe("positionFor", () => {
  const inset = rowLeftInset(1280, 4, CARD_W, GAP); // 38
  it("places index 0 at the inset origin", () => {
    expect(positionFor(0, 4, COL_PITCH, ROW_PITCH, inset)).toEqual({ top: 0, left: 38 });
  });
  it("wraps to the next column then row", () => {
    expect(positionFor(3, 4, COL_PITCH, ROW_PITCH, inset)).toEqual({ top: 0, left: 38 + 3 * 308 });
    expect(positionFor(4, 4, COL_PITCH, ROW_PITCH, inset)).toEqual({ top: 350, left: 38 });
  });
});

describe("visibleRange", () => {
  it("returns visible rows plus overscan, clamped", () => {
    // container at doc-top 500, viewport 844, scrolled to 1900 => relative 1400
    // firstVisible = floor(1400/350)=4, lastVisible=floor((1400+844)/350)=6
    // overscan 2 => start 2, end 8
    expect(visibleRange(1900, 500, 844, ROW_PITCH, 129, 2)).toEqual({ startRow: 2, endRow: 8 });
  });
  it("clamps start at 0 and end at totalRows-1", () => {
    expect(visibleRange(0, 0, 844, ROW_PITCH, 5, 4)).toEqual({ startRow: 0, endRow: 4 });
  });
  it("handles an empty grid", () => {
    expect(visibleRange(0, 0, 844, ROW_PITCH, 0, 2)).toEqual({ startRow: 0, endRow: -1 });
  });
});

describe("firstVisibleIndex / scrollTopForIndex (resize anchor)", () => {
  it("round-trips an index across a column change at the same pitch", () => {
    // at 4 cols, scrolled so row 10 is first visible => index 40
    const top = scrollTopForIndex(40, 500, ROW_PITCH, 4); // 500 + 10*350 = 4000
    expect(top).toBe(4000);
    expect(firstVisibleIndex(4000, 500, ROW_PITCH, 4)).toBe(40);
    // re-anchoring index 40 at 8 cols keeps it near the top of the viewport
    expect(scrollTopForIndex(40, 500, ROW_PITCH, 8)).toBe(500 + 5 * 350); // row 5
  });
  it("clamps negative relative scroll to index 0", () => {
    expect(firstVisibleIndex(100, 500, ROW_PITCH, 4)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run ui/templates/VirtualGrid/windowing.test.ts`
Expected: FAIL — cannot find module `./windowing`.

- [ ] **Step 3: Implement the pure functions**

```ts
// ui/templates/VirtualGrid/windowing.ts

// Number of fixed-width columns that fit in the container. The trailing gap
// after the last column doesn't exist, hence (width + gap) / (card + gap).
export const columnsFor = (containerWidth: number, cardW: number, colGap: number): number =>
  Math.max(1, Math.floor((containerWidth + colGap) / (cardW + colGap)));

export const totalRowsFor = (itemCount: number, columns: number): number =>
  columns > 0 ? Math.ceil(itemCount / columns) : 0;

// (rows - 1) full pitches plus one card box — the last row carries no trailing gap.
export const totalHeightFor = (totalRows: number, rowPitch: number, cardH: number): number =>
  totalRows > 0 ? (totalRows - 1) * rowPitch + cardH : 0;

// Horizontal offset that centres the row block, mirroring justify-content: center.
export const rowLeftInset = (containerWidth: number, columns: number, cardW: number, colGap: number): number => {
  const rowWidth = columns * cardW + (columns - 1) * colGap;
  return Math.max(0, (containerWidth - rowWidth) / 2);
};

export interface GridPosition { top: number; left: number }

export const positionFor = (
  index: number, columns: number, colPitch: number, rowPitch: number, leftInset: number,
): GridPosition => {
  const row = Math.floor(index / columns);
  const col = index % columns;
  return { top: row * rowPitch, left: leftInset + col * colPitch };
};

export interface RowRange { startRow: number; endRow: number }

export const visibleRange = (
  scrollTop: number, containerTop: number, viewportH: number,
  rowPitch: number, totalRows: number, overscan: number,
): RowRange => {
  const relative = scrollTop - containerTop;
  const firstVisible = Math.floor(relative / rowPitch);
  const lastVisible = Math.floor((relative + viewportH) / rowPitch);
  return {
    startRow: Math.max(0, firstVisible - overscan),
    endRow: Math.min(totalRows - 1, lastVisible + overscan),
  };
};

// Index of the first item in the first (partially) visible row — the resize anchor.
export const firstVisibleIndex = (
  scrollTop: number, containerTop: number, rowPitch: number, columns: number,
): number => {
  const relative = Math.max(0, scrollTop - containerTop);
  return Math.floor(relative / rowPitch) * columns;
};

// scrollTop that puts `index`'s row at the top of the container's visible area.
export const scrollTopForIndex = (
  index: number, containerTop: number, rowPitch: number, columns: number,
): number => containerTop + Math.floor(index / columns) * rowPitch;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run ui/templates/VirtualGrid/windowing.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add ui/templates/VirtualGrid/windowing.ts ui/templates/VirtualGrid/windowing.test.ts
git commit -m "feat(virtualgrid): pure fixed-grid windowing math + tests

<trailers>"
```

---

### Task 2: `VirtualGrid` component — SSR flex-wrap, measure, windowed render, scroll

**Files:**
- Create: `ui/templates/VirtualGrid/VirtualGrid.tsx`
- Create: `ui/templates/VirtualGrid/VirtualGrid.module.css`
- Create: `ui/templates/VirtualGrid/useIsClient.ts`
- Test: `ui/templates/VirtualGrid/VirtualGrid.test.tsx`

**Interfaces:**
- Consumes: all exports from `./windowing` (Task 1).
- Produces:
  ```ts
  interface VirtualGridProps<T> {
    items: T[];
    getKey: (item: T) => string | number;
    renderItem: (item: T, index: number) => React.ReactNode;
    initialCount?: number;   // SSR/measure batch, default 48
    overscanRows?: number;   // default 4
    remeasureKey?: unknown;   // changing it forces a re-measure (e.g. resolution)
  }
  export default function VirtualGrid<T>(props: VirtualGridProps<T>): JSX.Element
  // Also produces the hook: useIsClient(): boolean  (false on server + first render)
  ```
- **Layout contract (critical):** each visible item is wrapped in an absolutely-positioned `div[data-vg-card]` of width `cardW` at `positionFor(index,…)`. The wrapper carries **no margin/padding**, so the child card's own `margin-top` is preserved identically to flow layout (measured `rowPitch` already includes it) and the sprite overhang renders unclipped (no `contain`).

- [ ] **Step 1: Write `useIsClient` (no test needed — trivial `useSyncExternalStore` idiom)**

```ts
// ui/templates/VirtualGrid/useIsClient.ts
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// false during SSR and the first client (hydration) render, true thereafter.
// This is the "you might not need an Effect" idiom for client detection.
const useIsClient = (): boolean =>
  useSyncExternalStore(emptySubscribe, () => true, () => false);

export default useIsClient;
```

- [ ] **Step 2: Write the failing component tests**

Note: jsdom has no layout, so we stub `getBoundingClientRect`/`clientWidth`/`offsetTop` on the grid's cards to feed the measure step deterministic geometry.

```tsx
// ui/templates/VirtualGrid/VirtualGrid.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import VirtualGrid from "./VirtualGrid";

const CARD_W = 280, CARD_H = 288, GAP = 28, ROW_PITCH = 350;
const CONTAINER_W = 1280; // -> 4 columns

const items = Array.from({ length: 200 }, (_, i) => ({ id: i, name: `item-${i}` }));
const renderRow = (
  <VirtualGrid
    items={items}
    getKey={(it) => it.id}
    renderItem={(it) => <span data-testid={`card-${it.id}`}>{it.name}</span>}
    initialCount={48}
    overscanRows={2}
  />
);

// Install fake geometry: container width + per-card rects laid out in a 4-col grid.
function installLayout() {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(CONTAINER_W);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const idxAttr = this.getAttribute("data-vg-index");
    if (idxAttr == null) return { top: 0, left: 0, right: CONTAINER_W, bottom: 0, width: CONTAINER_W, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
    const idx = Number(idxAttr);
    const col = idx % 4, row = Math.floor(idx / 4);
    const left = 38 + col * (CARD_W + GAP);
    const top = row * ROW_PITCH;
    return { top, left, right: left + CARD_W, bottom: top + CARD_H, width: CARD_W, height: CARD_H, x: left, y: top, toJSON() {} } as DOMRect;
  });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
}

beforeEach(installLayout);
afterEach(() => vi.restoreAllMocks());

describe("VirtualGrid SSR/first-render (flow) path", () => {
  it("renders exactly initialCount items as flow when geometry isn't measurable", () => {
    // Remove the layout stubs so getBoundingClientRect returns zeros -> measureGrid
    // returns null -> the component stays in the flow/SSR branch. This is the same
    // code path SSR and the first hydration render take.
    vi.restoreAllMocks();
    render(renderRow);
    expect(screen.getByTestId("card-0")).toBeInTheDocument();
    expect(screen.getByTestId("card-47")).toBeInTheDocument();  // initialCount = 48
    expect(screen.queryByTestId("card-48")).not.toBeInTheDocument();
  });
});

describe("VirtualGrid windowed mode", () => {
  it("after measurement, mounts only the visible window (+overscan), far fewer than the list", () => {
    render(renderRow);
    act(() => {
      // measurement runs in a layout effect on mount; range settles to top rows.
      window.dispatchEvent(new Event("scroll"));
    });
    // 4 cols, viewport 844 => ~3 visible rows + 2 overscan below ~= rows 0..4 => <=20 cards
    expect(screen.getByTestId("card-0")).toBeInTheDocument();
    const mounted = items.filter((it) => screen.queryByTestId(`card-${it.id}`));
    expect(mounted.length).toBeLessThanOrEqual(28);
    expect(mounted.length).toBeGreaterThan(0);
    // deep item absent while scrolled to top
    expect(screen.queryByTestId("card-150")).not.toBeInTheDocument();
  });

  it("sets the container to the full computed height", () => {
    const { container } = render(renderRow);
    act(() => { window.dispatchEvent(new Event("scroll")); });
    const outer = container.querySelector("[data-vg-container]") as HTMLElement;
    // 200 items / 4 cols = 50 rows => (50-1)*350 + 288 = 17438
    expect(outer.style.height).toBe("17438px");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run ui/templates/VirtualGrid/VirtualGrid.test.tsx`
Expected: FAIL — cannot find module `./VirtualGrid`.

- [ ] **Step 4: Write the CSS module**

```css
/* ui/templates/VirtualGrid/VirtualGrid.module.css */

/* Measure phase & SSR: identical to the current grid so flow layout is real
   and viewport-correct at any width. Mirrors FlexboxList.module.css .flexbox. */
.flow {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 28px;
}

/* Windowed phase: full-height positioning context. */
.windowed {
  position: relative;
  width: 100%;
}

/* Each windowed item: absolutely positioned, no margin/padding so the child
   card's own margin-top and sprite overhang render exactly as in flow. */
.cell {
  position: absolute;
  top: 0;
  left: 0;
}
```

- [ ] **Step 5: Write the component**

```tsx
// ui/templates/VirtualGrid/VirtualGrid.tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./VirtualGrid.module.css";
import useIsClient from "./useIsClient";
import {
  columnsFor, totalRowsFor, totalHeightFor, rowLeftInset,
  positionFor, visibleRange, type RowRange,
} from "./windowing";

// useLayoutEffect on the client (measure before paint), useEffect on the server
// (avoids React's "useLayoutEffect does nothing on the server" SSR warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface Metrics {
  cardW: number; cardH: number; rowPitch: number; colGap: number;
  containerWidth: number; containerTop: number;
}

interface VirtualGridProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T, index: number) => React.ReactNode;
  initialCount?: number;
  overscanRows?: number;
  remeasureKey?: unknown;
}

// Read grid geometry from the flow-rendered cards. Needs >=2 rows to derive the
// row pitch (which includes each card's margin-top). Returns null if not ready.
function measureGrid(container: HTMLElement): Omit<Metrics, "containerTop"> | null {
  const cards = container.querySelectorAll<HTMLElement>("[data-vg-card]");
  if (cards.length < 2) return null;
  const r0 = cards[0].getBoundingClientRect();
  const cardW = Math.round(r0.width);
  const cardH = Math.round(r0.height);
  const top0 = Math.round(r0.top);
  let rowPitch = 0, colGap = 0;
  for (let i = 1; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (Math.round(r.top) === top0) {
      const prev = cards[i - 1].getBoundingClientRect();
      colGap = Math.round(r.left - prev.right);
    } else {
      rowPitch = Math.round(r.top) - top0;
      break;
    }
  }
  if (!rowPitch || !cardW || !cardH) return null;
  return { cardW, cardH, rowPitch, colGap, containerWidth: container.clientWidth };
}

export default function VirtualGrid<T>({
  items, getKey, renderItem, initialCount = 48, overscanRows = 4, remeasureKey,
}: VirtualGridProps<T>): JSX.Element {
  const isClient = useIsClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [range, setRange] = useState<RowRange>({ startRow: 0, endRow: 0 });

  // Re-enter the flow/measure phase when remeasureKey changes (e.g. resolution),
  // by resetting metrics DURING RENDER — React's documented "adjust state on prop
  // change" pattern, preferred over an Effect. This guarantees the next render is
  // flow layout, so the measure effect below reads flow geometry, never windowed.
  const [prevKey, setPrevKey] = useState(remeasureKey);
  if (remeasureKey !== prevKey) { setPrevKey(remeasureKey); setMetrics(null); }

  // Fresh mirror of metrics for effects that must read it without re-subscribing.
  const metricsRef = useRef<Metrics | null>(null);
  metricsRef.current = metrics;

  // --- MEASURE: runs on the flow-rendered DOM (metrics still null) before paint.
  // The `metricsRef.current` guard makes it a no-op once measured, so an
  // items.length change (filter) doesn't cause a re-measure flash; it only
  // measures again after a remeasureKey reset or when the list first populates.
  useIsoLayoutEffect(() => {
    if (!isClient) return;
    const el = containerRef.current;
    if (!el || metricsRef.current) return;
    const m = measureGrid(el);
    if (!m) return;
    const containerTop = el.getBoundingClientRect().top + window.scrollY;
    setMetrics({ ...m, containerTop });
  }, [isClient, remeasureKey, items.length]);

  const columns = metrics ? columnsFor(metrics.containerWidth, metrics.cardW, metrics.colGap) : 0;
  const totalRows = totalRowsFor(items.length, columns);

  const recomputeRange = useCallback(() => {
    if (!metrics || !columns) return;
    const next = visibleRange(
      window.scrollY, metrics.containerTop, window.innerHeight,
      metrics.rowPitch, totalRows, overscanRows,
    );
    setRange((prev) => (prev.startRow === next.startRow && prev.endRow === next.endRow ? prev : next));
  }, [metrics, columns, totalRows, overscanRows]);

  // --- SUBSCRIBE: passive, rAF-coalesced scroll listener. Most frames early-return
  // inside setRange's identity check (no re-render). External-system Effect.
  useIsoLayoutEffect(() => {
    if (!metrics) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; recomputeRange(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    recomputeRange(); // initial
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [metrics, recomputeRange]);

  // --- FLOW PHASE (SSR, first render, or awaiting measurement) ---
  if (!isClient || !metrics || !columns) {
    return (
      <div ref={containerRef} data-vg-container className={styles.flow}>
        {items.slice(0, initialCount).map((item, index) => (
          <div data-vg-card data-vg-index={index} key={getKey(item)}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // --- WINDOWED PHASE ---
  const { cardW, cardH, rowPitch, colGap, containerWidth } = metrics;
  const colPitch = cardW + colGap;
  const inset = rowLeftInset(containerWidth, columns, cardW, colGap);
  const startIndex = range.startRow * columns;
  const endIndex = Math.min(items.length - 1, (range.endRow + 1) * columns - 1);

  const cells = [];
  for (let index = startIndex; index <= endIndex; index++) {
    const item = items[index];
    if (!item) continue;
    const { top, left } = positionFor(index, columns, colPitch, rowPitch, inset);
    cells.push(
      <div
        key={getKey(item)}
        data-vg-card
        data-vg-index={index}
        className={styles.cell}
        style={{ transform: `translate(${left}px, ${top}px)`, width: cardW }}
      >
        {renderItem(item, index)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      data-vg-container
      className={styles.windowed}
      style={{ height: totalHeightFor(totalRows, rowPitch, cardH) }}
    >
      {cells}
    </div>
  );
}
```

Note on positioning: `transform: translate(x,y)` is used instead of `top/left` so moving cells stays on the compositor and never triggers layout. `data-vg-index` is set in **both** phases so the test's geometry stub and the measure step agree.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run ui/templates/VirtualGrid/VirtualGrid.test.tsx`
Expected: PASS. If the windowed count assertion is off, confirm the stubbed `innerHeight`/rects match the 4-column fixture.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add ui/templates/VirtualGrid/
git commit -m "feat(virtualgrid): windowed grid component with measure + scroll

<trailers>"
```

---

### Task 3: Resize handling with scroll anchoring

**Files:**
- Modify: `ui/templates/VirtualGrid/VirtualGrid.tsx`
- Test: `ui/templates/VirtualGrid/VirtualGrid.test.tsx` (add cases)

**Interfaces:**
- Consumes: `firstVisibleIndex`, `scrollTopForIndex`, `columnsFor` from `./windowing`.
- Produces: no new exports; adds a `ResizeObserver` subscription that updates `containerWidth`/`containerTop` on width change and restores scroll to the anchor item. Card-intrinsic metrics (`cardW`, `cardH`, `rowPitch`, `colGap`) are **not** re-derived on resize (resolution change handles that via `remeasureKey`).

- [ ] **Step 1: Write the failing test**

```tsx
// append to VirtualGrid.test.tsx

describe("VirtualGrid resize", () => {
  it("recomputes columns and preserves the first visible item via scroll anchoring", () => {
    const scrollToSpy = window.scrollTo as unknown as ReturnType<typeof vi.fn>;
    render(renderRow);
    act(() => { window.dispatchEvent(new Event("scroll")); });

    // Simulate a wider container: 8 columns now.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(2560);
    // pretend we were scrolled so row 10 (index 40 at 4 cols) is first visible
    Object.defineProperty(window, "scrollY", { value: 4000, configurable: true });

    act(() => {
      // fire the ResizeObserver callback via the polyfilled observer (see impl note)
      window.dispatchEvent(new Event("resize"));
    });

    // anchor index 40 should be re-placed; scrollTo called to keep it in view
    expect(scrollToSpy).toHaveBeenCalled();
  });
});
```

Implementation note for testability: jsdom has no `ResizeObserver`. The component must **fall back to a `window` `resize` listener when `ResizeObserver` is unavailable**, and use `ResizeObserver` when present. The test drives the `resize` event; production uses `ResizeObserver` on the container.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run ui/templates/VirtualGrid/VirtualGrid.test.tsx -t "resize"`
Expected: FAIL — `window.scrollTo` not called (no resize handling yet).

- [ ] **Step 3: Add resize handling to the component**

Add this Effect after the scroll-subscribe Effect. It reuses `metricsRef` (already declared in Task 2's measure section — do **not** redeclare it):

```tsx
  // --- SUBSCRIBE: container width changes. Card geometry is intrinsic and does
  // NOT change on resize (resolution changes go through remeasureKey), so we only
  // refresh containerWidth/containerTop and re-anchor scroll to the first visible
  // item so the user keeps their place when the column count changes.
  useIsoLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const handle = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const m = metricsRef.current;
        if (!m) return;
        const oldCols = columnsFor(m.containerWidth, m.cardW, m.colGap);
        const anchor = firstVisibleIndex(window.scrollY, m.containerTop, m.rowPitch, oldCols);
        const containerWidth = el.clientWidth;
        const containerTop = el.getBoundingClientRect().top + window.scrollY;
        setMetrics({ ...m, containerWidth, containerTop });
        const newCols = columnsFor(containerWidth, m.cardW, m.colGap);
        window.scrollTo(0, scrollTopForIndex(anchor, containerTop, m.rowPitch, newCols));
      });
    };
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(handle);
      ro.observe(el);
    } else {
      window.addEventListener("resize", handle);
    }
    return () => {
      if (ro) ro.disconnect(); else window.removeEventListener("resize", handle);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
```

Add the `scrollTopForIndex` and `firstVisibleIndex` imports to the existing `./windowing` import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run ui/templates/VirtualGrid/VirtualGrid.test.tsx -t "resize"`
Expected: PASS.

- [ ] **Step 5: Run the whole component + windowing suite**

Run: `npx vitest run ui/templates/VirtualGrid/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/templates/VirtualGrid/VirtualGrid.tsx ui/templates/VirtualGrid/VirtualGrid.test.tsx
git commit -m "feat(virtualgrid): resize handling with scroll anchoring

<trailers>"
```

---

### Task 4: Integrate `VirtualGrid` into the home page

**Files:**
- Modify: `pages/index.tsx`

**Interfaces:**
- Consumes: `VirtualGrid` (default export, Task 2–3).
- Produces: home page renders the full `listSource` through `VirtualGrid`; the infinite-scroll state is removed.

Removes: `POKEMON_STACK_SIZE`, `numberOfPokemonShown`, `setNumberOfPokemonShown`, `incrementNumberOfPokemonShown`, `renderPokemons`, `areThereMorePokemonsToShow`, and the `FlexboxList` import + usage. Keeps: `ABOVE_THE_FOLD` (now the priority cutoff passed via `renderItem` index), the image-preload Effect, `EmptyListPlaceholder`, `role="status"` block, `BrowseIndex`. `useState` import stays only if still used elsewhere in the file (it is not after this change — remove it from the React import if unused; verify with tsc).

- [ ] **Step 1: Replace the imports and the grid usage**

Remove the `FlexboxList` import. Add:

```tsx
import VirtualGrid from "../ui/templates/VirtualGrid/VirtualGrid";
```

Replace the `<FlexboxList …>{renderPokemons()}</FlexboxList>` block (inside `<div className={styles.container}>`) with:

```tsx
<VirtualGrid
  items={listSource}
  getKey={(pokemon) => pokemon.id}
  renderItem={(pokemon, index) => (
    <Pokemon priority={index < ABOVE_THE_FOLD} {...pokemon} />
  )}
  remeasureKey={resolution}
/>
```

- [ ] **Step 2: Delete the now-dead infinite-scroll code**

Delete these lines/blocks from `pages/index.tsx`:
- `const POKEMON_STACK_SIZE = 16;`
- `const [numberOfPokemonShown, setNumberOfPokemonShown] = useState(POKEMON_STACK_SIZE);`
- `const incrementNumberOfPokemonShown = …`
- `const renderPokemon = …` (its body moves inline into `renderItem` above)
- `const renderPokemons = …`
- `const areThereMorePokemonsToShow = …`

Keep `const ABOVE_THE_FOLD = 6;`. If `useState` is no longer referenced anywhere in the file, remove it from `import React, { useState, … }`.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint --dir pages/index.tsx 2>/dev/null || npx next lint`
Expected: no errors, no unused-symbol warnings for the deleted code.

- [ ] **Step 4: Run the full unit suite (guard against regressions)**

Run: `npx vitest run`
Expected: all pass (was 133 at baseline; `windowing` + `VirtualGrid` tests add to that).

- [ ] **Step 5: Commit**

```bash
git add pages/index.tsx
git commit -m "feat(home): render the grid through VirtualGrid, drop infinite scroll

<trailers>"
```

---

### Task 5: End-to-end verification on a throttled profile

**Files:**
- Create: `scripts/perf/verify-virtualgrid.mjs` (CDP harness, adapted from the profiling script)

**Interfaces:**
- Consumes: a built static export in `out/` and a headless Chrome on `--remote-debugging-port=9222`.
- Produces: a pass/fail assertion that the live card-node count stays bounded at full list length, plus long-task/dropped-frame stats.

- [ ] **Step 1: Build the static export**

Run: `npm run build:snapshot`
Expected: `out/index.html` regenerated. (Uses the replay snapshot; no network.)

- [ ] **Step 2: Write the verification harness**

```js
// scripts/perf/verify-virtualgrid.mjs
// Serves out/, drives a throttled fast-fling, asserts the live DOM card count
// stays bounded even at the full list length. Exit 1 on regression.
const BASE = process.argv[2] || "http://localhost:5055";
const CDP = process.argv[3] || "9222";
const MAX_LIVE_CARDS = 120; // windowed grid must never approach the full list
const j = async (p) => (await fetch(`http://127.0.0.1:${CDP}${p}`)).json();
const t = (await j("/json")).find((x) => x.type === "page") || (await j("/json/new?about:blank"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let i = 0; const p = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const { resolve, reject } = p.get(m.id); p.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++i; p.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => { const { result, exceptionDetails } = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails)); return result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setCPUThrottlingRate", { rate: 6 });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: `${BASE}/` }); await sleep(2500);
await ev(`window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration))}).observe({entryTypes:['longtask']});true`);
let maxCards = 0;
for (let pass = 0; pass < 8; pass++) {
  await ev(`window.scrollBy(0, ${1500 + pass * 400});true`);
  for (let k = 0; k < 20; k++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 195, y: 400, deltaX: 0, deltaY: 520 }); await sleep(8); }
  const n = await ev(`document.querySelectorAll('[data-vg-card]').length`);
  maxCards = Math.max(maxCards, n);
}
const stats = await ev(`({longtasks:window.__lt.length,longtaskMax:window.__lt.length?Math.max(...window.__lt):0,total:document.querySelectorAll('[data-vg-card]').length})`);
const ok = maxCards > 0 && maxCards <= MAX_LIVE_CARDS;
console.log(JSON.stringify({ maxLiveCards: maxCards, limit: MAX_LIVE_CARDS, ...stats, pass: ok }, null, 2));
ws.close();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 3: Run the harness**

```bash
(cd out && python3 -m http.server 5055 >/tmp/vg-serve.log 2>&1 &)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --remote-debugging-port=9222 --user-data-dir=/tmp/vg-chrome --no-first-run about:blank >/tmp/vg-chrome.log 2>&1 &
sleep 3
node scripts/perf/verify-virtualgrid.mjs http://localhost:5055 9222; echo "exit=$?"
pkill -f "http.server 5055"; pkill -f "remote-debugging-port=9222"
```

Expected: `"pass": true`, `maxLiveCards` well under 120 even after flinging deep into the list; `longtaskMax` small. If `pass` is false, the window isn't bounding the DOM — stop and debug before merging.

- [ ] **Step 4: Commit the harness**

```bash
git add scripts/perf/verify-virtualgrid.mjs
git commit -m "test(perf): CDP harness asserting VirtualGrid bounds live node count

<trailers>"
```

- [ ] **Step 5: Final gate — full suite + typecheck + lint**

Run: `npx vitest run && npx tsc --noEmit && npx next lint`
Expected: all green.

---

## Notes for the implementer

- **Do not** add `content-visibility` to cards — it clips the −86px sprite overhang and gave no measurable benefit (see spec §"content-visibility rejected").
- **Do not** reach for the DoD/manual-DOM-recycling escalation unless Task 5 shows the throttled fling missing frame budget; it's documented in the spec but out of scope here.
- The measured 280/288/28 numbers are **fixtures for tests only**; production reads them from the DOM so the component survives CSS changes.
- The `/fr/` grid is intentionally left on `FlexboxList`; a later change migrates it to `VirtualGrid`.
```
