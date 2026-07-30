import Header from "../../ui/components/Header/Header";
import Page from "../../ui/templates/Page/Page";
import LegalLayout from "../../ui/components/LegalLayout/LegalLayout";
import { SITE_NAME } from "../../constants/Seo";
import { hreflangAlternates } from "../../utils/hreflang";

const PrivacyPageFr = () => (
  <>
    <Header
      title={`Politique de confidentialité — aucun cookie ni suivi | ${SITE_NAME}`}
      description={`Comment ${SITE_NAME} traite vos données : aucun cookie, aucune publicité, aucune analyse d’audience ni suivi tiers. Ce que le site conserve et ne collecte jamais.`}
      canonicalPath="/fr/privacy"
      alternates={hreflangAlternates("/privacy", "/fr/privacy")}
      ogLocale="fr_FR"
    />
    <Page>
      <LegalLayout heading="Politique de confidentialité" updated="13 juillet 2026" updatedLabel="Dernière mise à jour">
        <p>
          Cette politique de confidentialité explique comment {SITE_NAME}{" "}
          («&nbsp;nous&nbsp;») traite les informations lorsque vous visitez ce site.
        </p>

        <h2>Aucun cookie, aucune publicité, aucune analyse d&apos;audience</h2>
        <p>
          Nous n&apos;utilisons aucun cookie, nous n&apos;affichons aucune publicité
          et nous ne réalisons aucune analyse d&apos;audience ni aucun suivi des
          visiteurs. Aucun script tiers de suivi ou de publicité n&apos;est chargé, et
          nous ne collectons aucune donnée personnelle vous concernant.
        </p>
        <p>
          Certaines données techniques (telles que votre adresse IP et le user-agent
          de votre navigateur) peuvent être traitées de manière transitoire par notre
          hébergeur pour vous servir les pages, comme c&apos;est le cas pour tout site
          web. Ces données ne sont pas utilisées pour vous identifier ni vous suivre.
        </p>

        <h2>Contact</h2>
        <p>
          Des questions sur cette politique&nbsp;? Consultez notre{" "}
          <a href="/fr/contact">page de contact</a>.
        </p>
      </LegalLayout>
    </Page>
  </>
);

export default PrivacyPageFr;
