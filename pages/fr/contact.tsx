import Header from "../../ui/components/Header/Header";
import Page from "../../ui/templates/Page/Page";
import LegalLayout from "../../ui/components/LegalLayout/LegalLayout";
import { SITE_NAME } from "../../constants/Seo";
import { hreflangAlternates } from "../../utils/hreflang";

const ContactPageFr = () => (
  <>
    <Header
      title={`Contacter ${SITE_NAME} — questions, corrections et suggestions`}
      description={`Comment contacter l’équipe de ${SITE_NAME} pour signaler une erreur, poser une question ou envoyer vos suggestions sur le Pokédex, ses stats et ses types.`}
      canonicalPath="/fr/contact"
      alternates={hreflangAlternates("/contact", "/fr/contact")}
      ogLocale="fr_FR"
    />
    <Page>
      <LegalLayout heading="Contact" updated="19 juin 2026" updatedLabel="Dernière mise à jour">
        <p>
          Pour toute question, correction de données ou suggestion concernant{" "}
          {SITE_NAME}, écrivez à{" "}
          <a href="mailto:doozy_34@proton.me">doozy_34@proton.me</a>.
        </p>
        <p>Nous nous efforçons de répondre sous quelques jours ouvrés.</p>
      </LegalLayout>
    </Page>
  </>
);

export default ContactPageFr;
