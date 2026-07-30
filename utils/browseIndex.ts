import { allTypeSlugs } from "./typeSlug";
import { allFrTypeSlugs } from "./frTypeSlug";

// A single crawlable internal link: absolute-from-root href + visible label.
export interface BrowseItem {
  href: string;
  label: string;
}

// One alphabetical group of links. `key`/`letter` is an A–Z letter, or "#" for
// anything whose label doesn't start with a letter.
export interface BrowseSection {
  key: string;
  letter: string;
  items: BrowseItem[];
}

// Group flat browse items into per-letter sections for the A–Z index. Bucketed
// by the accent-folded, uppercased first letter (so "Électhor" files under E,
// not a separate É group); non-letter initials fall into a trailing "#" bucket.
// Items within a bucket and the buckets themselves are sorted locale-aware
// (Intl.Collator), with "#" last.
export const groupAlphabetically = (items: BrowseItem[], locale: "en" | "fr" = "en"): BrowseSection[] => {
  const buckets = new Map<string, BrowseItem[]>();
  for (const item of items) {
    const first = item.label
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .charAt(0)
      .toUpperCase();
    const key = /[A-Z]/.test(first) ? first : "#";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return collator.compare(a, b);
    })
    .map(([key, groupItems]) => ({
      key,
      letter: key,
      items: [...groupItems].sort((x, y) => collator.compare(x.label, y.label)),
    }));
};

// "fire-water" → "Fire / Water", "fire" → "Fire", "eau-feu" → "Eau / Feu".
// Locale-agnostic: it just title-cases each dash-separated part, so it reads the
// same for the English type slugs and the already-French FR slugs.
export const typeSlugLabel = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" / ");

// Every single + two-type matchup page, EN. Mirrors the sitemap's typeSlugs().
export const enTypeComboItems = (): BrowseItem[] =>
  allTypeSlugs().map((slug) => ({ href: `/type-interactions/${slug}`, label: typeSlugLabel(slug) }));

// Every single + two-type matchup page, FR. Index-aligned with enTypeComboItems.
export const frTypeComboItems = (): BrowseItem[] =>
  allFrTypeSlugs().map((slug) => ({ href: `/fr/type-interactions/${slug}`, label: typeSlugLabel(slug) }));

// Map the SSG Pokémon list to detail-page links. Entries missing a slug are
// skipped (they have no reachable detail URL). `frName` is preferred when present
// so the FR index shows French species names; the href always uses `slug`, which
// the fetch layer already localizes per locale.
export const pokemonBrowseItems = (
  pokemons: Array<{ slug?: string; name: string; frName?: string }>,
  base: "/pokemon/" | "/fr/pokemon/",
  preferFrName = false,
): BrowseItem[] =>
  pokemons
    .filter((p) => p.slug)
    .map((p) => ({
      href: `${base}${p.slug}`,
      label: (preferFrName ? p.frName : undefined) ?? p.name,
    }));
