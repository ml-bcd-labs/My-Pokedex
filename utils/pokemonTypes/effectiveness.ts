import { TYPE_FACTOR as FACTOR } from "../../constants/typeChart";

// FACTOR[defendingType][attackingType] = incoming damage multiplier, for the 18
// single-type rows only. Every dual-type matchup is the product of its two
// single-type factors, so combo rows are never stored — they're computed here.

// Multiplier a single attacking type deals to a (possibly dual) defender.
export const incomingFactor = (defenders: string[], attacker: string): number =>
  defenders.reduce((mult, defender) => mult * (FACTOR[defender]?.[attacker] ?? 1), 1);

// Best multiplier an attacker's typing lands on a defender. A move is always
// single-typed, so the strongest of the attacker's types wins (STAB coverage).
export const bestDamage = (attackerTypes: string[], defenderTypes: string[]): number =>
  Math.max(...attackerTypes.map((attacker) => incomingFactor(defenderTypes, attacker)));

// Tiers worth surfacing, ordered most-extreme first (neutral ×1 is omitted).
export const DAMAGE_TIERS = [4, 2, 0.5, 0.25, 0];
