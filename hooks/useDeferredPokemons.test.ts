import { afterEach, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import useDeferredPokemons from "./useDeferredPokemons";

const initial: IBasicPokemon[] = [
  { id: 1, name: "Bulbasaur", slug: "bulbasaur", types: "grass,poison", stats: [45, 49, 49, 45], evolvesFrom: null },
];
const full: IBasicPokemon[] = [
  ...initial,
  { id: 2, name: "Ivysaur", slug: "ivysaur", types: "grass,poison", stats: [60, 62, 63, 60], evolvesFrom: { id: 1, name: "Bulbasaur" } },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns initial slice, then the full list after fetch resolves", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => full }));
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => { cb(); return 0; });

  const { result } = renderHook(() => useDeferredPokemons(initial));

  expect(result.current).toEqual(initial);
  await waitFor(() => expect(result.current).toEqual(full));
});

test("keeps the initial slice when the fetch fails after its single retry", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => { cb(); return 0; });

  const { result } = renderHook(() => useDeferredPokemons(initial));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)); // initial + one retry
  expect(result.current).toEqual(initial);
});

test("falls back to a scroll trigger when requestIdleCallback is unavailable", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => full });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestIdleCallback", undefined);
  vi.useFakeTimers();

  const { result } = renderHook(() => useDeferredPokemons(initial));
  expect(result.current).toEqual(initial);

  window.dispatchEvent(new Event("scroll"));
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  vi.useRealTimers();
  await waitFor(() => expect(result.current).toEqual(full));
});
