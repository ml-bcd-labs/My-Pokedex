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
