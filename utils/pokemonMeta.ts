import { capitalizeFirstLetter, formatNumberToMatchLength } from "./stringManipulation";
import { frGenerationOrdinal } from "../constants/Generations";

// Sum of every base stat (all six on the /pokemon response), i.e. the Base Stat
// Total. A per-Pokémon number that makes each meta description genuinely distinct.
export const baseStatTotal = (stats: Array<{ value: number }>): number =>
  stats.reduce((sum, stat) => sum + stat.value, 0);

// English detail-page meta description. Composed from facts that all vary per
// Pokémon (genus, types, generation, base-stat total) so every one of the ~1025
// pages is unique and ~150–165 chars — clearing Bing's "identical / too short"
// descriptions warning — without reproducing any verbatim franchise flavor text.
// `category` is the genus with "Pokémon" already stripped (e.g. "Seed"); it can be
// empty, in which case the genus clause is dropped.
export const enDetailDescription = ({
  name,
  category,
  types,
  id,
  gen,
  bst,
}: {
  name: string;
  category: string;
  types: string;
  id: number;
  gen: number;
  bst: number;
}): string => {
  const displayName = capitalizeFirstLetter(name);
  const typesLabel = types
    .split(",")
    .map(capitalizeFirstLetter)
    .join("/");
  const genus = category.trim() ? `the ${category.trim()} Pokémon ` : "";
  const facts = (g: string) =>
    `${displayName}, ${g}(#${formatNumberToMatchLength(id)}) — ${typesLabel} type, Generation ${gen}, ${bst} base-stat total.`;
  // Long names/genera pushed the full sentence to 174 chars; fall back to a
  // shorter closing clause, then drop the genus, so every page stays ≤155.
  return fitDescription([
    `${facts(genus)} Full base stats, type weaknesses, abilities and evolution line.`,
    `${facts(genus)} Base stats, weaknesses, abilities and evolutions.`,
    `${facts(genus)} Stats, weaknesses and evolutions.`,
    `${facts("")} Stats, weaknesses and evolutions.`,
    facts(""),
  ]);
};

// French detail-page meta description. Same fact-composed strategy as the English
// one; `displayName` is the resolved French name, `category` the French genus with
// "Pokémon" stripped (e.g. "Graine"), and `typesLabel` the already-localized types
// joined with "/". Kept parallel so both locales clear the same Bing warnings.
export const frDetailDescription = ({
  displayName,
  category,
  typesLabel,
  id,
  gen,
  bst,
}: {
  displayName: string;
  category: string;
  typesLabel: string;
  id: number;
  gen: number;
  bst: number;
}): string => {
  const genus = category.trim() ? `le Pokémon ${category.trim()} ` : "";
  const facts = (g: string) =>
    `${displayName}, ${g}(#${formatNumberToMatchLength(id)}) — type ${typesLabel}, ${frGenerationOrdinal(gen)} génération, ${bst} points de stats de base.`;
  return fitDescription([
    `${facts(genus)} Statistiques, faiblesses, talents et évolutions.`,
    `${facts(genus)} Stats, faiblesses et évolutions.`,
    `${facts("")} Stats, faiblesses et évolutions.`,
    facts(""),
  ]);
};

// Google truncates snippets around 155–160 chars; the SEO audit flags > 160.
// Every generated description is held to this cap.
export const META_DESCRIPTION_MAX = 155;

// SERPs truncate titles past ~60 chars (the SEO audit's title-length bound).
export const TITLE_MAX = 60;

