import { RefObject, useEffect, useState } from "react";
import useIntersectionObserver from "./useIntersectionObserver";

// A zero-height line at the viewport's vertical center. An element "intersects"
// only while it straddles this line.
const CENTER_LINE_MARGIN = "-50% 0px -50% 0px";

const isTouchDevice = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// Returns true while `ref` is centered in the viewport, on touch devices only.
// Used to mirror the desktop hover "pop" as the user scrolls the list.
const useCenterSpotlight = (ref: RefObject<Element | null>): boolean => {
  // Evaluated once after mount (avoids SSR/client mismatch and desktop work).
  // Not reactive to mid-session input changes (e.g. attaching a keyboard to a
  // tablet) — touch-capability rarely flips while browsing, so a listener isn't
  // worth the cost.
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(isTouchDevice()), []);

  // Only observe on touch devices. On desktop the return below is always false,
  // so creating the observer would just re-render the card on every scroll for a
  // discarded result — the dominant source of fast-scroll jank on the grid.
  const entry = useIntersectionObserver(ref, { rootMargin: CENTER_LINE_MARGIN, enabled: touch });

  return touch && !!entry?.isIntersecting;
};

export default useCenterSpotlight;
