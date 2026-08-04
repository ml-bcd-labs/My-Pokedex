# Home Hydration Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the ~2.7 s home-page hydration long task (20× CPU / 3G) by de-hydrating the static BrowseIndex, moving the 1,025-item list off the synchronous hydration parse, dropping viewport prefetch, and fixing image CLS — without removing any crawlable link from the served HTML.

**Architecture:** Pages Router + static export (`output: "export"`). The whole page hydrates client-side. We turn the static ~1,000-anchor BrowseIndex into an opaque `dangerouslySetInnerHTML` island (React stops reconciling ~3,000 nodes), ship the full Pokémon list as a lazily-fetched `public/data/pokemons.json` instead of inlining it in `__NEXT_DATA__`, and make cards cheaper with hover-only prefetch.

**Tech Stack:** Next.js 16 (Pages Router, static export), React 19, TypeScript, Vitest + Testing Library.

## Global Constraints

- **SEO invariant:** All 1,025 Pokémon `/pokemon/<slug>` links MUST remain in the served static HTML (`out/index.html`). Non-JS AI crawlers read HTML, not the hydrated tree. Enforced by a byte-diff gate on the `<details>` block.
- **No App Router migration. No CSS sprite sheet. No AVIF pipeline** (all deferred/rejected per spec).
- **Baseline:** `npm test` = 155 tests green must stay green. `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/next lint` must stay clean.
- **Package manager:** npm (not yarn).
- Card image dimensions must reflect the true intrinsic sprite pixels (determine from a sample file, Task 3).

---

### Task 1: De-hydrate BrowseIndex into a static island

**Files:**
- Modify: `ui/components/BrowseIndex/BrowseIndex.tsx` — extract the inner `<details>` subtree into an exported `BrowseIndexContent` component; `BrowseIndex` keeps its current public signature and renders `<nav><BrowseIndexContent/></nav>` (other pages unaffected).
- Create: `ui/components/BrowseIndex/BrowseIndexStatic.tsx` — de-hydrated wrapper used only by the home page.
- Modify: `pages/index.tsx` — `getStaticProps` builds the markup string; page renders `BrowseIndexStatic`.
- Test: `ui/components/BrowseIndex/BrowseIndexStatic.test.tsx`

**Interfaces:**
- Produces: `BrowseIndexContent({ sections, anchorId }): JSX.Element` — the `<details>…</details>` subtree only (no `<nav>`). `anchorId(key: string): string` stays an internal helper of BrowseIndex, exported for reuse.
- Produces: `BrowseIndexStatic({ html, ariaLabel, className }): JSX.Element` where `html: string` is prebuilt inner markup. Renders `<nav className={className} aria-label={ariaLabel} dangerouslySetInnerHTML={{ __html: html }} suppressHydrationWarning />`.
- Consumes (in `getStaticProps`): `renderToStaticMarkup` from `react-dom/server`, `BrowseIndexContent`, `groupAlphabetically`, `pokemonBrowseItems`.

- [ ] **Step 1: Write the failing test** — `BrowseIndexStatic.test.tsx`

```tsx
import { render } from "@testing-library/react";
import BrowseIndexStatic from "./BrowseIndexStatic";

test("renders provided html verbatim inside a labelled nav without hydrating children", () => {
  const html = '<details><summary>Browse</summary><a href="/pokemon/pikachu">Pikachu</a></details>';
  const { container } = render(
    <BrowseIndexStatic html={html} ariaLabel="Browse all Pokémon" className="browse" />,
  );
  const nav = container.querySelector("nav");
  expect(nav).toHaveAttribute("aria-label", "Browse all Pokémon");
  expect(nav).toHaveClass("browse");
  expect(nav?.innerHTML).toBe(html);
  expect(container.querySelector('a[href="/pokemon/pikachu"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run ui/components/BrowseIndex/BrowseIndexStatic.test.tsx`
Expected: FAIL — module `./BrowseIndexStatic` does not exist.

- [ ] **Step 3: Extract `BrowseIndexContent` from `BrowseIndex.tsx`**

