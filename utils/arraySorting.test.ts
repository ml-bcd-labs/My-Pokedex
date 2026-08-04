import { describe, it, expect } from "vitest";
import { sortByStatAsc, sortByStatDesc } from "./arraySorting";

// stats tuple = [hp, attack, defense, speed]
const mons = [
  { id: 3, name: "c", stats: [80, 50, 50, 90] },
  { id: 1, name: "a", stats: [45, 49, 49, 45] },
  { id: 2, name: "b", stats: [60, 62, 63, 45] },
] as unknown as IBasicPokemon[];

describe("sortByStat", () => {
  it("sorts ascending by the given stat index (speed = 3)", () => {
    expect(sortByStatAsc(mons, 3).map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("sorts descending by the given stat index (hp = 0)", () => {
    expect(sortByStatDesc(mons, 0).map((m) => m.id)).toEqual([3, 2, 1]);
  });

  it("breaks ties by id so equal stats stay stable", () => {
    // ids 1 and 2 both have speed 45 -> ascending keeps id order 1 then 2.
    expect(sortByStatAsc(mons, 3).map((m) => m.id)).toEqual([1, 2, 3]);
    expect(sortByStatDesc(mons, 3).map((m) => m.id)).toEqual([3, 1, 2]);
  });

  it("does not mutate the input array", () => {
    const before = mons.map((m) => m.id);
    sortByStatAsc(mons, 1);
    expect(mons.map((m) => m.id)).toEqual(before);
  });
});
