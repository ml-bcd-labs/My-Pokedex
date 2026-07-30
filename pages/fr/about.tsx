import Header from "../../ui/components/Header/Header";
import Page from "../../ui/templates/Page/Page";
import LegalLayout from "../../ui/components/LegalLayout/LegalLayout";
import { SITE_NAME } from "../../constants/Seo";
import { hreflangAlternates } from "../../utils/hreflang";

const AboutPageFr = () => (
  <>
    <Header
      title={`À propos de ${SITE_NAME} — un Pokédex indépendant et non officiel`}
      description={`Ce qu’est ${SITE_NAME}, qui le réalise, comment ses statistiques et tableaux de types sont compilés, et sa relation nominative et non affiliée avec la licence Pokémon.`}
      canonicalPath="/fr/about"
      alternates={hreflangAlternates("/about", "/fr/about")}
      ogLocale="fr_FR"
    />
    <Page>
      <LegalLayout heading={`À propos de ${SITE_NAME}`} updated="19 juin 2026" updatedLabel="Dernière mise à jour">
        <p>
          {SITE_NAME}{" "}est une référence indépendante, créée par des fans, pour
          explorer les Pokémon par type, statistiques de base, talents, faiblesses
          et évolutions. Chaque tableau de statistiques et chaque table
          d&apos;efficacité des types de ce site est compilé de manière indépendante
          à partir de données de jeu publiques.
        </p>

        <h2>Qui réalise ce site</h2>
        <p>
          {SITE_NAME} est développé et maintenu par un développeur indépendant. Pour
          toute question, correction ou suggestion, consultez notre{" "}
          <a href="/fr/contact">page de contact</a>.
        </p>

        <h2>Marques &amp; affiliation</h2>
        <p>
          {SITE_NAME}{" "}n&apos;est ni affilié à, ni approuvé ou sponsorisé par
          Nintendo, Game Freak ou The Pokémon Company. Pokémon, les noms de
          personnages Pokémon et les marques associées sont des marques déposées de
          Nintendo. Ils sont utilisés ici de manière nominative, pour identifier les
          données factuelles du jeu que ce site documente. Aucune violation de droit
          d&apos;auteur ou de marque n&apos;est intentionnelle.
        </p>
      </LegalLayout>
    </Page>
  </>
);

export default AboutPageFr;