Move the `<details>…</details>` JSX (current lines 28–65) into a new exported component in the same file; keep `anchorId` and export it. `BrowseIndex` now returns `<nav …><BrowseIndexContent sections={sections} anchorId={anchorId} /></nav>`. Do NOT change `BrowseIndex`'s props or output.

```tsx
export const anchorId = (key: string) => `browse-${key === "#" ? "num" : key}`;

export const BrowseIndexContent = ({ sections }: { sections: BrowseSection[] }) => (
  <details className={styles.details}>
    <summary className={styles.summary}>{/* heading passed via a prop — see below */}</summary>
    {/* …exact existing jumpbar + groups markup, unchanged… */}
  </details>
);
```

Note: `<summary>` currently shows `heading`. Keep `heading` a prop of `BrowseIndexContent` so the string is identical. Full signature: `BrowseIndexContent({ heading, sections }: { heading: string; sections: BrowseSection[] })`.

- [ ] **Step 4: Create `BrowseIndexStatic.tsx`**

```tsx
interface IProps {
  html: string;
  ariaLabel: string;
  className: string;
}

const BrowseIndexStatic = ({ html, ariaLabel, className }: IProps) => (
  <nav className={className} aria-label={ariaLabel} dangerouslySetInnerHTML={{ __html: html }} suppressHydrationWarning />
);

export default BrowseIndexStatic;
```

- [ ] **Step 5: Run the component test to verify it passes**

Run: `./node_modules/.bin/vitest run ui/components/BrowseIndex/BrowseIndexStatic.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire `getStaticProps` to build the markup string**

In `pages/index.tsx`, resolve the EN heading/aria strings for build (they currently come from the `useStrings()` hook, which is client-only). Determine the non-hook accessor: `grep -rn "browsePokemonHeading" locales hooks utils` and import the EN strings object directly (e.g. `locales/en.json` or a `getStrings("en")` helper). Then:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { BrowseIndexContent } from "../ui/components/BrowseIndex/BrowseIndex";
import browseStyles from "../ui/components/BrowseIndex/BrowseIndex.module.css";
// ...
export async function getStaticProps() {
  const pokemons = await fetchAllPokemons();
  const sections = groupAlphabetically(pokemonBrowseItems(pokemons, "/pokemon/"), "en");
  const en = /* resolved EN strings */;
  const browseIndexHtml = renderToStaticMarkup(
    <BrowseIndexContent heading={en.browsePokemonHeading} sections={sections} />,
  );
  return {
    props: {
      pokemons,
      browseIndexHtml,
      browseAria: en.browsePokemonAria,
      browseClassName: browseStyles.browse,
    },
  };
}
```

Update `IProps` to add `browseIndexHtml: string; browseAria: string; browseClassName: string;`. Replace the `<BrowseIndex … sections={…} />` JSX (lines 114–118) with:

```tsx
<BrowseIndexStatic html={browseIndexHtml} ariaLabel={browseAria} className={browseClassName} />
```

Remove the now-unused `BrowseIndex`, `pokemonBrowseItems`, `groupAlphabetically`, `strings.browse*` imports/usages from the render path (they remain used inside `getStaticProps`).

- [ ] **Step 7: SEO byte-identical gate**

```bash
git stash push -u -m "t1-wip-$(date +%s)"   # capture current out/ baseline first if needed
./node_modules/.bin/next build   # produces out/index.html
```
Extract the `<details …>…</details>` block from `out/index.html` on the pre-change build and the post-change build and diff them. They MUST be byte-identical (same classes, attributes, order, anchor list). Practical check:
```bash
# On master/pre-change vs this branch, compare the anchor set + details markup:
grep -o '<details[^>]*>.*</details>' out/index.html   # or a node script slicing the block
```
Expected: identical `<details>` block, all `/pokemon/` anchors present (1,079). If they differ, fix the markup/attribute source until identical before proceeding.

- [ ] **Step 8: Full suite + typecheck + lint**

Run: `npm test && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/next lint`
Expected: 156 tests green (155 + new), no TS errors, no lint errors.

- [ ] **Step 9: Commit**

