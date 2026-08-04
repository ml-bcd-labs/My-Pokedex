import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import BrowseIndexStatic from "./BrowseIndexStatic";

test("renders provided html verbatim inside a labelled nav without hydrating children", () => {
  const html = '<details><summary>Browse</summary><a href="/pokemon/pikachu">Pikachu</a></details>';
  const { container } = render(
    <BrowseIndexStatic html={html} ariaLabel="Browse all Pokémon" className="browse" />,
  );
  const nav = container.querySelector("nav");
  expect(nav).toHaveAttribute("aria-label", "Browse all Pokémon");
  expect(nav).toHaveClass("browse");
  expect(nav?.innerHTML).toBe(html);
  expect(container.querySelector('a[href="/pokemon/pikachu"]')).not.toBeNull();
});
