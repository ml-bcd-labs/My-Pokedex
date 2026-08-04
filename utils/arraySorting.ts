import { compareStrings } from "./stringManipulation";

export const sortByNumberFieldAsc = (array: any, field: string) => {
  const predicate = (a: any, b: any) => a[field] - b[field];

  return [...array.sort(predicate)];
};

export const sortByNumberFieldDesc = (array: any, field: string) => {
  const predicate = (a: any, b: any) => b[field] - a[field];

  return [...array.sort(predicate)];
};

export const sortByStringFieldAsc = (array: any, field: string) => [
  ...array.sort((a: any, b: any) => compareStrings(a[field], b[field])),
];

export const sortByStringFieldDesc = (array: any, field: string) => [
  ...array.sort((a: any, b: any) => compareStrings(b[field], a[field])),
];

// Sort by a base-stat, read from the compact stats tuple [hp, attack, defense,
// speed]. Ties fall back to id so equal stats keep a stable, reproducible order.
export const sortByStatAsc = (array: IBasicPokemon[], index: number): IBasicPokemon[] =>
  [...array].sort((a, b) => a.stats[index] - b.stats[index] || a.id - b.id);

export const sortByStatDesc = (array: IBasicPokemon[], index: number): IBasicPokemon[] =>
  [...array].sort((a, b) => b.stats[index] - a.stats[index] || a.id - b.id);
