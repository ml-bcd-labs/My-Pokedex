import {
  formatToBasicPokemon,
  formatPokemonEvolutionChain,
  formatEvolvesFrom,
} from "../../utils/pokemonFormatter/pokemonFormatter";
import { formatToFullPokemon } from "../../utils/pokemonFormatter/pokemonDetailFormatter";
import {
  extractPokemonName,
  extractPokemonData,
} from "../../utils/pokemonFormatter/extractors";
import { Specie, IPokemonResponseType } from "../../utils/pokemonFormatter/types";
import { POKE_API_URL, FETCH_CONCURRENCY } from "../../constants/FetchPokemons";
import { mapWithConcurrency } from "./mapWithConcurrency";
import { getRequest, getPokemonCount } from "./request";
import { slugify } from "../../utils/slugify";

// All PokéAPI access funnels through the shared runtime request (record/replay +
// retry) so the build reads the promoted snapshot instead of hitting the network.
const request = async (url: string): Promise<any> => (await getRequest())(url);

const fetchPokemonByNameOrId = async (name: string) => await request(`${POKE_API_URL}pokemon/${name}`)

const fetchPokemonEvolutionChain = async (pokemonSpeciesData: Specie): Promise<IEvolutionStage[]> => {
  const pokemonEvolutionData = await request(pokemonSpeciesData.evolution_chain.url);
  const pokemonEvolutionChain = formatPokemonEvolutionChain(pokemonEvolutionData.chain);

  if (pokemonEvolutionChain.length <= 1) {
    return [];
  }

  const species = await Promise.all<Specie>(pokemonEvolutionChain.map((entry) => request(entry.url)));
  // Keep name and evolution level aligned through the filter (a species may lack
  // a default variety).
  const stages = species
    .map((specie, index) => ({
      name: specie.varieties.find((variety) => variety.is_default)?.pokemon.name,
      level: pokemonEvolutionChain[index].level,
    }))
    .filter((stage): stage is { name: string; level: number | null } => stage.name !== undefined);

  const pokemonData = await Promise.all<IPokemonResponseType>(stages.map((stage) => fetchPokemonByNameOrId(stage.name)));

  return pokemonData.map((pokemon, index) => ({ ...formatToBasicPokemon(pokemon), level: stages[index].level }));
};

export const fetchPokemonDetailsByNameOrId = async (id: string) => {
  // Build-time progress: this runs once per detail page (~2,050 across EN+FR), so
  // it streams a heartbeat through the otherwise-silent "Generating static pages".
  console.log(`[build] Pokémon #${id}`);
  const pokemonData = await fetchPokemonByNameOrId(id);
  const pokemonSpeciesData = await request(`${POKE_API_URL}pokemon-species/${id}`);
  const evolutionChainPokemons = await fetchPokemonEvolutionChain(pokemonSpeciesData);
  const formattedPokemon = formatToFullPokemon(pokemonData, evolutionChainPokemons, pokemonSpeciesData);

  return formattedPokemon;
};

export const fetchAllPokemons = async (): Promise<IBasicPokemon[]> => {
  const count = await getPokemonCount();
  console.log(`[build] Fetching Pokédex list (${count} Pokémon + species)…`);
  const pokemonsData = await request(`${POKE_API_URL}pokemon?limit=${count}`);
  const pokemonsName = pokemonsData.results.map(extractPokemonName);
  // Two waves (pokemon, then species) instead of one big burst, so the
  // evolution data can be part of the SSG payload without doubling peak load.
  const pokemonData = await mapWithConcurrency<string, IPokemonResponseType>(pokemonsName, fetchPokemonByNameOrId, FETCH_CONCURRENCY);
  // Use each pokemon's own species reference (form names like "wormadam-plant"
  // don't exist on the species endpoint, so the name can't be reused directly).
  const speciesData = await mapWithConcurrency<IPokemonResponseType, Specie>(pokemonData, (pokemon) => request(pokemon.species.url), FETCH_CONCURRENCY);

  return pokemonData.map((pokemon, index) => ({
    ...formatToBasicPokemon(pokemon),
    evolvesFrom: formatEvolvesFrom(speciesData[index]),
    // English slug for the /pokemon/[slug] card link. The API resource name is
    // already a unique, URL-safe slug, so slugify() (idempotent here) suffices —
    // no override/collision handling needed, unlike the French names.
    slug: slugify(pokemon.name),
  }));
};

