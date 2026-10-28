import { memo } from "react";

import styles from "../../type-interactions/TypeInteractions.module.css";
import Header from "../../../ui/components/Header/Header";
import TypePicker from "../../../ui/components/TypePicker/TypePicker";
import TypeMatchups from "../../../ui/components/TypeMatchups/TypeMatchups";
import TypeIntro from "../../../ui/components/TypeMatchups/TypeIntro";
import Page from "../../../ui/templates/Page/Page";
import BrowseIndex from "../../../ui/components/BrowseIndex/BrowseIndex";
import { allFrTypeSlugs, parseFrTypeSlug } from "../../../utils/frTypeSlug";
import { toTypeSlug } from "../../../utils/typeSlug";
import { FR_TYPE_LABELS } from "../../../constants/FrTypeLabels";
import { capitalizeFirstLetter } from "../../../utils/stringManipulation";
import { hreflangAlternates } from "../../../utils/hreflang";
import { frTypeComboItems, groupAlphabetically } from "../../../utils/browseIndex";
import { matchupSummary } from "../../../utils/pokemonTypes/matchups";
import { frComboDescription, frComboTitle } from "../../../utils/pokemonMeta";
import { useStrings } from "../../../hooks/useLocale";
import type { SwitchTarget } from "../../../context/SwitchTargetContext";

interface IProps {
  combo: string;
  types: string[];
  switchTarget?: SwitchTarget;
}

const FrComboPage = ({ combo, types }: IProps) => {
  const strings = useStrings();
  const frLabel = (t: string) => FR_TYPE_LABELS[t] ?? capitalizeFirstLetter(t);
  const label = types.map(frLabel).join(" / ");

  return (
    <>
      <Header
        title={frComboTitle(label)}
        description={frComboDescription(label, matchupSummary(types), frLabel)}
        canonicalPath={`/fr/type-interactions/${combo}`}
        alternates={hreflangAlternates(`/type-interactions/${toTypeSlug(types)}`, `/fr/type-interactions/${combo}`)}
        ogLocale="fr_FR"
      />
      {/* Plan 6: hreflang/og:locale/breadcrumb */}
      <Page>
        <div className={styles.container}>
          <TypeIntro selected={types} />
          <TypePicker selected={types} />
          <TypeMatchups selected={types} />
        </div>
      </Page>
      {/* Même index explorable A–Z que le hub /fr/type-interactions, présent sur
          chaque page de combo (sélectionner un type navigue ici). Épinglé au bas
          de <main>, juste au-dessus du pied de page. */}
      <BrowseIndex
        pinBottom
        heading={strings.browseTypesHeading}
        ariaLabel={strings.browseTypesAria}
        sections={groupAlphabetically(frTypeComboItems(), "fr")}
      />
    </>
  );
};

export default memo(FrComboPage);

export async function getStaticPaths() {
  const paths = allFrTypeSlugs().map((combo) => ({ params: { combo } }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }: { params: { combo: string } }) {
  const types = parseFrTypeSlug(params.combo);
  if (!types.length) {
    return { notFound: true };
  }
  return {
    props: {
      combo: params.combo,
      types,
      switchTarget: {
        en: `/type-interactions/${toTypeSlug(types)}`,
        fr: `/fr/type-interactions/${params.combo}`,
      },
    },
  };
}
