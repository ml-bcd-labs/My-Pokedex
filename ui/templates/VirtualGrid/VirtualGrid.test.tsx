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
