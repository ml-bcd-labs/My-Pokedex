import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Pokemon from "./Pokemon";

// usePokemonPic reads ResolutionContext but the context has a default value
// (LOW_RESOLUTION), so no provider wrapper is required to render the card.
const fixture: IBasicPokemon = {
  id: 1,
  name: "Bulbasaur",
  slug: "bulbasaur",
  types: "grass,poison",
  stats: [45, 49, 49, 45],
};

describe("Pokemon card", () => {
  it("links to the detail page (hover-prefetch, no eager viewport prefetch)", () => {
    const { container } = render(<Pokemon {...fixture} />);
    const a = container.querySelector('a[href="/pokemon/bulbasaur"]');
    expect(a).not.toBeNull();
  });
});
