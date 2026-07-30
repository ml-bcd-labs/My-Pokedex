import React, { useState, useContext, memo, useEffect } from "react";
import ReactDOM from "react-dom";
import styles from "../Home.module.css";
import LoadingContext from "../../context/LoadingContext";
import PokemonContext from "../../context/PokemonContext";
import ResolutionContext from "../../context/ResolutionContext";
import { LOW_RESOLUTION } from "../../constants/Resolution";
import useFiltering from "../../hooks/useFiltering";
import { fetchAllPokemonsFr } from "../../services/fetchPokemons/fetchPokemonsFr";
import { cardImageUrls } from "../../utils/pokemonFormatter/pokemonFormatter";
import { FR_TYPE_LABELS } from "../../constants/FrTypeLabels";
import { useStrings } from "../../hooks/useLocale";
import EmptyListPlaceholder from "../../ui/components/EmptyListPlaceholder/EmptyListPlaceholder";
import Header from "../../ui/components/Header/Header";
import PokemonFr from "../../ui/components/PokemonFr/PokemonFr";
import ErrorScreenWrapper from "../../ui/components/Wrappers/ErrorScreenWrapper/ErrorScreenWrapper";
import FlexboxList from "../../ui/templates/FlexboxList/FlexboxList";
import Page from "../../ui/templates/Page/Page";
import { hreflangAlternates } from "../../utils/hreflang";
import BrowseIndex from "../../ui/components/BrowseIndex/BrowseIndex";
import { pokemonBrowseItems, groupAlphabetically } from "../../utils/browseIndex";

interface IProps {
  pokemons: IBasicPokemon[];
}

// Render 16 up front so the first paint already overflows the viewport. Fewer
// leaves no scrollbar, then loading more pops it in and the layout jumps; 16
// keeps the scrollbar present and stable from the first render.
const POKEMON_STACK_SIZE = 16;
const ABOVE_THE_FOLD = 6;

const HomePageFr = ({ pokemons }: IProps) => {
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
    <PokemonFr key={pokemon.id} typeLabels={FR_TYPE_LABELS} priority={index < ABOVE_THE_FOLD} {...pokemon} />
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
    return <EmptyListPlaceholder text={strings.emptyList} />;
  }

  return (
    <>
      <Header
        title="Pokédex en français — stats, types, faiblesses, évolutions"
        description="Le Pokédex en français : recherchez chaque Pokémon par nom ou numéro, filtrez par type et consultez statistiques, faiblesses, talents et évolutions."
        canonicalPath="/fr"
        alternates={hreflangAlternates("/", "/fr")}
        ogLocale="fr_FR"
      />
      {/* Plan 6: hreflang, og:locale fr_FR, self-canonical, JSON-LD */}
      <ErrorScreenWrapper>
        {/* No loading gate here: the home page is SSG, so the cards (and the LCP
            hero image) are available immediately and must be server-rendered. */}
        <Page>
          <>
            {/* The home page's only unique prose. SSG-rendered so the H1 and copy
                are in the HTML for crawlers and AI features, not just a card grid. */}
            <header className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>{strings.homeTitleH1}</h1>
              <p className={styles.intro}>{strings.homeIntro}</p>
            </header>
            {/* Annonce le nombre de résultats aux lecteurs d'écran quand la
                recherche ou le filtre par type change la liste (voir pages/index). */}
            <div role="status" aria-live="polite" className="srOnly">
              {ctxPokemons.length ? `${listSource.length} Pokémon` : null}
            </div>
            <div className={styles.container}>
              <FlexboxList hasReachedEnd={areThereMorePokemonsToShow()} showMore={incrementNumberOfPokemonShown}>
                {renderPokemons()}
              </FlexboxList>
            </div>
            {/* Server-rendered crawlable index of every Pokémon (French names +
                /fr/pokemon/ slugs): every detail page one click from /fr. */}
            <BrowseIndex
              heading={strings.browsePokemonHeading}
              ariaLabel={strings.browsePokemonAria}
              sections={groupAlphabetically(pokemonBrowseItems(pokemons, "/fr/pokemon/", true), "fr")}
            />
          </>
        </Page>
      </ErrorScreenWrapper>
    </>
  );
};

export default memo(HomePageFr);

export async function getStaticProps() {
  const pokemons = await fetchAllPokemonsFr();

  return { props: { pokemons } };
}
