import { describe, it, expect } from "vitest";
import {
  baseStatTotal,
  enDetailDescription,
  frDetailDescription,
  META_DESCRIPTION_MAX,
  TITLE_MAX,
  enComboDescription,
  frComboDescription,
  enDetailTitle,
  frDetailTitle,
  enComboTitle,
  frComboTitle,
} from "./pokemonMeta";
import { matchupSummary } from "./pokemonTypes/matchups";
import { allTypeSlugs, parseTypeSlug } from "./typeSlug";
import { FR_TYPE_LABELS } from "../constants/FrTypeLabels";
import { capitalizeFirstLetter } from "./stringManipulation";

describe("baseStatTotal", () => {
  it("sums every stat value", () => {
    expect(baseStatTotal([{ value: 45 }, { value: 49 }, { value: 65 }])).toBe(159);
  });
  it("is 0 for no stats", () => {
    expect(baseStatTotal([])).toBe(0);
  });
});

const bulbasaur = { name: "bulbasaur", category: "Seed", types: "grass,poison", id: 1, gen: 1, bst: 318 };

describe("enDetailDescription", () => {
  it("composes a unique, fact-rich description in the SEO length window", () => {
    const desc = enDetailDescription(bulbasaur);
    expect(desc).toContain("Bulbasaur");
    expect(desc).toContain("Seed Pokémon");
    expect(desc).toContain("Grass/Poison type");
    expect(desc).toContain("Generation 1");
    expect(desc).toContain("318 base-stat total");
    // Bing flags descriptions that are too short; keep them comfortably long
    // but under the ~160-char SERP truncation point.
    expect(desc.length).toBeGreaterThanOrEqual(140);
    expect(desc.length).toBeLessThanOrEqual(155);
  });

  it("pads the id to three digits", () => {
    expect(enDetailDescription(bulbasaur)).toContain("(#001)");
  });

  it("drops the genus clause when the category is empty", () => {
    const desc = enDetailDescription({ ...bulbasaur, category: "" });
    expect(desc).not.toContain("Pokémon —");
    expect(desc).toContain("Bulbasaur, (#001)");
  });

  it("produces distinct descriptions for distinct Pokémon (no duplicate-description penalty)", () => {
    const a = enDetailDescription(bulbasaur);
    const b = enDetailDescription({ name: "charmander", category: "Lizard", types: "fire", id: 4, gen: 1, bst: 309 });
    expect(a).not.toEqual(b);
  });
});

describe("frDetailDescription", () => {
  it("composes the French equivalent in the length window", () => {
    const desc = frDetailDescription({
      displayName: "Bulbizarre",
      category: "Graine",
      typesLabel: "Plante/Poison",
      id: 1,
      gen: 1,
      bst: 318,
    });
    expect(desc).toContain("Bulbizarre");
    expect(desc).toContain("le Pokémon Graine");
    expect(desc).toContain("type Plante/Poison");
    expect(desc).toContain("1re génération");
    expect(desc).toContain("318 points de stats de base");
    expect(desc.length).toBeGreaterThanOrEqual(140);
    expect(desc.length).toBeLessThanOrEqual(155);
  });
});

describe("detail descriptions stay under the cap for long names", () => {
  it("falls back to a shorter sentence instead of exceeding 155 chars", () => {
    const desc = enDetailDescription({
      name: "squawkabilly-green-plumage",
      category: "Parrot",
      types: "normal,flying",
      id: 931,
      gen: 9,
      bst: 417,
    });
    expect(desc.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(desc).toContain("Squawkabilly-green-plumage");
    expect(desc).toContain("417 base-stat total");
  });

  it("does the same in French", () => {
    const desc = frDetailDescription({
      displayName: "Superdofin (Forme Super)",
      category: "Dauphin Héroïque",
      typesLabel: "Eau",
      id: 964,
      gen: 9,
      bst: 650,
    });
    expect(desc.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(desc).toContain("650 points de stats de base");
  });
});

describe("detail titles", () => {
  it("keep the number and brand when they fit", () => {
    expect(enDetailTitle("Pikachu", 25)).toBe("Pikachu (#025) — Stats & Weaknesses | Pokédex");
    expect(frDetailTitle("Pikachu", 25)).toBe("Pikachu (#025) — Stats & Faiblesses | Pokédex");
  });
  it("drop the number for long names to stay within 60 chars", () => {
    const title = enDetailTitle("Squawkabilly-green-plumage", 931);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title).toContain("Squawkabilly-green-plumage");
  });
});

const frLabel = (t: string) => FR_TYPE_LABELS[t] ?? capitalizeFirstLetter(t);

describe("type-combination metadata", () => {
  const combos = allTypeSlugs().map(parseTypeSlug);

  it("every combo gets a ≤155-char EN and FR description built from its matchups", () => {
    const en = new Set<string>();
    for (const types of combos) {
      const label = types.map(capitalizeFirstLetter).join(" / ");
      const noun = types.length > 1 ? "Types" : "Type";
      const summary = matchupSummary(types);
      const enDesc = enComboDescription(label, noun, summary);
      const frDesc = frComboDescription(types.map(frLabel).join(" / "), summary, frLabel);
      expect(enDesc.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
      expect(frDesc.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
      expect(enDesc.length).toBeGreaterThanOrEqual(70);
      expect(frDesc.length).toBeGreaterThanOrEqual(70);
      expect(enDesc.startsWith(`${label} ${noun.toLowerCase()}:`)).toBe(true);
      en.add(enDesc);
    }
    expect(en.size).toBe(combos.length);
  });

  it("names the computed weaknesses", () => {
    const desc = enComboDescription("Fire", "Type", matchupSummary(["fire"]));
    expect(desc.startsWith("Fire type: weak to ")).toBe(true);
    for (const t of matchupSummary(["fire"]).weakTo) expect(desc).toContain(capitalizeFirstLetter(t));
  });

  it("every combo title fits in 60 chars", () => {
    for (const types of combos) {
      const label = types.map(capitalizeFirstLetter).join(" / ");
      const noun = types.length > 1 ? "Types" : "Type";
      expect(enComboTitle(`${label} ${noun}`).length).toBeLessThanOrEqual(TITLE_MAX);
      expect(frComboTitle(types.map(frLabel).join(" / ")).length).toBeLessThanOrEqual(TITLE_MAX);
    }
  });
});
