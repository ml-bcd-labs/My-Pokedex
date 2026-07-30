// Unified PokéAPI request helper with a record/replay snapshot layer.
//
// Every build-time crawl (pages, slug maps, sitemap, FR coverage) funnels through
// `request(url)`. In `record` mode the producer live-fetches and captures every
// URL→JSON pair into a snapshot; in `replay` mode the build reads only that
// snapshot and a missing URL is a loud error — never a silent network call. This
// is what lets the orchestrator hash the dataset and deploy only on real change,
// and keeps a PokéAPI outage from ever breaking a build ("stale beats broken").

import { POKE_API_URL } from "../../constants/FetchPokemons";

export type SnapshotData = Record<string, unknown>;

// The current national-dex size, read live from PokéAPI — never hardcoded. `limit=1`
// makes it a single cheap request; we take `.count` and ignore the one result. Uses
// `pokemon-species` (distinct pokemon), NOT `/pokemon` (which counts forms: megas,
// gmax, regionals). The day a new game ships, this picks up every new species.
export const resolveSpeciesCount = async (
  request: (url: string) => Promise<any>
): Promise<number> => {
  const res = await request(`${POKE_API_URL}pokemon-species?limit=1`);
  return res.count;
};

export interface SnapshotStore {
  record(url: string, json: unknown): void;
  replay(url: string): unknown;
  has(url: string): boolean;
  size(): number;
  serialize(): string;
  data(): SnapshotData;
}

export const createSnapshotStore = (initial: SnapshotData = {}): SnapshotStore => {
  const entries = new Map<string, unknown>(Object.entries(initial));

  return {
    record(url, json) {
      entries.set(url, json);
    },
    replay(url) {
      if (!entries.has(url)) {
        throw new Error(
          `No snapshot entry for ${url} — the promoted snapshot is missing this URL. ` +
            `Rebuild the candidate (record mode) so every URL the build needs is captured.`
        );
      }
      return entries.get(url);
    },
    has(url) {
      return entries.has(url);
    },
    size() {
      return entries.size;
    },
    // Canonical: URLs are recorded in nondeterministic completion order (concurrency),
    // so sort the top-level keys. An unchanged dataset then serializes byte-identical,
    // giving the orchestrator a stable content hash.
    serialize() {
      const sorted: SnapshotData = {};
      for (const key of [...entries.keys()].sort()) {
        sorted[key] = entries.get(key);
      }
      return JSON.stringify(sorted);
    },
    data() {
      const out: SnapshotData = {};
      for (const [key, value] of entries) out[key] = value;
      return out;
    },
  };
};

export type RequestMode = "live" | "record" | "replay";

export interface CreateRequestOptions {
  mode: RequestMode;
  store?: SnapshotStore;
  fetchImpl?: typeof fetch;
  retries?: number;
  backoffMs?: (attempt: number) => number;
  // Applied to each response before it's stored (record mode). Used to strip
  // heavy unused fields so the snapshot stays small enough to build on a Pi.
  transform?: (url: string, json: any) => any;
}

// The Pokédex renders stats/types/sprites/abilities/evolution/species — never a
// pokemon's move list. Those `moves` arrays are ~78% of a raw snapshot, so drop
// them (and the equally-unused game_indices) from /pokemon/ detail responses at
// record time. Pure: never mutates its input.
const SLIM_POKEMON_FIELDS = ["moves", "game_indices", "past_types", "past_abilities"];
export const slimForSnapshot = (url: string, json: any): any => {
  if (!url.includes("/pokemon/") || !json || typeof json !== "object") return json;
  const out = { ...json };
  for (const field of SLIM_POKEMON_FIELDS) delete out[field];
  return out;
};

