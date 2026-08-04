import { describe, it, expect } from "vitest";
import { incomingFactor, bestDamage, DAMAGE_TIERS } from "./effectiveness";
import { TYPES, TYPE_FACTOR } from "../../constants/typeChart";

// Guards the compact type chart that replaced the 377 KB TypeInteractions.json.
// Single-type values live in the chart; dual-type matchups are the product of
// two single-type rows (incomingFactor), so a small set of canonical matchups
// pins the whole derivation.
describe("typeChart shape", () => {
  it("has 18 unique types", () => {
    expect(TYPES).toHaveLength(18);
    expect(new Set(TYPES).size).toBe(18);
  });

  it("every row covers all 18 attackers with single-type multipliers only", () => {
    for (const defender of TYPES) {
      const row = TYPE_FACTOR[defender];
      expect(Object.keys(row).sort()).toEqual([...TYPES].sort());
      for (const factor of Object.values(row)) {
        // Single-type effectiveness is only immune/resist/neutral/weak.
        expect([0, 0.5, 1, 2]).toContain(factor);
      }
    }
  });
});

describe("incomingFactor — single type", () => {
  it("fire takes 2x from water, 0.5x from grass", () => {
    expect(incomingFactor(["fire"], "water")).toBe(2);
    expect(incomingFactor(["fire"], "grass")).toBe(0.5);
  });

  it("normal is immune to ghost; ghost is immune to normal", () => {
    expect(incomingFactor(["normal"], "ghost")).toBe(0);
    expect(incomingFactor(["ghost"], "normal")).toBe(0);
  });
});

describe("incomingFactor — dual type (product of single rows)", () => {
  it("Charizard (fire/flying) is 4x weak to rock", () => {
    expect(incomingFactor(["fire", "flying"], "rock")).toBe(4);
  });

  it("Gengar (ghost/poison) is immune to normal (0x)", () => {
    expect(incomingFactor(["ghost", "poison"], "normal")).toBe(0);
  });

  it("Scizor (bug/steel) is 0.25x resistant to grass", () => {
    expect(incomingFactor(["bug", "steel"], "grass")).toBe(0.25);
  });

  it("unknown types default to neutral", () => {
    expect(incomingFactor(["mystery"], "fire")).toBe(1);
  });
});

describe("bestDamage — best of an attacker's types", () => {
  it("picks the strongest STAB multiplier against a defender", () => {
    // grass hits water 2x, poison hits water 1x -> best is 2.
    expect(bestDamage(["grass", "poison"], ["water"])).toBe(2);
  });
});

describe("DAMAGE_TIERS", () => {
  it("surfaces the non-neutral tiers, most extreme first", () => {
    expect(DAMAGE_TIERS).toEqual([4, 2, 0.5, 0.25, 0]);
  });
});
