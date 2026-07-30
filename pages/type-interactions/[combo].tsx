import { memo } from "react";

import styles from "./TypeInteractions.module.css";
import Header from "../../ui/components/Header/Header";
import TypePicker from "../../ui/components/TypePicker/TypePicker";
import TypeMatchups from "../../ui/components/TypeMatchups/TypeMatchups";
import TypeIntro from "../../ui/components/TypeMatchups/TypeIntro";
import Page from "../../ui/templates/Page/Page";
import BrowseIndex from "../../ui/components/BrowseIndex/BrowseIndex";
import { allTypeSlugs, parseTypeSlug } from "../../utils/typeSlug";
import { toFrTypeSlug } from "../../utils/frTypeSlug";
import { breadcrumbJsonLd } from "../../utils/structuredData";
import { hreflangAlternates } from "../../utils/hreflang";
import { capitalizeFirstLetter } from "../../utils/stringManipulation";
import { enTypeComboItems, groupAlphabetically } from "../../utils/browseIndex";
import { useStrings } from "../../hooks/useLocale";
import type { SwitchTarget } from "../../context/SwitchTargetContext";

interface IProps {
  combo: string;
  types: string[];
  switchTarget?: SwitchTarget;
}

const ComboPage = ({ combo, types }: IProps) => {
  const strings = useStrings();
  const label = types.map(capitalizeFirstLetter).join(" / ");
  const noun = types.length > 1 ? "Types" : "Type";

  return (
    <>
      <Header
        title={`${label} ${noun} — Weaknesses, Resistances & Best Matchups | Pokédex`}
        description={`Type effectiveness for ${label}: which types it is weak to, which it resists, and which it deals the most damage against.`}
        canonicalPath={`/type-interactions/${combo}`}
        alternates={hreflangAlternates(`/type-interactions/${combo}`, `/fr/type-interactions/${toFrTypeSlug(types)}`)}
        jsonLd={breadcrumbJsonLd([
          { name: "Pokédex", path: "/" },
          { name: "Type Interactions", path: "/type-interactions" },
          { name: `${label} ${noun}`, path: `/type-interactions/${combo}` },
        ])}
      />
      <Page>
        <div className={styles.container}>
          <TypeIntro selected={types} />
          <TypePicker selected={types} />
          <TypeMatchups selected={types} />
        </div>
      </Page>
      {/* Same crawlable A–Z index as the /type-interactions hub, kept on every
          combo page so it's present at all times (selecting a type navigates
          here). Pinned to the bottom of <main>, just above the footer. */}
      <BrowseIndex
        pinBottom
        heading={strings.browseTypesHeading}
        ariaLabel={strings.browseTypesAria}
        sections={groupAlphabetically(enTypeComboItems(), "en")}
      />
    </>
  );
};

export default memo(ComboPage);

export async function getStaticPaths() {
  const paths = allTypeSlugs().map((combo) => ({ params: { combo } }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }: { params: { combo: string } }) {
  const types = parseTypeSlug(params.combo);
  if (!types.length) {
    return { notFound: true };
  }
  return {
    props: {
      combo: params.combo,
      types,
      switchTarget: {
        en: `/type-interactions/${params.combo}`,
        fr: `/fr/type-interactions/${toFrTypeSlug(types)}`,
      },
    },
  };
}
