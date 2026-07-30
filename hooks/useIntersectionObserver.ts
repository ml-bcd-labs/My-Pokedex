import { RefObject, useEffect, useState } from "react";

// `enabled` (default true) lets a caller opt out of ever creating the observer —
// used by useCenterSpotlight so desktop (non-touch) cards attach nothing and
// never re-render on scroll from a result they'd discard anyway.
const useIntersectionObserver = (
  elementRef: RefObject<Element | null> | null,
  { threshold = 0, root = null, rootMargin = "0%", enabled = true }: IntersectionObserverInit & { enabled?: boolean }
): IntersectionObserverEntry | undefined => {
  const [entry, setEntry] = useState<IntersectionObserverEntry>();

  const updateEntry = ([newEntry]: IntersectionObserverEntry[]): void => setEntry(newEntry);

  useEffect(() => {
    const node = elementRef?.current;
    const hasIOSupport = !!window.IntersectionObserver;

    if (!enabled || !hasIOSupport || !node) {
      return;
    }

    const observerParams = { threshold, root, rootMargin };
    const observer = new IntersectionObserver(updateEntry, observerParams);

    observer.observe(node);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementRef, enabled]);

  return entry;
};

export default useIntersectionObserver;
