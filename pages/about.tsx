import Link from "next/link";
import Header from "../ui/components/Header/Header";
import Page from "../ui/templates/Page/Page";
import LegalLayout from "../ui/components/LegalLayout/LegalLayout";
import { SITE_NAME } from "../constants/Seo";
import { hreflangAlternates } from "../utils/hreflang";

const AboutPage = () => (
  <>
    <Header
      title={`About ${SITE_NAME} — Independent, Fan-Made Pokémon Reference`}
      description={`What ${SITE_NAME} is, who builds it, how its base stats and type charts are compiled, and its nominative, unaffiliated relationship to the Pokémon franchise.`}
      canonicalPath="/about"
      alternates={hreflangAlternates("/about", "/fr/about")}
    />
    <Page>
      <LegalLayout heading={`About ${SITE_NAME}`} updated="June 19, 2026">
        <p>
          {SITE_NAME} is an independent, fan-made reference for exploring Pokémon by
          type, base stats, abilities, weaknesses, and evolution. Every stat table
          and type-effectiveness chart on this site is independently compiled from
          public game data.
        </p>

        <h2>Who makes this</h2>
        <p>
          {SITE_NAME} is built and maintained by an independent developer. For
          questions, corrections, or feedback, see our{" "}
          <Link href="/contact">contact page</Link>.
        </p>

        <h2>Trademark &amp; affiliation</h2>
        <p>
          {SITE_NAME} is not affiliated with, endorsed by, or sponsored by Nintendo,
          Game Freak, or The Pokémon Company. Pokémon, Pokémon character names, and
          related marks are trademarks of Nintendo. They are used here nominatively,
          to identify the factual game data this site documents. No copyright or
          trademark infringement is intended.
        </p>
      </LegalLayout>
    </Page>
  </>
);

export default AboutPage;