```bash
git add ui/components/BrowseIndex pages/index.tsx
git commit -m "perf(home): de-hydrate BrowseIndex into a dangerouslySetInnerHTML island"
```

---

### Task 2: Hover-only prefetch on grid cards

**Files:**
- Modify: `ui/components/Pokemon/Pokemon.tsx:72` — change `prefetch` to `prefetch={false}`.
- Test: `ui/components/Pokemon/Pokemon.test.tsx` (create if absent; otherwise add a case).

**Interfaces:** none changed. In Pages Router, `prefetch={false}` disables viewport-entry prefetch but keeps prefetch on hover (verified against Next 16 docs).

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react";
import Pokemon from "./Pokemon";
// render inside required context providers (see existing test setup / test-utils);
// assert the anchor still carries the correct href so SPA + crawl nav is intact.
test("card links to the detail page (hover-prefetch, no eager viewport prefetch)", () => {
  const { container } = render(/* <Providers><Pokemon {...fixture} /></Providers> */);
  const a = container.querySelector('a[href="/pokemon/bulbasaur"]');
  expect(a).not.toBeNull();
});
```

If a Pokemon test/fixture + provider wrapper already exists, reuse it; otherwise find the pattern with `grep -rln "PokemonContext" __tests__ ui/**/**.test.tsx` and mirror it. (There is no public API to assert "prefetch disabled" — the href assertion guards the navigation contract; the prefetch change is verified in the profile at Task 5.)

- [ ] **Step 2: Run test to verify current behavior / fixture wiring**

Run: `./node_modules/.bin/vitest run ui/components/Pokemon/Pokemon.test.tsx`
Expected: PASS with current `prefetch` (this test guards the href contract across the change).

- [ ] **Step 3: Change the prop**

In `ui/components/Pokemon/Pokemon.tsx`, line 72: `prefetch` → `prefetch={false}`. Leave the `useCenterSpotlight(cardRef)` call as-is — it is already desktop-gated internally (no observer, no scroll re-render on desktop) and cannot be conditionally skipped without violating rules of hooks.

- [ ] **Step 4: Run test to verify it still passes**

Run: `./node_modules/.bin/vitest run ui/components/Pokemon/Pokemon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/components/Pokemon/Pokemon.tsx ui/components/Pokemon/Pokemon.test.tsx
git commit -m "perf(home): hover-only prefetch on grid cards (prefetch={false})"
```

---

### Task 3: Fix card image CLS

**Files:**
- Modify: `ui/components/Pokemon/Pokemon.tsx` — add intrinsic `width`/`height` to the hero `<img>` (lines 89–98) and the evo `<img>` (line 83).

**Interfaces:** none changed.

- [ ] **Step 1: Determine intrinsic sprite dimensions**

Both resolutions must share one intrinsic aspect ratio for a stable box. Inspect a sample of each:
```bash
node -e "const s=require('sharp'); Promise.all([s('public/pokemon/pixel/6.webp').metadata(), s('public/pokemon/basic/000006.webp').metadata()]).then(m=>console.log(m.map(x=>x.width+'x'+x.height)))"
```
Use the pixel sprite's intrinsic size for the `width`/`height` attributes (the CSS scales it; the attributes only set the aspect-ratio box to prevent shift). Record the values.

- [ ] **Step 2: Add a failing test**

In `Pokemon.test.tsx`, assert the hero image exposes intrinsic dimensions:
```tsx
test("hero image declares intrinsic width/height to reserve layout box", () => {
  const { container } = render(/* <Providers><Pokemon {...fixture} /></Providers> */);
  const img = container.querySelector('img[alt$="artwork"]') as HTMLImageElement;
  expect(img.getAttribute("width")).toBeTruthy();
  expect(img.getAttribute("height")).toBeTruthy();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run ui/components/Pokemon/Pokemon.test.tsx`
Expected: FAIL — width/height absent.

- [ ] **Step 4: Add `width`/`height` to both `<img>`s**

Add `width={W} height={H}` (values from Step 1) to the hero `<img>` and the evo `<img>`. Do not change `src`, `loading`, `fetchPriority`, `className`, or the `heroRef`/`onLoad` behavior. Confirm the priority hero keeps `loading="eager"` + `fetchPriority="high"`.

- [ ] **Step 5: Run test + verify no visual regression**

Run: `./node_modules/.bin/vitest run ui/components/Pokemon/Pokemon.test.tsx` → PASS.
Then verify rendered size is unchanged (CSS still governs display size) using headless Chrome/CDP per the repo's CSS-verification practice: card image box dimensions must match pre-change.

- [ ] **Step 6: Commit**

```bash
git add ui/components/Pokemon/Pokemon.tsx ui/components/Pokemon/Pokemon.test.tsx
git commit -m "perf(home): declare intrinsic card image dimensions to kill CLS"
```

---

### Task 4: Async Pokémon list (out of `__NEXT_DATA__`)

**Files:**
- Modify: `pages/index.tsx` — inline only the first N items; emit full list to `public/data/pokemons.json`; add idle/first-scroll fetch + skeleton fill; seed context from the inlined slice.
- Create: `hooks/useDeferredPokemons.ts` — loads the full list after hydration.
- Test: `hooks/useDeferredPokemons.test.ts`, and an integration assertion on `pages/index.tsx` props.

**Interfaces:**
- Produces: `useDeferredPokemons(initial: IBasicPokemon[]): IBasicPokemon[]` — returns `initial` immediately, then the full list once `/data/pokemons.json` resolves (on `requestIdleCallback`, with a `scroll` fallback and a single retry). SSR/first-render returns `initial` (no mismatch).
- Consumes: the inlined `pokemons` prop (first `INLINE_COUNT` items) and static `public/data/pokemons.json`.

**Decision — JSON emission:** write `public/data/pokemons.json` from `getStaticProps` via `fs.writeFileSync`. `output: "export"` copies `public/` into `out/` after page generation, so the file lands in `out/data/pokemons.json`. Verify this in Step 6; if the copy ordering fails, fall back to a `postbuild` npm script that reads the snapshot and writes `out/data/pokemons.json`.

- [ ] **Step 1: Write the failing hook test** — `hooks/useDeferredPokemons.test.ts`

```ts
import { renderHook, waitFor } from "@testing-library/react";
import useDeferredPokemons from "./useDeferredPokemons";

test("returns initial slice, then the full list after fetch resolves", async () => {
  const initial = [{ id: 1, name: "Bulbasaur", slug: "bulbasaur", types: "grass", stats: [45,49,49,45], evolvesFrom: null }];
  const full = [...initial, { id: 2, name: "Ivysaur", slug: "ivysaur", types: "grass", stats: [60,62,63,60], evolvesFrom: { id: 1, name: "Bulbasaur" } }];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => full }));
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => { cb(); return 0; });
  const { result } = renderHook(() => useDeferredPokemons(initial as any));
  expect(result.current).toEqual(initial);
  await waitFor(() => expect(result.current).toEqual(full));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run hooks/useDeferredPokemons.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `useDeferredPokemons.ts`**

