import { test } from "node:test";
import assert from "node:assert/strict";
import { typeSlugs, buildUrls, buildSitemap, buildRedirects, countFrUrls, LASTMOD } from "./generateSitemap.mjs";

// Tiny, deterministic fixtures — the pure assembly takes the slug data as
// arguments, so it is unit-testable WITHOUT the build-time PokéAPI fetch (that
// lives in the generator's main()). EN detail URLs are now name-slugged.
const idToFrSlug = { 1: "bulbizarre", 4: "salameche", 1025: "pris-la-vermine" };
const idToEnSlug = { 1: "bulbasaur", 4: "charmander", 1025: "pecharunt" };
const frTypeSlugs = typeSlugs().map((s) => `fr-${s}`); // index-aligned stand-ins
const sitemap = () => buildSitemap({ idToEnSlug, idToFrSlug, frTypeSlugs });

test("171 type slugs", () => assert.equal(typeSlugs().length, 171));
test("pairs alphabetical + unique", () => {
  const s = typeSlugs();
  assert.ok(s.includes("fire-water"));
  assert.ok(!s.includes("water-fire"));
  assert.equal(new Set(s).size, s.length);
});
test("total EN urls = 6 static + 1025 + 171", () => {
  // A full id→slug map so every detail page is counted (the real build passes
  // buildEnSlugMaps().idToSlug, which covers all 1025 ids).
  const fullEn = Object.fromEntries(Array.from({ length: 1025 }, (_, i) => [i + 1, `p${i + 1}`]));
  assert.equal(buildUrls(fullEn).length, 1202);
});
test("includes home, type hub, legal pages, a detail page, a type page", () => {
  const urls = buildUrls(idToEnSlug);
  [
    "/", "/type-interactions", "/about", "/privacy", "/contact", "/terms",
    "/pokemon/bulbasaur", "/pokemon/pecharunt", "/type-interactions/fire",
  ].forEach((u) => assert.ok(urls.includes(u), `missing ${u}`));
});

test("lastmod is a stable fixed date, not today-on-every-build", () => {
  // A constant — bumped only when page content changes — so rebuilds don't churn
  // lastmod and erode crawler trust (Google treats today-on-every-build as noise).
  assert.match(LASTMOD, /^\d{4}-\d{2}-\d{2}$/);
  // The generated XML must be byte-identical across calls (no `new Date()` inside).
  assert.equal(sitemap(), sitemap());
  assert.ok(sitemap().includes(`<lastmod>${LASTMOD}</lastmod>`));
});

test("urlset declares the sitemap + xhtml namespaces", () => {
  const xml = sitemap();
  assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
  assert.ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
});

test("emits EN detail URLs as /pokemon/{slug}, not legacy /details/{id}", () => {
  const xml = sitemap();
  assert.ok(xml.includes("<loc>https://my-pokedex.com/pokemon/bulbasaur</loc>"));
  assert.ok(xml.includes("<loc>https://my-pokedex.com/pokemon/pecharunt</loc>"));
  assert.ok(!xml.includes("/details/"), "sitemap must not reference the legacy /details/ route");
});

test("emits FR URLs: /fr, /fr/type-interactions, /fr/pokemon/{slug}, /fr/type-interactions/{frSlug}", () => {
  const xml = sitemap();
  [
    "<loc>https://my-pokedex.com/fr</loc>",
    "<loc>https://my-pokedex.com/fr/type-interactions</loc>",
    "<loc>https://my-pokedex.com/fr/about</loc>",
    "<loc>https://my-pokedex.com/fr/privacy</loc>",
    "<loc>https://my-pokedex.com/fr/contact</loc>",
    "<loc>https://my-pokedex.com/fr/terms</loc>",
    "<loc>https://my-pokedex.com/fr/pokemon/bulbizarre</loc>",
    "<loc>https://my-pokedex.com/fr/pokemon/pris-la-vermine</loc>",
    "<loc>https://my-pokedex.com/fr/type-interactions/fr-fire</loc>",
  ].forEach((frag) => assert.ok(xml.includes(frag), `missing ${frag}`));
});

test("FR URL count = 6 static pairs + mapped ids + fr type slugs", () => {
  assert.equal(countFrUrls(idToFrSlug, frTypeSlugs), 6 + 3 + 171);
});

