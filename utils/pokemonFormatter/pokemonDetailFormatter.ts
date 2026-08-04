// Detail-page (full Pokémon) formatting. Split out of pokemonFormatter.ts so the
// type-effectiveness matrix (constants/typeChart via effectiveness.ts) is imported
// ONLY here — the detail page — and never dragged into the home/list bundle, which
// pulls the matrix-free card helpers from pokemonFormatter.ts.
import { TYPES } from "../../constants/typeChart";
import { incomingFactor, bestDamage } from "../pokemonTypes/effectiveness";
import { createImageUrl, formatToBasicPokemon } from "./pokemonFormatter";
import {
  extractStatsFromPokemon,
  extractAbilitiesFromPokemon,
  extractPokemonDescription,
  extractPokemonCategory,
} from "./extractors";
import { IPokemonResponseType, Specie } from "./types";
import { FULL_PIC } from "../../constants/FetchPokemons";

// Types this Pokémon is very/super effectively hit by (incoming factor >= 2).
const getPokemonWeaknesses = (types: string): Weakness[] => {
  const defenders = types.split(",");
  return TYPES.map((attacker) => ({
    type: attacker as PokemonType,
    factor: incomingFactor(defenders, attacker) as DamageFactor,
  })).filter(({ factor }) => factor >= 2);
};

// Defending effectiveness (damage taken) against all 18 attacking types.
export const getPokemonDefensiveEffectiveness = (types: string): ITypeEffectiveness[] => {
  const defenders = types.split(",");
  return TYPES.map((attacker) => ({
    type: attacker,
    factor: incomingFactor(defenders, attacker) as DamageFactor,
  }));
};

// Offensive effectiveness (damage dealt) of this Pokemon's STAB types against all
// 18 defending types — best multiplier across its types (best STAB coverage).
export const getPokemonOffensiveEffectiveness = (types: string): ITypeEffectiveness[] => {
  const attackers = types.split(",");
  return TYPES.map((defender) => ({
    type: defender,
    factor: bestDamage(attackers, [defender]) as DamageFactor,
  }));
};

export const formatToFullPokemon = (
  pokemon: IPokemonResponseType,
  evolutionChain: IEvolutionStage[],
  pokemonSpeciesData: Specie
): IFullPokemon => {
  const { height, weight, id } = pokemon;
  const pokemonBasicInfo = formatToBasicPokemon(pokemon);
  const weaknesses = getPokemonWeaknesses(pokemonBasicInfo.types);
  const defensiveEffectiveness = getPokemonDefensiveEffectiveness(pokemonBasicInfo.types);
  const offensiveEffectiveness = getPokemonOffensiveEffectiveness(pokemonBasicInfo.types);
  const stats = extractStatsFromPokemon(pokemon);
  const description = extractPokemonDescription(pokemonSpeciesData);
  const category = extractPokemonCategory(pokemonSpeciesData);
  const abilities = extractAbilitiesFromPokemon(pokemon.abilities);
  // formatToBasicPokemon no longer emits URLs (list-payload diet), so the detail
  // page sets both explicitly: pixel for the low-res toggle, FULL_PIC for the hero.
  const pixelImageUrl = createImageUrl(id);
  const hdImageUrl = createImageUrl(id, FULL_PIC);

  return {
    ...pokemonBasicInfo,
    pixelImageUrl,
    hdImageUrl,
    stats,
    weaknesses,
    defensiveEffectiveness,
    offensiveEffectiveness,
    height: height * 10,
    weight: weight / 10,
    evolutionChain,
    abilities,
    description,
    category,
  };
};
