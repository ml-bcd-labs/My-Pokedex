import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ORIGIN = "https://my-pokedex.com";
const POKE_API_URL = "https://pokeapi.co/api/v2/"; // mirrors constants/FetchPokemons.ts

// Content-hash → date store for per-Pokémon lastmod. Sits beside the snapshot in
// data/, which is UNTRACKED: a build must never rewrite a git-tracked file, or
// the Pi's checkout goes dirty and the next pull conflicts.
const LASTMOD_STORE = "data/lastmod.json";
// Mirror of constants/Types.ts — Pokémon's 18 types are fixed. Order MUST match
// Object.values(constants/Types.ts), because typeSlugs() (EN) and allFrTypeSlugs()
// (FR) both iterate the types in that order, so the two lists align by index and
// index i of one is the reciprocal of index i of the other.
const TYPES = ["normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];

// Baseline last-modified date, used for URLs whose content is code-derived
// rather than data-derived (home, the type hub and its 171 interaction pages,
// the legal pages). Bump this ONLY when those pages actually change. It is a
// constant — not `new Date()` — so rebuilding/redeploying does not stamp
// today's date on every unchanged URL, which Google's John Mueller calls out as
// a lazy signal that erodes lastmod trust and wastes crawl budget.
//
// Per-Pokémon URLs no longer use this: their date comes from a content hash of
// their own snapshot data (see lastmodStore.mjs), so a URL moves only when that
// Pokémon's data moves. This constant remains their first-run fallback.
export const LASTMOD = "2026-07-07";

const toSlug = (types) => [...types].sort().join("-");

export const typeSlugs = () => {
  const pairs = [];
  for (let i = 0; i < TYPES.length; i++) {
    for (let j = i + 1; j < TYPES.length; j++) {
      pairs.push(toSlug([TYPES[i], TYPES[j]]));
    }
  }
  return [...TYPES, ...pairs];
};

// Static routes with a fixed EN↔FR counterpart: home, the type hub, and the four
// legal/trust pages (pages/{about,privacy,contact,terms}.tsx + their /fr mirrors).
// Every one is emitted on BOTH sides with reciprocal hreflang.
const STATIC_PAIRS = [
  { en: "/", fr: "/fr" },
  { en: "/type-interactions", fr: "/fr/type-interactions" },
  { en: "/about", fr: "/fr/about" },
  { en: "/privacy", fr: "/fr/privacy" },
  { en: "/contact", fr: "/fr/contact" },
  { en: "/terms", fr: "/fr/terms" },
];

// The EN paths, kept for the URL-count test and any EN-only consumer. Detail
// pages are name-slugged (/pokemon/{slug}); the id→enSlug map comes from
// buildEnSlugMaps().idToSlug. FR paths are assembled inside buildSitemap().
export const buildUrls = (idToEnSlug = {}) => {
  const urls = STATIC_PAIRS.map((pair) => pair.en);
  const maxId = Math.max(0, ...Object.keys(idToEnSlug).map(Number));
  for (let id = 1; id <= maxId; id++) {
    const slug = idToEnSlug[id];
    if (slug) urls.push(`/pokemon/${slug}`);
  }
  typeSlugs().forEach((slug) => urls.push(`/type-interactions/${slug}`));
  return urls;
};

// Cloudflare Pages `_redirects`: one 301 per legacy numeric detail URL → its new
// name-slugged URL. Copied verbatim from public/ into the static-export output,
// where Cloudflare serves it. 1025 lines is well within the 2,000 static-rule cap.
export const buildRedirects = (idToEnSlug = {}) => {
  const lines = [];
  const maxId = Math.max(0, ...Object.keys(idToEnSlug).map(Number));
  for (let id = 1; id <= maxId; id++) {
    const slug = idToEnSlug[id];
    if (slug) lines.push(`/details/${id} /pokemon/${slug} 301`);
  }
  return `${lines.join("\n")}\n`;
};

const abs = (path) => `${ORIGIN}${path}`;

// One <xhtml:link> alternate line.
const altLine = (hreflang, path) =>
  `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${abs(path)}"/>`;

// Render a single <url>. When `alt` ({ en, fr }) is given, the page carries the
// reciprocal trio: en + x-default → the English URL, fr → the French URL. EN-only
// pages pass alt=null and get no alternates.
const renderUrl = (path, lastmod, alt) => {
  const lines = [`  <url>`, `    <loc>${abs(path)}</loc>`, `    <lastmod>${lastmod}</lastmod>`];
  if (alt) {
    lines.push(altLine("en", alt.en), altLine("fr", alt.fr), altLine("x-default", alt.en));
  }
  lines.push(`  </url>`);
  return lines.join("\n");
};

// PURE, testable assembly. Given the last-modified date, the id→frSlug map
// (from buildFrSlugMaps().idToSlug) and the FR type slugs (from allFrTypeSlugs(),
// index-aligned with typeSlugs()), it emits every EN and FR <url> with reciprocal
// hreflang alternates. No network here — main() does the fetching.
export const buildSitemap = ({
  lastmod = LASTMOD,
  idToEnSlug = {},
  idToFrSlug = {},
  frTypeSlugs = [],
  // {id: "YYYY-MM-DD"} — per-Pokémon dates from the content-hash store. Any id
  // absent here (or an empty map, e.g. a live/dev run with no snapshot) falls
  // back to `lastmod`, so the sitemap is always well-formed.
  entityLastmod = {},
} = {}) => {
  const enTypeSlugs = typeSlugs();
  if (frTypeSlugs.length && frTypeSlugs.length !== enTypeSlugs.length) {
    throw new Error(
      `FR type slug count (${frTypeSlugs.length}) != EN (${enTypeSlugs.length}); they must align by index.`
    );
  }

  const blocks = [];

  // Upper id bound derived from the slug maps (not a hardcoded constant), so a new
  // Pokémon appears in the sitemap the moment the fetch layer surfaces it.
  const maxId = Math.max(0, ...Object.keys({ ...idToEnSlug, ...idToFrSlug }).map(Number));

  // --- English URLs (each static page carries its reciprocal FR alternate) ---
  for (const pair of STATIC_PAIRS) {
    blocks.push(renderUrl(pair.en, lastmod, { en: pair.en, fr: pair.fr }));
  }
  for (let id = 1; id <= maxId; id++) {
    const enSlug = idToEnSlug[id];
    if (!enSlug) continue;
    const frSlug = idToFrSlug[id];
    const alt = frSlug ? { en: `/pokemon/${enSlug}`, fr: `/fr/pokemon/${frSlug}` } : null;
    blocks.push(renderUrl(`/pokemon/${enSlug}`, entityLastmod[id] ?? lastmod, alt));
  }
  enTypeSlugs.forEach((enSlug, i) => {
    const frSlug = frTypeSlugs[i];
    const alt = frSlug
      ? { en: `/type-interactions/${enSlug}`, fr: `/fr/type-interactions/${frSlug}` }
      : null;
    blocks.push(renderUrl(`/type-interactions/${enSlug}`, lastmod, alt));
  });

  // --- French URLs (each carries the reciprocal of its EN pair) ---
  for (const pair of STATIC_PAIRS) {
    blocks.push(renderUrl(pair.fr, lastmod, { en: pair.en, fr: pair.fr }));
  }
  for (let id = 1; id <= maxId; id++) {
    const frSlug = idToFrSlug[id];
    if (!frSlug) continue;
    const enSlug = idToEnSlug[id];
    const alt = enSlug ? { en: `/pokemon/${enSlug}`, fr: `/fr/pokemon/${frSlug}` } : null;
    // The FR page renders the same entity, so it shares the EN page's date.
    blocks.push(renderUrl(`/fr/pokemon/${frSlug}`, entityLastmod[id] ?? lastmod, alt));
  }
  enTypeSlugs.forEach((enSlug, i) => {
    const frSlug = frTypeSlugs[i];
    if (!frSlug) return;
    blocks.push(
      renderUrl(`/fr/type-interactions/${frSlug}`, lastmod, {
        en: `/type-interactions/${enSlug}`,
        fr: `/fr/type-interactions/${frSlug}`,
      })
    );
  });

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${blocks.join("\n")}\n` +
    `</urlset>\n`
  );
};

// Count of FR URLs a given assembly emits — used for the run log. The FR side now
// mirrors all static pairs (home, type hub, 4 legal pages) plus per-entity pages.
export const countFrUrls = (idToFrSlug, frTypeSlugs) =>
  STATIC_PAIRS.length + Object.keys(idToFrSlug).length + frTypeSlugs.length;

// Per-Pokémon lastmod, derived from the replay snapshot.
//
// Only runs under POKEDEX_SNAPSHOT=replay — the production build path. A live
// dev run has no snapshot to hash, and re-fetching ~1025 details from PokéAPI
// just to compute dates would make `prebuild`/`predev` unusable; those runs get
// an empty map and fall back to the LASTMOD constant, exactly as before.
//
// The hash covers the two endpoints that drive a detail page: the Pokémon
// record (stats, types, sprites, abilities) and its species record (flavour
// text, evolution chain pointer, generation).
const resolvePokemonLastmods = async (ids) => {
  if (process.env.POKEDEX_SNAPSHOT !== "replay") return {};

  const [{ getSnapshotStore }, { hashEntity, resolveLastmods }] = await Promise.all([
    import("../services/fetchPokemons/request.ts"),
    import("./lastmodStore.mjs"),
  ]);

  const store = await getSnapshotStore();
  // `replay()` throws on a miss by design, so probe with `has()` first.
  const read = (url) => (store.has(url) ? store.replay(url) : undefined);

  const hashes = {};
  for (const id of ids) {
    const pokemon = read(`${POKE_API_URL}pokemon/${id}`);
    const species = read(`${POKE_API_URL}pokemon-species/${id}`);
    // An id the snapshot never captured gets no entry, so it falls back to
    // LASTMOD rather than being hashed as `undefined` (which would look like a
    // real change on every build).
    if (pokemon === undefined && species === undefined) continue;
    hashes[id] = hashEntity(pokemon ?? null, species ?? null);
  }

  let previous = {};
  try {
    previous = JSON.parse(readFileSync(LASTMOD_STORE, "utf8"));
  } catch {
    previous = {}; // first run, or the store was wiped with the snapshot
  }

  const { lastmods, next } = resolveLastmods({
    hashes,
    previous,
    today: new Date().toISOString().slice(0, 10),
    fallback: LASTMOD,
  });

  writeFileSync(LASTMOD_STORE, `${JSON.stringify(next, null, 2)}\n`);

  const moved = Object.keys(hashes).filter((id) => previous[id] && previous[id].hash !== hashes[id]);
  console.log(
    `lastmod: ${Object.keys(lastmods).length} entities tracked, ${moved.length} changed this run` +
      (Object.keys(previous).length ? "" : " (first run — baselined to LASTMOD)")
  );
  return lastmods;
};

// The generator's impure entry point: fetch the FR slug maps (a build-time
// ~1025-species PokéAPI fetch), then write the assembled XML. TS helpers are
// imported dynamically so this .mjs still loads under plain `node` (e.g. the
// node:test file) without a TS loader — only tsx-run main() resolves them.
const main = async () => {
  const { buildFrSlugMaps } = await import("../services/fetchPokemons/fetchPokemonsFr.ts");
  const { buildEnSlugMaps } = await import("../services/fetchPokemons/fetchPokemons.ts");
  const { allFrTypeSlugs } = await import("../utils/frTypeSlug.ts");

  const { idToSlug } = await buildFrSlugMaps();
  const { idToSlug: idToEnSlug } = await buildEnSlugMaps();
  const frTypeSlugs = allFrTypeSlugs();

  const entityLastmod = await resolvePokemonLastmods(Object.keys(idToEnSlug));

  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  writeFileSync(
    join(publicDir, "sitemap.xml"),
    buildSitemap({ idToEnSlug, idToFrSlug: idToSlug, frTypeSlugs, entityLastmod })
  );

  // 301 map for the legacy /details/{id} → /pokemon/{slug} migration.
  const redirects = buildRedirects(idToEnSlug);
  writeFileSync(join(publicDir, "_redirects"), redirects);

  const enCount = buildUrls(idToEnSlug).length;
  const frCount = countFrUrls(idToSlug, frTypeSlugs);
  const redirectCount = redirects.trim() ? redirects.trim().split("\n").length : 0;
  console.log(
    `Wrote ${enCount + frCount} URLs to public/sitemap.xml (${enCount} EN + ${frCount} FR, hreflang-annotated).`
  );
  console.log(`Wrote ${redirectCount} legacy 301 redirects to public/_redirects.`);
};

// Run only when executed directly, so the test can import the helpers safely.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
