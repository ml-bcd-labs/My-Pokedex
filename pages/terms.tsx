import Header from "../ui/components/Header/Header";
import Page from "../ui/templates/Page/Page";
import LegalLayout from "../ui/components/LegalLayout/LegalLayout";
import { SITE_NAME } from "../constants/Seo";
import { hreflangAlternates } from "../utils/hreflang";

const TermsPage = () => (
  <>
    <Header
      title={`Terms of Use for ${SITE_NAME} — Your Rights & Responsibilities`}
      description={`The terms governing your use of ${SITE_NAME}: acceptable use of the site, its independently compiled Pokémon data, intellectual-property notices and disclaimers.`}
      canonicalPath="/terms"
      alternates={hreflangAlternates("/terms", "/fr/terms")}
    />
    <Page>
      <LegalLayout heading="Terms of Use" updated="July 13, 2026">
        <p>
          By using {SITE_NAME}{" "}you agree to these terms. The site is provided
          &quot;as is&quot;, for personal, non-commercial reference, with no warranty
          as to accuracy or availability.
        </p>

        <h2>Content &amp; intellectual property</h2>
        <p>
          Pokémon and related marks are trademarks of Nintendo, Game Freak, and The
          Pokémon Company; {SITE_NAME} is unaffiliated (see our{" "}
          <a href="/about">About page</a>). Independently compiled data on this site
          may be referenced with attribution.
        </p>

        <h2>Liability</h2>
        <p>
          {SITE_NAME} is not liable for any damages arising from use of the site or
          reliance on its data.
        </p>
      </LegalLayout>
    </Page>
  </>
);

export default TermsPage;
