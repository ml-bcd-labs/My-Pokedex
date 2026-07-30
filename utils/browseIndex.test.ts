import { describe, it, expect } from "vitest";
import {
  typeSlugLabel,
  enTypeComboItems,
  frTypeComboItems,
  pokemonBrowseItems,
  groupAlphabetically,
} from "./browseIndex";

describe("typeSlugLabel", () => {
  it("title-cases a single type", () => {
    expect(typeSlugLabel("fire")).toBe("Fire");
  });
  it("splits a two-type slug on the dash", () => {
    expect(typeSlugLabel("fire-water")).toBe("Fire / Water");
  });
  it("works on French slugs too", () => {
    expect(typeSlugLabel("eau-feu")).toBe("Eau / Feu");
  });
});

describe("type combo items", () => {
  it("emits 18 singles + 153 pairs = 171 EN links, all under /type-interactions/", () => {
    const items = enTypeComboItems();
    expect(items).toHaveLength(171);
    expect(items.every((i) => i.href.startsWith("/type-interactions/"))).toBe(true);
  });
  it("emits 171 FR links under /fr/type-interactions/, index-aligned with EN", () => {
    const items = frTypeComboItems();
    expect(items).toHaveLength(171);
    expect(items.every((i) => i.href.startsWith("/fr/type-interactions/"))).toBe(true);
  });
});

describe("pokemonBrowseItems", () => {
  const pokemons = [
    { slug: "bulbasaur", name: "Bulbasaur", frName: "Bulbizarre" },
    { slug: "pikachu", name: "Pikachu" },
    { name: "NoSlug" }, // skipped: no reachable detail URL
  ];

  it("builds EN detail links using name", () => {
    expect(pokemonBrowseItems(pokemons, "/pokemon/")).toEqual([
      { href: "/pokemon/bulbasaur", label: "Bulbasaur" },
      { href: "/pokemon/pikachu", label: "Pikachu" },
    ]);
  });

  it("builds FR detail links preferring frName, falling back to name", () => {
    expect(pokemonBrowseItems(pokemons, "/fr/pokemon/", true)).toEqual([
      { href: "/fr/pokemon/bulbasaur", label: "Bulbizarre" },
      { href: "/fr/pokemon/pikachu", label: "Pikachu" },
    ]);
  });
});

describe("groupAlphabetically", () => {
  it("groups by first letter, with buckets and items each sorted A→Z", () => {
    const items = [
      { href: "/c", label: "Charmander" },
      { href: "/a2", label: "Arbok" },
      { href: "/a1", label: "Abra" },
      { href: "/b", label: "Bulbasaur" },
    ];
    const groups = groupAlphabetically(items, "en");
    expect(groups.map((g) => g.letter)).toEqual(["A", "B", "C"]);
    expect(groups[0].items.map((i) => i.label)).toEqual(["Abra", "Arbok"]);
  });

  it("files accented names under their base letter (É → E)", () => {
    const groups = groupAlphabetically(
      [
        { href: "/e1", label: "Électhor" },
        { href: "/e2", label: "Écayon" },
      ],
      "fr",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].letter).toBe("E");
    expect(groups[0].items).toHaveLength(2);
  });

  it("puts non-letter initials in a trailing # bucket", () => {
    const groups = groupAlphabetically(
      [
        { href: "/z", label: "Zubat" },
        { href: "/n", label: "10,000,000 Volt" },
      ],
      "en",
    );
    expect(groups.map((g) => g.letter)).toEqual(["Z", "#"]);
    expect(groups[1].key).toBe("#");
  });
});