// Exponential backoff with jitter. Transient export-scale failures
// (ECONNREFUSED/ETIMEDOUT under connection pressure) need room to recover; jitter
// desynchronizes the retry stampede. attempt 1→~0.5s, 2→~1s, 3→~2s (+ up to 250ms).
const defaultBackoffMs = (attempt: number) =>
  500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createRequest = (opts: CreateRequestOptions) => {
  const {
    mode,
    store,
    fetchImpl = fetch,
    retries = 5,
    backoffMs = defaultBackoffMs,
    transform,
  } = opts;

  const liveFetch = async (url: string, attempt = 1): Promise<any> => {
    try {
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`Request to ${url} failed with status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt >= retries) throw error;
      await wait(backoffMs(attempt));
      return liveFetch(url, attempt + 1);
    }
  };

  return async (url: string): Promise<any> => {
    if (mode === "replay") {
      if (!store) throw new Error("replay mode requires a snapshot store");
      return store.replay(url);
    }
    if (mode === "record") {
      if (!store) throw new Error("record mode requires a snapshot store");
      // The list, per-id detail, slug-map and FR-coverage crawls overlap heavily;
      // capture each URL once so a producer run doesn't re-hit PokéAPI needlessly.
      if (store.has(url)) return store.replay(url);
      const json = await liveFetch(url);
      const stored = transform ? transform(url, json) : json;
      store.record(url, stored);
      return stored;
    }
    return liveFetch(url);
  };
};

// ---------------------------------------------------------------------------
// Runtime singleton — the process-wide `request` the fetchers, sitemap and FR
// coverage all import. Mode is chosen from the environment: the producer sets
// POKEDEX_SNAPSHOT=record, the orchestrator's build sets =replay; dev leaves it
// unset (live). An unknown value falls back to live rather than guessing.
// ---------------------------------------------------------------------------

export interface RuntimeEnv {
  POKEDEX_SNAPSHOT?: string;
}

export const resolveMode = (env: RuntimeEnv): RequestMode =>
  env.POKEDEX_SNAPSHOT === "record"
    ? "record"
    : env.POKEDEX_SNAPSHOT === "replay"
      ? "replay"
      : "live";

export const DEFAULT_SNAPSHOT_FILE = "data/latest.json";

type Runtime = Promise<{
  request: (url: string) => Promise<any>;
  store: SnapshotStore | null;
}>;

// Anchor the singleton on globalThis via a global symbol. Build tooling (tsx/esbuild)
// can evaluate this module as more than one instance when it's reached through
// different import specifiers (the producer's `../services/…/request` vs the fetchers'
// `./request`); a module-scoped `let` would then give each instance its own store and
// the producer would flush an empty snapshot. A globalThis slot is shared across them.
const RUNTIME_KEY = Symbol.for("my-pokedex.request.runtime");
const COUNT_KEY = Symbol.for("my-pokedex.request.count");
const globalSlots = globalThis as unknown as {
  [RUNTIME_KEY]?: Runtime;
  [COUNT_KEY]?: Promise<number>;
};

const initRuntime = async () => {
  const env = process.env as RuntimeEnv;
  const mode = resolveMode(env);

  if (mode === "replay") {
    // Dynamic import keeps node:fs out of the client bundle; this path only runs
    // server-side (getStaticProps) or in build scripts.
    //
    // The path is the bare DEFAULT_SNAPSHOT_FILE literal — deliberately NOT an
    // env-driven variable. `next build` never overrides the snapshot file, and a
    // dynamic path here makes Turbopack's file tracer treat it as "could be any
    // file" and trace the whole project (the over-bundling / NFT warning). Build
    // scripts that need a different file (validate → data/candidate/latest.json)
    // inject it via seedReplayRuntime() before the first request instead.
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(DEFAULT_SNAPSHOT_FILE, "utf8");
    const store = createSnapshotStore(JSON.parse(raw) as SnapshotData);
    return { request: createRequest({ mode, store }), store };
  }

  if (mode === "record") {
    const store = createSnapshotStore();
    return { request: createRequest({ mode, store, transform: slimForSnapshot }), store };
  }

  return { request: createRequest({ mode: "live" }), store: null };
};

// Concurrent callers (mapWithConcurrency fan-out) share one init promise, so the
// snapshot file is read once and one store is captured into.
const getRuntime = (): Runtime => (globalSlots[RUNTIME_KEY] ??= initRuntime());

// Build-script hook (NOT used by the app or any Next page): pre-seed the runtime
// with an already-loaded replay snapshot so the fetchers replay against it instead
// of the default file. scripts/validateCandidate calls this before the first
// request, passing the candidate snapshot it has already read. Kept as a pure
// in-memory seed — no fs read — so request.ts carries no dynamic file path for
// Turbopack's tracer to glob on. Must run before the first getRuntime() call.
export const seedReplayRuntime = (data: SnapshotData): void => {
  const store = createSnapshotStore(data);
  globalSlots[RUNTIME_KEY] = Promise.resolve({
    request: createRequest({ mode: "replay", store }),
    store,
  });
};

export const getRequest = async () => (await getRuntime()).request;

export const getSnapshotStore = async () => (await getRuntime()).store;

// The crawl range (list limit, per-id loops, sitemap, images) all read this instead
// of a hardcoded 1025. Memoized per process: in replay it replays the recorded
// species-count URL; in record it's fetched once (and captured into the snapshot),
// so the producer and the replayed build agree on the exact same range.
export const getPokemonCount = (): Promise<number> =>
  (globalSlots[COUNT_KEY] ??= (async () => resolveSpeciesCount(await getRequest()))());