test("reciprocal hreflang trio on both sides of a paired page", () => {
  const xml = sitemap();
  const en = 'href="https://my-pokedex.com/pokemon/bulbasaur"';
  const fr = 'href="https://my-pokedex.com/fr/pokemon/bulbizarre"';
  // en + x-default → EN, fr → FR (each appears on BOTH the EN and FR <url>).
  assert.equal((xml.match(new RegExp(`hreflang="en" ${en.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`, "g")) || []).length, 2);
  assert.equal((xml.match(new RegExp(`hreflang="x-default" ${en.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`, "g")) || []).length, 2);
  assert.equal((xml.match(new RegExp(`hreflang="fr" ${fr.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`, "g")) || []).length, 2);
});

test("home <-> /fr are a reciprocal pair", () => {
  const xml = sitemap();
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="fr" href="https://my-pokedex.com/fr"/>'));
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="en" href="https://my-pokedex.com/"/>'));
});

test("legal pages carry reciprocal hreflang (EN <-> FR)", () => {
  const xml = sitemap();
  const enBlock = xml.split("<url>").find((b) => b.includes("<loc>https://my-pokedex.com/privacy</loc>"));
  assert.ok(enBlock, "no /privacy url block");
  assert.ok(
    enBlock.includes('hreflang="fr" href="https://my-pokedex.com/fr/privacy"'),
    "/privacy should link its FR alternate"
  );
  const frBlock = xml.split("<url>").find((b) => b.includes("<loc>https://my-pokedex.com/fr/privacy</loc>"));
  assert.ok(frBlock, "no /fr/privacy url block");
  assert.ok(
    frBlock.includes('hreflang="en" href="https://my-pokedex.com/privacy"'),
    "/fr/privacy should link its EN alternate"
  );
});

test("mismatched FR/EN type-slug lengths throw (index alignment guard)", () => {
  assert.throws(() => buildSitemap({ idToEnSlug, idToFrSlug, frTypeSlugs: ["only-one"] }), /align by index/);
});

test("buildRedirects maps each legacy /details/{id} to /pokemon/{slug} with a 301", () => {
  const redirects = buildRedirects(idToEnSlug);
  assert.ok(redirects.includes("/details/1 /pokemon/bulbasaur 301"));
  assert.ok(redirects.includes("/details/4 /pokemon/charmander 301"));
  assert.ok(redirects.includes("/details/1025 /pokemon/pecharunt 301"));
  // One line per mapped id, nothing more.
  assert.equal(redirects.trim().split("\n").length, 3);
});

test("entityLastmod dates a Pokémon URL from its own content hash", () => {
  const xml = buildSitemap({
    idToEnSlug: { 1: "bulbasaur", 2: "ivysaur" },
    idToFrSlug: { 1: "bulbizarre", 2: "herbizarre" },
    frTypeSlugs: [],
    entityLastmod: { 1: "2026-03-14" },
  });
  const block = (loc) => xml.split("<url>").find((b) => b.includes(`<loc>${loc}</loc>`));

  assert.match(block("https://my-pokedex.com/pokemon/bulbasaur"), /<lastmod>2026-03-14<\/lastmod>/);
  // The FR page renders the same entity, so it must carry the same date.
  assert.match(block("https://my-pokedex.com/fr/pokemon/bulbizarre"), /<lastmod>2026-03-14<\/lastmod>/);
  // An id absent from the map falls back to the baseline constant.
  assert.match(block("https://my-pokedex.com/pokemon/ivysaur"), new RegExp(`<lastmod>${LASTMOD}</lastmod>`));
});

test("code-derived URLs keep the baseline constant, not an entity date", () => {
  const xml = buildSitemap({
    idToEnSlug: { 1: "bulbasaur" },
    idToFrSlug: { 1: "bulbizarre" },
    frTypeSlugs: [],
    entityLastmod: { 1: "2026-03-14" },
  });
  const block = (loc) => xml.split("<url>").find((b) => b.includes(`<loc>${loc}</loc>`));
  assert.match(block("https://my-pokedex.com/"), new RegExp(`<lastmod>${LASTMOD}</lastmod>`));
  assert.match(
    block("https://my-pokedex.com/type-interactions/normal"),
    new RegExp(`<lastmod>${LASTMOD}</lastmod>`)
  );
});

test("an empty entityLastmod reproduces the previous single-constant output", () => {
  const args = { idToEnSlug: { 1: "bulbasaur" }, idToFrSlug: { 1: "bulbizarre" }, frTypeSlugs: [] };
  assert.equal(buildSitemap(args), buildSitemap({ ...args, entityLastmod: {} }));
});
