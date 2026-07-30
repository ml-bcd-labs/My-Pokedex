import React, { useState, useContext, memo, useEffect } from "react";
import ReactDOM from "react-dom";
import styles from "./Home.module.css";
import LoadingContext from "../context/LoadingContext";
import PokemonContext from "../context/PokemonContext";
import ResolutionContext from "../context/ResolutionContext";
import { LOW_RESOLUTION } from "../constants/Resolution";
import useFiltering from "../hooks/useFiltering";
import { fetchAllPokemons } from "../services/fetchPokemons/fetchPokemons";
import { cardImageUrls } from "../utils/pokemonFormatter/pokemonFormatter";
import EmptyListPlaceholder from "../ui/components/EmptyListPlaceholder/EmptyListPlaceholder";
import Header from "../ui/components/Header/Header";
import Pokemon from "../ui/components/Pokemon/Pokemon";
import ErrorScreenWrapper from "../ui/components/Wrappers/ErrorScreenWrapper/ErrorScreenWrapper";
import FlexboxList from "../ui/templates/FlexboxList/FlexboxList";
import Page from "../ui/templates/Page/Page";
import { DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "../constants/Seo";
import { websiteJsonLd, organizationJsonLd } from "../utils/structuredData";
import { hreflangAlternates } from "../utils/hreflang";
import { useStrings } from "../hooks/useLocale";
import BrowseIndex from "../ui/components/BrowseIndex/BrowseIndex";
import { pokemonBrowseItems, groupAlphabetically } from "../utils/browseIndex";

interface IProps {
  pokemons: IBasicPokemon[];
}

// Render 16 up front so the first paint already overflows the viewport. Fewer
// leaves no scrollbar, then loading more pops it in and the layout jumps; 16
// keeps the scrollbar present and stable from the first render.
const POKEMON_STACK_SIZE = 16;
const ABOVE_THE_FOLD = 6;

const HomePage = ({ pokemons }: IProps) => {
  const strings = useStrings();
  const filteredPokemons = useFiltering();
  const { resolution } = useContext(ResolutionContext);
  const { setPokemons, setFilteredPokemons, pokemons: ctxPokemons } = useContext(PokemonContext);
  const { setLoading, loading } = useContext(LoadingContext);
  const [numberOfPokemonShown, setNumberOfPokemonShown] = useState(POKEMON_STACK_SIZE);

  // The context is seeded client-side (useEffect below), so on the server and the
  // first client render it's empty. Fall back to the SSG `pokemons` prop so the
  // first cards — including the LCP hero image — are in the server HTML and paint
  // without waiting for hydration. Once seeded, defer to the filtered list.
  const listSource = ctxPokemons.length ? filteredPokemons : pokemons;

  const incrementNumberOfPokemonShown = () => setNumberOfPokemonShown(numberOfPokemonShown + POKEMON_STACK_SIZE);

  // The first row is the LCP candidate: render those heroes eagerly with high
  // fetch priority instead of lazy, so the browser doesn't deprioritize them.
  const renderPokemon = (pokemon: IBasicPokemon, index: number) => (
    <Pokemon key={pokemon.id} priority={index < ABOVE_THE_FOLD} {...pokemon} />
  );

  const renderPokemons = () => listSource.slice(0, numberOfPokemonShown).map(renderPokemon);

  const areThereMorePokemonsToShow = () => numberOfPokemonShown >= listSource.length;

  const updatePokemons = () => {
    if (pokemons) {
      // Seed BOTH lists from this locale's SSG list: the source (so search/sort
      // filter against the right locale) and the display (so the grid never
      // blanks in the render between the two being set). useFiltering then owns
      // the display and re-applies any active query once the source is in.
      setPokemons(pokemons);
      setFilteredPokemons(pokemons);
      setLoading(false);
    }
  };

  useEffect(updatePokemons, [pokemons, setLoading, setPokemons, setFilteredPokemons]);

  useEffect(() => {
    filteredPokemons.slice(0, POKEMON_STACK_SIZE).forEach((pokemon) => {
      const { pixelImageUrl, hdImageUrl } = cardImageUrls(pokemon.id);
      const url = resolution === LOW_RESOLUTION ? pixelImageUrl : hdImageUrl;
      ReactDOM.preload(url, { as: "image", fetchPriority: "high" });
    });
  }, [filteredPokemons, resolution]);

  if (!listSource.length && !loading) {
    return <EmptyListPlaceholder text="No Pokemon Found..." />;
  }

  return (
    <>
      <Header
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        canonicalPath="/"
        alternates={hreflangAlternates("/", "/fr")}
        jsonLd={[websiteJsonLd(), organizationJsonLd()]}
      />
      <ErrorScreenWrapper>
        {/* No loading gate here: the home page is SSG, so the cards (and the LCP
            hero image) are available immediately and must be server-rendered. */}
        <Page>
          <>
            {/* The home page's only unique prose. SSG-rendered so the H1 and copy
                are in the HTML for crawlers and AI features, not just a card grid. */}
            <header className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>Pokédex</h1>
              <p className={styles.intro}>
                Search every Pokémon by name or National Pokédex number, filter the list by
                type, and open any entry for its base stats, type weaknesses and resistances,
                abilities and full evolution line.
              </p>
            </header>
            {/* Announce the matching count to screen readers when the search or
                type filter changes the list. Gated on the seeded context so the
                server/first-client render is empty (no hydration mismatch) and it
                doesn't announce on initial page load. */}
            <div role="status" aria-live="polite" className="srOnly">
              {ctxPokemons.length ? `${listSource.length} Pokémon` : null}
            </div>
            <div className={styles.container}>
              <FlexboxList hasReachedEnd={areThereMorePokemonsToShow()} showMore={incrementNumberOfPokemonShown}>
                {renderPokemons()}
              </FlexboxList>
            </div>
            {/* Server-rendered crawlable index of every Pokémon: brings all ~1025
                detail pages to one click from the homepage (the interactive grid
                above only ships 16 links in the static HTML). */}
            <BrowseIndex
              heading={strings.browsePokemonHeading}
              ariaLabel={strings.browsePokemonAria}
              sections={groupAlphabetically(pokemonBrowseItems(pokemons, "/pokemon/"), "en")}
            />
          </>
        </Page>
      </ErrorScreenWrapper>
    </>
  );
};

export default memo(HomePage);

export async function getStaticProps() {
  const pokemons = await fetchAllPokemons();

  return { props: { pokemons } };
}

