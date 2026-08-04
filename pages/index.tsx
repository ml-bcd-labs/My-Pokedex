import fs from "fs";
import path from "path";
import React, { useContext, memo, useEffect } from "react";
import ReactDOM from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import styles from "./Home.module.css";
import LoadingContext from "../context/LoadingContext";
import PokemonContext from "../context/PokemonContext";
import ResolutionContext from "../context/ResolutionContext";
import { LOW_RESOLUTION } from "../constants/Resolution";
import useFiltering from "../hooks/useFiltering";
import useDeferredPokemons from "../hooks/useDeferredPokemons";
import { fetchAllPokemons } from "../services/fetchPokemons/fetchPokemons";
import { cardImageUrls } from "../utils/pokemonFormatter/pokemonFormatter";
import EmptyListPlaceholder from "../ui/components/EmptyListPlaceholder/EmptyListPlaceholder";
import Header from "../ui/components/Header/Header";
import Pokemon from "../ui/components/Pokemon/Pokemon";
import ErrorScreenWrapper from "../ui/components/Wrappers/ErrorScreenWrapper/ErrorScreenWrapper";
import Page from "../ui/templates/Page/Page";
import VirtualGrid from "../ui/templates/VirtualGrid/VirtualGrid";
import { DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "../constants/Seo";
import { websiteJsonLd, organizationJsonLd } from "../utils/structuredData";
import { hreflangAlternates } from "../utils/hreflang";
import BrowseIndexStatic from "../ui/components/BrowseIndex/BrowseIndexStatic";
import { BrowseIndexContent } from "../ui/components/BrowseIndex/BrowseIndex";
import browseStyles from "../ui/components/BrowseIndex/BrowseIndex.module.css";
import { pokemonBrowseItems, groupAlphabetically } from "../utils/browseIndex";
import { UI_STRINGS } from "../locales/uiStrings";

interface IProps {
  pokemons: IBasicPokemon[];
  browseIndexHtml: string;
  browseAria: string;
  browseClassName: string;
}

const ABOVE_THE_FOLD = 6;

// How many list items are inlined into __NEXT_DATA__. Must be ≥ VirtualGrid's
// initialCount (48) so the flow render has ≥2 rows to measure from, and the
// initial viewport is fully populated before the deferred full list arrives.
const INLINE_COUNT = 48;

const HomePage = ({ pokemons, browseIndexHtml, browseAria, browseClassName }: IProps) => {
  const filteredPokemons = useFiltering();
  const { resolution } = useContext(ResolutionContext);
  const { setPokemons, setFilteredPokemons, pokemons: ctxPokemons } = useContext(PokemonContext);
  const { setLoading, loading } = useContext(LoadingContext);

  // `pokemons` is only the inlined slice (first INLINE_COUNT items in
  // __NEXT_DATA__). useDeferredPokemons returns that slice on SSR/first render —
  // no hydration mismatch — then swaps in the full ~1025-item list fetched from
  // the static /data/pokemons.json after hydration (idle + first-scroll). The
  // grid shows the inlined cards immediately and VirtualGrid's windowing extends
  // automatically once the list grows (its totalRows recomputes from items.length).
  const allPokemons = useDeferredPokemons(pokemons);

  // The context is seeded client-side (useEffect below), so on the server and the
  // first client render it's empty. Fall back to the deferred list (initially the
  // inlined slice) so the first cards — including the LCP hero image — are in the
  // server HTML and paint without waiting for hydration. Once seeded, defer to the
  // filtered list.
  const listSource = ctxPokemons.length ? filteredPokemons : allPokemons;

  const updatePokemons = () => {
    if (allPokemons) {
      // Seed BOTH lists from the deferred list: the source (so search/sort filter
      // against the full list once it arrives) and the display (so the grid never
      // blanks in the render between the two being set). useFiltering then owns
      // the display and re-applies any active query once the source is in. This
      // re-runs when the list grows 48→1025, extending the grid.
      setPokemons(allPokemons);
      setFilteredPokemons(allPokemons);
      setLoading(false);
    }
  };

  useEffect(updatePokemons, [allPokemons, setLoading, setPokemons, setFilteredPokemons]);

  useEffect(() => {
    filteredPokemons.slice(0, ABOVE_THE_FOLD).forEach((pokemon) => {
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
              <VirtualGrid
                items={listSource}
                getKey={(pokemon) => pokemon.id}
                renderItem={(pokemon, index) => (
                  <Pokemon priority={index < ABOVE_THE_FOLD} {...pokemon} />
                )}
                remeasureKey={resolution}
              />
            </div>
            {/* Server-rendered crawlable index of every Pokémon: brings all ~1025
                detail pages to one click from the homepage (the interactive grid
                above only ships its initial flow-rendered batch of links in the
                static HTML before windowing kicks in). */}
            <BrowseIndexStatic html={browseIndexHtml} ariaLabel={browseAria} className={browseClassName} />
          </>
        </Page>
      </ErrorScreenWrapper>
    </>
  );
};

export default memo(HomePage);

export async function getStaticProps() {
  const pokemons = await fetchAllPokemons();

  // The home page's BrowseIndex is de-hydrated into a dangerouslySetInnerHTML
  // island (see BrowseIndexStatic), so its markup is built once here instead
  // of via the client-only useStrings()/useLocale() hooks. The home page is
  // English-only (French lives at /fr, which still renders <BrowseIndex/>
  // normally), so the EN strings are read directly from UI_STRINGS.
  const en = UI_STRINGS.en;
  const sections = groupAlphabetically(pokemonBrowseItems(pokemons, "/pokemon/"), "en");
  const browseIndexHtml = renderToStaticMarkup(
    <BrowseIndexContent heading={en.browsePokemonHeading} sections={sections} />,
  );

  // Emit the FULL list to a static JSON file served from /data/pokemons.json.
  // useDeferredPokemons fetches it after hydration so the ~1025-item list stays
  // out of __NEXT_DATA__ (which now carries only the first INLINE_COUNT items).
  // With output: "export", Next copies public/ into out/ after page generation,
  // so this lands at out/data/pokemons.json.
  const dir = path.join(process.cwd(), "public", "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "pokemons.json"), JSON.stringify(pokemons));

  return {
    props: {
      pokemons: pokemons.slice(0, INLINE_COUNT),
      browseIndexHtml,
      browseAria: en.browsePokemonAria,
      browseClassName: browseStyles.browse,
    },
  };
}

