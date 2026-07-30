import { memo } from "react";

import styles from "../../type-interactions/TypeInteractions.module.css";
import Header from "../../../ui/components/Header/Header";
import TypePicker from "../../../ui/components/TypePicker/TypePicker";
import TypeMatchups from "../../../ui/components/TypeMatchups/TypeMatchups";
import TypeIntro from "../../../ui/components/TypeMatchups/TypeIntro";
import Page from "../../../ui/templates/Page/Page";
import { usePokemonTypesFromQuery } from "../../../hooks/useQueryParams";
import { toFrTypeSlug } from "../../../utils/frTypeSlug";
import { toTypeSlug } from "../../../utils/typeSlug";
import { hreflangAlternates } from "../../../utils/hreflang";
import { useStrings } from "../../../hooks/useLocale";
import BrowseIndex from "../../../ui/components/BrowseIndex/BrowseIndex";
import { frTypeComboItems, groupAlphabetically } from "../../../utils/browseIndex";

const FrTypeInteractionsPage = () => {
  const strings = useStrings();
  // Sort so a legacy ?types=water,fire URL renders the same label/order as the
  // canonical /fr/type-interactions/eau-feu page it points at. The query stays
  // English — the picker navigates to the FR combo pages.
  const selected = usePokemonTypesFromQuery().split(",").filter(Boolean).sort();
  const canonicalPath = selected.length
    ? `/fr/type-interactions/${toFrTypeSlug(selected)}`
    : "/fr/type-interactions";
  // Mirror the selected combo across locales; with nothing selected, pair the
  // bare index pages. `selected` is english, so the EN side is toTypeSlug.
  const enHref = selected.length ? `/type-interactions/${toTypeSlug(selected)}` : "/type-interactions";
  const frHref = canonicalPath;

  return (
    <>
      <Header
        title="Interactions de types Pokémon — Faiblesses & Résistances | Pokédex"
        description="Choisissez un type (ou deux) pour voir les dégâts qu'il subit et inflige à chaque autre type. Tableau complet d'efficacité des types Pokémon."
        canonicalPath={canonicalPath}
        alternates={hreflangAlternates(enHref, frHref)}
        ogLocale="fr_FR"
      />
      {/* Plan 6: hreflang/og:locale/breadcrumb */}
      <Page>
        <div className={styles.container}>
          <TypeIntro selected={selected} />
          <TypePicker selected={selected} />
          <TypeMatchups selected={selected} />
        </div>
      </Page>
      {/* Index explorable de chaque page de correspondance de types (le sélecteur
          est un filtre côté client) : sans lui les 171 pages de combos n'ont aucun
          lien interne et sont orphelines. Hors de <Page> et épinglé au bas de
          <main> pour rester juste au-dessus du pied de page, même sans sélection. */}
      <BrowseIndex
        pinBottom
        heading={strings.browseTypesHeading}
        ariaLabel={strings.browseTypesAria}
        sections={groupAlphabetically(frTypeComboItems(), "fr")}
      />
    </>
  );
};

export default memo(FrTypeInteractionsPage);
