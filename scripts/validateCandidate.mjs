// Orchestrator validateCmd. Runs against data/candidate/ (pre-promotion) in replay
// mode and exits with the code bin/run-site.sh expects:
//   0 OK · 3 HOLD (serve last-good, warn) · 1 HARD FAIL (quarantine, red)
// Guards: emptiness, required-field null-rate, monotonic dex-count floor, FR coverage.
// Run via: POKEDEX_SNAPSHOT=replay tsx scripts/validateCandidate.mjs
// (the candidate snapshot is seeded into the request runtime in-memory below —
// see seedReplayRuntime — so no POKEDEX_SNAPSHOT_FILE override is needed.)
import { readFileSync, existsSync } from "node:fs";
import { classifyValidation } from "./validateCandidate.logic.ts";

const CANDIDATE = "data/candidate";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

// Fraction of sampled pokemon whose required display fields (name/types/stats/sprite)
// are missing — catches a 200-with-garbage or half-written response.
const sampleNullRate = (snapshot) => {
  const pokemonUrls = Object.keys(snapshot).filter((u) => /\/pokemon\/\d+$/.test(u));
  if (!pokemonUrls.length) return 1;
  let bad = 0;
  for (const url of pokemonUrls) {
    const p = snapshot[url];
    const ok = p && p.name && Array.isArray(p.types) && p.types.length && Array.isArray(p.stats) && p.stats.length && p.sprites;
    if (!ok) bad++;
  }
  return bad / pokemonUrls.length;
};

const main = async () => {
  if (!existsSync(`${CANDIDATE}/latest.json`) || !existsSync(`${CANDIDATE}/manifest.json`)) {
    console.error("[validate] no candidate produced (missing latest.json/manifest.json)");
    process.exit(1);
  }

  const snapshot = readJson(`${CANDIDATE}/latest.json`);
  const manifest = readJson(`${CANDIDATE}/manifest.json`);
  const currentCount = Number(manifest.recordCount) || 0;

  // Previous promoted count (data/manifest.json is still last run's at validate time).
  let lastKnown = null;
  if (existsSync("data/manifest.json")) {
    const prev = Number(readJson("data/manifest.json").recordCount);
    if (Number.isFinite(prev)) lastKnown = prev;
  }

  // Seed the request runtime with the candidate snapshot we already loaded, so the
  // FR coverage replay below reads it (not the promoted data/latest.json). Done
  // in-memory — request.ts deliberately has no env-driven file path (a dynamic
  // readFile there makes Turbopack trace the whole project at `next build`).
  const { seedReplayRuntime } = await import("../services/fetchPokemons/request.ts");
  seedReplayRuntime(snapshot);

  // FR coverage against the candidate snapshot (replays species/types/abilities).
  const { fetchFrRawDataset } = await import("../services/fetchPokemons/fetchFrData.ts");
  const overrides = (await import("../locales/fr-overrides.json", { with: { type: "json" } })).default;
  const { computeFrGaps } = await import("../services/fetchPokemons/fetchFrData.ts");
  const frGaps = computeFrGaps(await fetchFrRawDataset(), overrides);

  // Images are best-effort: only guard if the asset tree exists (fetch stage owns it).
  let missingImageCount = 0;
  if (existsSync("public/pokemon/pixel")) {
    for (let id = 1; id <= currentCount; id++) {
      if (!existsSync(`public/pokemon/pixel/${id}.webp`)) missingImageCount++;
    }
  }

  const result = classifyValidation({
    currentCount,
    lastKnown,
    snapshotEntries: Object.keys(snapshot).length,
    frGapCount: frGaps.length,
    missingImageCount,
    nullFieldRate: sampleNullRate(snapshot),
  });

  const label = result.code === 0 ? "OK" : result.code === 3 ? "HOLD" : "HARD FAIL";
  console.log(`[validate] ${label} (count=${currentCount}, lastKnown=${lastKnown ?? "—"}, frGaps=${frGaps.length}, missingImages=${missingImageCount})`);
  for (const r of result.reasons) console.log(`  - ${r}`);
  process.exit(result.code);
};

main().catch((err) => {
  console.error("[validate] FAILED:", err);
  process.exit(1);
});
