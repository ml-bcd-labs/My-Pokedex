import { JSX, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./VirtualGrid.module.css";
import useIsClient from "./useIsClient";
import {
  columnsFor, totalRowsFor, totalHeightFor, rowLeftInset,
  positionFor, visibleRange, firstVisibleIndex, scrollTopForIndex, type RowRange,
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