// Build-time slug↔id maps for the English detail route (/pokemon/[slug]).
// PokéAPI's `pokemon` resource name is already a unique, URL-safe identifier
// (e.g. "bulbasaur", "nidoran-f", "mr-mime", "ho-oh"), so — unlike the French
// side, where both Nidoran forms collide on "Nidoran" — no override table or
// collision guard is needed: the API guarantees one name per id. slugify() is
// applied defensively (idempotent on names that are already lowercase-hyphen).
// MODULE-MEMOIZED so getStaticPaths, each page's getStaticProps and the sitemap
// script share a single list fetch per worker.
let enSlugCache: { slugToId: Record<string, number>; idToSlug: Record<number, string> } | null = null;

export const buildEnSlugMaps = async (): Promise<{
  slugToId: Record<string, number>;
  idToSlug: Record<number, string>;
}> => {
  if (enSlugCache) {
    return enSlugCache;
  }

  const pokemonsData = await request(`${POKE_API_URL}pokemon?limit=${await getPokemonCount()}`);
  const slugToId: Record<string, number> = {};
  const idToSlug: Record<number, string> = {};

  for (const { name, url } of pokemonsData.results as Array<{ name: string; url: string }>) {
    const id = Number(url.split("/").filter(Boolean).pop());
    const slug = slugify(name);
    // Defensive: the API guarantees unique names today, but fail loudly if a
    // future id range ever produces two names that slugify to the same string,
    // rather than silently overwriting one detail URL.
    if (slug in slugToId && slugToId[slug] !== id) {
      throw new Error(`English slug collision: "${slug}" ← id ${slugToId[slug]} and id ${id} ("${name}")`);
    }
    slugToId[slug] = id;
    idToSlug[id] = slug;
  }

  enSlugCache = { slugToId, idToSlug };
  return enSlugCache;
};

// Build-time only. Resolves the English detail dataset for a slug: looks up the id
// via the memoized slug maps, reuses the full-detail fetch, attaches each evolution
// stage's slug (so the chain links to /pokemon/{slug}), and returns the adjacent
// prev/next slugs for the Prev/Next nav — mirroring fetchPokemonDetailFrBySlug.
export const fetchPokemonDetailEnBySlug = async (
  slug: string
): Promise<{ pokemon: IFullPokemon; prevSlug: string | null; nextSlug: string | null }> => {
  const { slugToId, idToSlug } = await buildEnSlugMaps();
  const id = slugToId[slug];

  const enFull = await fetchPokemonDetailsByNameOrId(String(id));
  const evolutionChain = enFull.evolutionChain.map((stage) => ({
    ...stage,
    slug: idToSlug[stage.id],
  }));

  return {
    pokemon: { ...enFull, evolutionChain },
    prevSlug: idToSlug[id - 1] ?? null,
    nextSlug: idToSlug[id + 1] ?? null,
  };
};

export const fetchPokemonsByType = async (type: string): Promise<IBasicPokemon[]> => {
  const pokemonsData = await request(`${POKE_API_URL}type/${type}`);
  const pokemonsName = pokemonsData.pokemon.map(extractPokemonData).map(extractPokemonName);
  const pokemonData = await mapWithConcurrency<string, IPokemonResponseType>(pokemonsName, fetchPokemonByNameOrId, FETCH_CONCURRENCY);
  const formattedPokemons = pokemonData.map(formatToBasicPokemon);

  return formattedPokemons;
};