```ts
import { useEffect, useState } from "react";

const SRC = "/data/pokemons.json";

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
    const start = () => load();
    const ric = typeof requestIdleCallback === "function"
      ? requestIdleCallback(start, { timeout: 3000 })
      : setTimeout(start, 1200);
    const onScroll = () => start();
    window.addEventListener("scroll", onScroll, { passive: true, once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      if (typeof cancelIdleCallback === "function" && typeof ric === "number") cancelIdleCallback(ric);
    };
  }, []);

  return full ?? initial;
}
```

- [ ] **Step 4: Run hook test to verify it passes**

Run: `./node_modules/.bin/vitest run hooks/useDeferredPokemons.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `pages/index.tsx`**

Add `const INLINE_COUNT = 48;` (≥ `VirtualGrid initialCount`, so the flow render + measurement have ≥2 rows). In `getStaticProps`:
```tsx
import fs from "fs";
import path from "path";
// ...after computing `pokemons` and `browseIndexHtml`:
const dir = path.join(process.cwd(), "public", "data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "pokemons.json"), JSON.stringify(pokemons));
return { props: { pokemons: pokemons.slice(0, INLINE_COUNT), browseIndexHtml, browseAria, browseClassName } };
```
In the component, feed the grid/context from the deferred list:
```tsx
const allPokemons = useDeferredPokemons(pokemons);
// seed context from allPokemons (48 first, full after load) instead of `pokemons`:
useEffect(() => { setPokemons(allPokemons); setFilteredPokemons(allPokemons); setLoading(false); },
  [allPokemons, setPokemons, setFilteredPokemons, setLoading]);
const listSource = ctxPokemons.length ? filteredPokemons : allPokemons;
```
Add a `public/data/pokemons.json` skeleton path in `VirtualGrid`: while `listSource.length <= INLINE_COUNT` and the grid is windowed, render skeleton cells for rows beyond the inlined data (or keep the flow batch until the full list arrives — simplest: the grid already renders `initialCount` in flow, so no gap appears until the user scrolls; once the full list arrives, windowing covers everything). Only add skeletons if a visible gap is observed in Step 6.

- [ ] **Step 6: Build + verify JSON emission and no regressions**

Run: `./node_modules/.bin/next build`
Verify: `ls -l out/data/pokemons.json` exists and parses to 1,025 entries; `out/index.html` `__NEXT_DATA__` contains only `INLINE_COUNT` items (grep the props payload size — should drop from ~122 KB to ~6 KB list + browse string). All 1,079 `/pokemon/` anchors still present (from BrowseIndex island). If `out/data/pokemons.json` is missing, add the `postbuild` fallback script and re-verify.

- [ ] **Step 7: Manual functional check (headless Chrome/CDP)**

Load `/`, confirm: 48 cards paint immediately; scrolling loads the rest (idle fetch fires, grid fills, no crash/blank); BrowseIndex links resolve; hero LCP image unaffected.

- [ ] **Step 8: Full suite + typecheck + lint**

Run: `npm test && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/next lint`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add pages/index.tsx hooks/useDeferredPokemons.ts hooks/useDeferredPokemons.test.ts package.json
git commit -m "perf(home): serve full Pokémon list from lazy pokemons.json, not __NEXT_DATA__"
```

---

### Task 5: Verification — re-profile

**Files:** none (measurement).

- [ ] **Step 1:** Build and serve `out/` locally; open DevTools Performance, apply **20× CPU throttle + 3G**, record a home-page load (matching the original capture conditions).
- [ ] **Step 2:** Compare against the baseline profile: the `Next.js-hydration` long task should shrink materially and peak node count should drop well below ~9,819. Record before/after numbers (hydration task ms, node count, listener count, `__NEXT_DATA__` size).
- [ ] **Step 3:** Confirm the SEO gate from Task 1 still holds on the final build (`<details>` block byte-identical, 1,079 anchors) and LCP is not regressed.
- [ ] **Step 4:** Summarize results in the PR description / hand back to the user with the before/after profile.

---

## Self-Review

**Spec coverage:**
- #1 de-hydrate BrowseIndex → Task 1 ✓ (with SEO byte-diff gate)
- #2 async list → Task 4 ✓
- #3 prefetch=false → Task 2 ✓; spotlight gating **intentionally dropped** (rules-of-hooks-unsound + already internally gated) — deviation from spec, noted here and to the user.
- #4 image CLS → Task 3 ✓
- SEO invariant → Global Constraints + Task 1 Step 7 + Task 4 Step 6 + Task 5 Step 3 ✓
- Non-goals (App Router / sprite sheet / AVIF) → Global Constraints ✓

**Placeholder scan:** Lookup-required spots (EN strings accessor in T1S6, sprite dims in T3S1, provider wrapper for Pokemon tests in T2S1) are written as explicit `grep`/inspection steps with the command to run, not vague "TBD". No "add error handling"-style placeholders.

**Type consistency:** `IBasicPokemon` shape (`{ id, name, slug, types: string, stats: tuple, evolvesFrom }`) used consistently across tasks; `useDeferredPokemons(initial): IBasicPokemon[]` signature matches its consumer in Task 4 Step 5; `BrowseIndexContent({ heading, sections })` matches its `getStaticProps` call site.
