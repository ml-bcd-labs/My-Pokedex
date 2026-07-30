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