// First candidate that fits the cap; if none does, the last one cut at a word
// boundary with an ellipsis (a safety net — the candidates are designed to fit).
export const fitDescription = (candidates: string[], max = META_DESCRIPTION_MAX): string => {
  const fit = candidates.find((candidate) => candidate.length <= max);
  if (fit) return fit;
  const last = candidates[candidates.length - 1] ?? "";
  const cut = last.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[\s,;:—-]+$/, "")}…`;
};

interface ComboMatchups {
  weakTo: string[];
  resists: string[];
  immuneTo: string[];
  strongAgainst: string[];
}

type ComboLists = Record<keyof ComboMatchups, string[]>;

// Shared driver for the type-combination descriptions: try the full lists with a
// long then short closing phrase, then trim the longest list one entry at a time
// ("+N more") until the text fits. Every combo therefore gets a description built
// from its own computed matchups instead of one fixed templated sentence.
const comboDescription = (
  lists: ComboLists,
  render: (lists: ComboLists, hidden: Record<keyof ComboMatchups, number>, tail: string) => string,
  tails: string[],
): string => {
  const hidden: Record<keyof ComboMatchups, number> = { weakTo: 0, resists: 0, immuneTo: 0, strongAgainst: 0 };
  const current: ComboLists = { ...lists };
  const candidates: string[] = [...tails, ""].map((tail) => render(current, hidden, tail));
  if (candidates.some((c) => c.length <= META_DESCRIPTION_MAX)) return fitDescription(candidates);

  const keys = Object.keys(current) as Array<keyof ComboMatchups>;
  for (;;) {
    const longest = keys.reduce((a, b) => (current[b].length > current[a].length ? b : a));
    if (current[longest].length <= 1) break;
    current[longest] = current[longest].slice(0, -1);
    hidden[longest] += 1;
    const candidate = render(current, hidden, "");
    if (candidate.length <= META_DESCRIPTION_MAX) return candidate;
  }
  return fitDescription([render(current, hidden, "")]);
};

const enList = (items: string[], hidden: number) =>
  `${items.join(", ")}${hidden ? ` +${hidden} more` : ""}`;

// English type-interaction page description, e.g. "Fire / Water types: weak to
// Electric, Grass; resists Fire, Ice, Steel… Super effective against …".
// `summary` holds the English type names from matchupSummary().
export const enComboDescription = (label: string, noun: string, summary: ComboMatchups): string => {
  const cap = (items: string[]) => items.map(capitalizeFirstLetter);
  return comboDescription(
    {
      weakTo: cap(summary.weakTo),
      resists: cap(summary.resists),
      immuneTo: cap(summary.immuneTo),
      strongAgainst: cap(summary.strongAgainst),
    },
    (l, h, tail) => {
      const parts = [l.weakTo.length ? `weak to ${enList(l.weakTo, h.weakTo)}` : "no weaknesses"];
      if (l.resists.length) parts.push(`resists ${enList(l.resists, h.resists)}`);
      if (l.immuneTo.length) parts.push(`immune to ${enList(l.immuneTo, h.immuneTo)}`);
      const offense = l.strongAgainst.length
        ? `Super effective against ${enList(l.strongAgainst, h.strongAgainst)}.`
        : "No super-effective coverage.";
      return `${label} ${noun.toLowerCase()}: ${parts.join("; ")}. ${offense}${tail ? ` ${tail}` : ""}`;
    },
    ["Full chart of damage taken and dealt.", "Full damage chart."],
  );
};

const frList = (items: string[], hidden: number) =>
  `${items.join(", ")}${hidden ? ` +${hidden} ${hidden > 1 ? "autres" : "autre"}` : ""}`;

// French twin. `label` is the localized heading label ("Feu / Eau") and
// `typeLabel` maps an English type name to its French label.
export const frComboDescription = (
  label: string,
  summary: ComboMatchups,
  typeLabel: (type: string) => string,
): string => {
  const fr = (items: string[]) => items.map(typeLabel);
  return comboDescription(
    {
      weakTo: fr(summary.weakTo),
      resists: fr(summary.resists),
      immuneTo: fr(summary.immuneTo),
      strongAgainst: fr(summary.strongAgainst),
    },
    (l, h, tail) => {
      const parts = [l.weakTo.length ? `faible face à ${frList(l.weakTo, h.weakTo)}` : "aucune faiblesse"];
      if (l.resists.length) parts.push(`résiste à ${frList(l.resists, h.resists)}`);
      if (l.immuneTo.length) parts.push(`immunisé contre ${frList(l.immuneTo, h.immuneTo)}`);
      const offense = l.strongAgainst.length
        ? `Super efficace contre ${frList(l.strongAgainst, h.strongAgainst)}.`
        : "Aucune couverture super efficace.";
      return `${label} : ${parts.join(" ; ")}. ${offense}${tail ? ` ${tail}` : ""}`;
    },
    ["Tableau complet des dégâts subis et infligés.", "Tableau complet des dégâts."],
  );
};

// Page <title>s: richest variant that fits TITLE_MAX. The final candidate keeps
// the brand-less essentials and is returned as-is even if a very long name
// still overflows (a title is never cut mid-word).
export const fitTitle = (candidates: string[]): string =>
  candidates.find((candidate) => candidate.length <= TITLE_MAX) ?? candidates[candidates.length - 1];

export const enDetailTitle = (displayName: string, id: number): string => {
  const num = `(#${formatNumberToMatchLength(id)})`;
  return fitTitle([
    `${displayName} ${num} — Stats & Weaknesses | Pokédex`,
    `${displayName} — Stats & Weaknesses | Pokédex`,
    `${displayName} — Stats & Weaknesses`,
  ]);
};

export const frDetailTitle = (displayName: string, id: number): string => {
  const num = `(#${formatNumberToMatchLength(id)})`;
  return fitTitle([
    `${displayName} ${num} — Stats & Faiblesses | Pokédex`,
    `${displayName} — Stats & Faiblesses | Pokédex`,
    `${displayName} — Stats & Faiblesses`,
  ]);
};

// `heading` is the full combo label as shown in the <h1> ("Fire / Water Types").
export const enComboTitle = (heading: string): string =>
  fitTitle([
    `${heading} — Weaknesses, Resistances & Best Matchups | Pokédex`,
    `${heading} — Weaknesses & Resistances | Pokédex`,
    `${heading}: Weaknesses & Resistances | Pokédex`,
    `${heading} — Weaknesses & Resistances`,
  ]);

export const frComboTitle = (label: string): string =>
  fitTitle([
    `${label} — Faiblesses, Résistances & Meilleurs Matchups | Pokédex`,
    `${label} — Faiblesses & Résistances | Pokédex`,
    `${label} — Faiblesses & Résistances`,
  ]);
