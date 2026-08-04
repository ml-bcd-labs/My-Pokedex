import { useEffect, useState } from "react";

const SRC = "/data/pokemons.json";

// The home grid renders from an inlined slice (the first INLINE_COUNT items in
// __NEXT_DATA__) so hydration parses only what the initial viewport needs. This
// hook fetches the full ~1025-item list from a static JSON file after hydration
// — on requestIdleCallback (with a scroll fallback and a single retry) — and
// swaps it in. SSR and the first client render both return `initial`, so there
// is no hydration mismatch; the list only grows once the fetch resolves.
export default function useDeferredPokemons(initial: IBasicPokemon[]): IBasicPokemon[] {
  const [full, setFull] = useState<IBasicPokemon[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (retry = true): Promise<void> => {
      try {
        const res = await fetch(SRC, { priority: "low" } as RequestInit);
        if (!res.ok) throw new Error(String(res.status));
        const data: IBasicPokemon[] = await res.json();
        if (!cancelled) setFull(data);
      } catch {
        if (retry && !cancelled) return load(false);
      }
    };

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      void load();
    };

    const ric =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(start, { timeout: 3000 })
        : setTimeout(start, 1200);

    // First scroll is a strong signal the user wants more than the inlined slice;
    // fetch immediately rather than waiting out the idle timeout.
    const onScroll = () => start();
    window.addEventListener("scroll", onScroll, { passive: true, once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      if (typeof requestIdleCallback === "function") {
        if (typeof cancelIdleCallback === "function" && typeof ric === "number") {
          cancelIdleCallback(ric);
        }
      } else {
        clearTimeout(ric as ReturnType<typeof setTimeout>);
      }
    };
  }, []);

  return full ?? initial;
}
