import Header from "../../ui/components/Header/Header";
import Page from "../../ui/templates/Page/Page";
import LegalLayout from "../../ui/components/LegalLayout/LegalLayout";
import { SITE_NAME } from "../../constants/Seo";
import { hreflangAlternates } from "../../utils/hreflang";

const TermsPageFr = () => (
  <>
    <Header
      title={`Conditions d’utilisation de ${SITE_NAME} — vos droits et vos devoirs`}
      description={`Les conditions régissant votre utilisation de ${SITE_NAME} : usage acceptable, données Pokémon compilées indépendamment, propriété intellectuelle et avertissements.`}
      canonicalPath="/fr/terms"
      alternates={hreflangAlternates("/terms", "/fr/terms")}
      ogLocale="fr_FR"
    />
    <Page>
      <LegalLayout heading="Conditions d'utilisation" updated="13 juillet 2026" updatedLabel="Dernière mise à jour">
        <p>
          En utilisant {SITE_NAME}, vous acceptez ces conditions. Le site est fourni
          «&nbsp;tel quel&nbsp;», à des fins de référence personnelle et non
          commerciale, sans aucune garantie quant à l&apos;exactitude ou à la
          disponibilité.
        </p>

        <h2>Contenu &amp; propriété intellectuelle</h2>
        <p>
          Pokémon et les marques associées sont des marques déposées de Nintendo,
          Game Freak et The Pokémon Company&nbsp;; {SITE_NAME}{" "}n&apos;y est pas
          affilié (voir notre <a href="/fr/about">page À propos</a>). Les données
          compilées de manière indépendante sur ce site peuvent être citées avec
          attribution.
        </p>

        <h2>Responsabilité</h2>
        <p>
          {SITE_NAME}{" "}ne saurait être tenu responsable de tout dommage résultant de
          l&apos;utilisation du site ou de la confiance accordée à ses données.
        </p>
      </LegalLayout>
    </Page>
  </>
);

export default TermsPageFr;
