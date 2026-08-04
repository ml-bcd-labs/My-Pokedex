import { formatNumberToMatchLength } from "../stringManipulation";
import { EvolutionData, EvolvesTo, Specie, IPokemonResponseType } from "./types";
import pokemonTypesColor from "../../constants/TypesColor.json";
import { extractStatsFromPokemon, extractTypeName } from "./extractors";
import { BASIC_PIC, FULL_PIC, PIXELATED } from "../../constants/FetchPokemons";

type PIC_TYPE = typeof BASIC_PIC | typeof FULL_PIC | typeof PIXELATED;

export const getPokemonPrimaryTypeColor = (types: string) => {
  const primaryType = types.split(",")[0];
  const castedPokemonTypesColor = pokemonTypesColor as HashMap;

  return castedPokemonTypesColor[primaryType];
};

export type EvolutionChainEntry = { url: string; level: number | null };

export const formatPokemonEvolutionChain = (
  node: EvolutionData | EvolvesTo,
  level: number | null = null,
  evolutionChain: EvolutionChainEntry[] = []
): EvolutionChainEntry[] => {
  evolutionChain.push({ url: node.species.url, level });
  node.evolves_to.forEach((evolution) =>
    formatPokemonEvolutionChain(evolution, evolution.evolution_details?.[0]?.min_level ?? null, evolutionChain)
  );

  return evolutionChain;
};

// Images are self-hosted under public/pokemon by scripts/downloadPokemonImages.mjs
// (run via the prebuild/predev hooks), so these resolve to same-origin static files
// that ship with the SSG output instead of runtime CDN fetches. The folder layout
// and padding here MUST match that download script.
export const createImageUrl = (id: number, imgType: PIC_TYPE = PIXELATED) => {
  if (imgType === PIXELATED) {
    return `/pokemon/pixel/${id}.webp`;
  }
  const folder = imgType === BASIC_PIC ? "basic" : "full";
  return `/pokemon/${folder}/${formatNumberToMatchLength(id)}.webp`;
};

// The two resolution variants a list card renders (pixel + basic-HD), derived
// from `id`. Card components call this instead of reading stored URLs off the SSG
// props, so the ~1025-card list payload doesn't ship ~180 chars of URLs per card.
export const cardImageUrls = (id: number) => ({
  pixelImageUrl: createImageUrl(id),
  hdImageUrl: createImageUrl(id, BASIC_PIC),
});

export const formatToBasicPokemon = (pokemon: IPokemonResponseType): IBasicPokemon => {
  const { id, name, types } = pokemon;
  const typesName = types.map(extractTypeName).join(",");
  // Stats are already on the /pokemon response, so SSG can include them at no
  // extra fetch cost. Shipped as a compact [hp, attack, defense, speed] tuple so
  // the payload for all 1025 Pokemon stays small.
  const fullStats = extractStatsFromPokemon(pokemon);
  const statValue = (label: string) =>
    fullStats.find((stat) => stat.label.toLowerCase() === label)?.value ?? 0;
  const stats: PokemonCardStats = [
    statValue("hp"),
    statValue("attack"),
    statValue("defense"),
    statValue("speed"),
  ];

  return { id, name, types: typesName, stats };
};

const extractIdFromUrl = (url: string) => Number(url.split("/").filter(Boolean).pop());

// The pre-evolution shown on the list card, derived from the species response so
// the badge can be part of the SSG payload (no client fetch).
export const formatEvolvesFrom = (species: Specie): IEvolvesFrom | null => {
  const evolvesFrom = species.evolves_from_species;

  if (!evolvesFrom) {
    return null;
  }

  const id = extractIdFromUrl(evolvesFrom.url);

  // Only name + id ship; the badge's sprite URLs are derived from id in the card.
  return { name: evolvesFrom.name, id };
};
