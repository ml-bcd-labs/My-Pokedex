import { test } from "node:test";
import assert from "node:assert/strict";
import { stableStringify, hashEntity, resolveLastmods } from "./lastmodStore.mjs";

test("stableStringify is key-order independent", () => {
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
});

test("stableStringify recurses into nested objects and arrays", () => {
  const x = { a: [{ q: 1, p: 2 }], z: { n: null } };
  const y = { z: { n: null }, a: [{ p: 2, q: 1 }] };
  assert.equal(stableStringify(x), stableStringify(y));
});

test("hashEntity is stable across key order and sensitive to values", () => {
  assert.equal(hashEntity({ b: 1, a: 2 }), hashEntity({ a: 2, b: 1 }));
  assert.notEqual(hashEntity({ a: 1 }), hashEntity({ a: 1, b: 1 }));
});

test("first run adopts the fallback date rather than claiming everything changed today", () => {
  const { lastmods, next } = resolveLastmods({
    hashes: { 1: "aaa", 2: "bbb" },
    previous: {},
    today: "2026-08-10",
    fallback: "2026-07-07",
  });
  assert.deepEqual(lastmods, { 1: "2026-07-07", 2: "2026-07-07" });
  assert.deepEqual(next, {
    1: { hash: "aaa", date: "2026-07-07" },
    2: { hash: "bbb", date: "2026-07-07" },
  });
});

test("an unchanged entity keeps the date it genuinely last changed", () => {
  const { lastmods } = resolveLastmods({
    hashes: { 1: "aaa" },
    previous: { 1: { hash: "aaa", date: "2026-03-14" } },
    today: "2026-08-10",
    fallback: "2026-07-07",
  });
  assert.equal(lastmods[1], "2026-03-14");
});

test("a changed entity moves to today, and only that entity", () => {
  const { lastmods } = resolveLastmods({
    hashes: { 1: "aaa", 2: "CHANGED" },
    previous: {
      1: { hash: "aaa", date: "2026-03-14" },
      2: { hash: "bbb", date: "2026-03-14" },
    },
    today: "2026-08-10",
    fallback: "2026-07-07",
  });
  assert.equal(lastmods[1], "2026-03-14", "untouched entity must not move");
  assert.equal(lastmods[2], "2026-08-10");
});

test("a new entity in an established store is dated today, not the fallback", () => {
  const { lastmods } = resolveLastmods({
    hashes: { 1: "aaa", 999: "new" },
    previous: { 1: { hash: "aaa", date: "2026-03-14" } },
    today: "2026-08-10",
    fallback: "2026-07-07",
  });
  assert.equal(lastmods[999], "2026-08-10");
});

test("repeated runs with unchanged data are idempotent", () => {
  const previous = { 1: { hash: "aaa", date: "2026-03-14" } };
  const first = resolveLastmods({ hashes: { 1: "aaa" }, previous, today: "2026-08-10", fallback: "x" });
  const second = resolveLastmods({ hashes: { 1: "aaa" }, previous: first.next, today: "2026-08-11", fallback: "x" });
  assert.deepEqual(first.next, second.next, "a rebuild with no data change must not move any date");
});

test("entities dropped from the data fall out of the store", () => {
  const { next } = resolveLastmods({
    hashes: { 1: "aaa" },
    previous: { 1: { hash: "aaa", date: "2026-03-14" }, 2: { hash: "bbb", date: "2026-03-14" } },
    today: "2026-08-10",
    fallback: "x",
  });
  assert.deepEqual(Object.keys(next), ["1"]);
});
