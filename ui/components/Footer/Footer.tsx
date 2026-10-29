import Link from "next/link";
import { useRouter } from "next/router";
import {
  ABOUT,
  PRIVACY,
  CONTACT,
  TERMS,
  FR_ABOUT,
  FR_PRIVACY,
  FR_CONTACT,
  FR_TERMS,
} from "../../../constants/Routes";
import { SITE_NAME } from "../../../constants/Seo";
import { useLocale, useStrings } from "../../../hooks/useLocale";
import styles from "./Footer.module.css";

interface IProps {
  // Rendered inside a detail page's type-coloured content area (white text on the
  // themed background) rather than as the standalone band other pages use.
  embedded?: boolean;
}

const Footer = ({ embedded = false }: IProps) => {
  const strings = useStrings();
  // Point each locale at its own legal pages (the FR routes exist under /fr).
  const fr = useLocale() === "fr";
  const about = fr ? FR_ABOUT : ABOUT;
  const privacy = fr ? FR_PRIVACY : PRIVACY;
  const contact = fr ? FR_CONTACT : CONTACT;
  const terms = fr ? FR_TERMS : TERMS;
  // pathname (the route, no query/hash) is identical on the static prerender and
  // after hydration for these non-dynamic legal pages.
  const { pathname } = useRouter();
  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <footer className={`${styles.footer}${embedded ? ` ${styles.embedded}` : ""}`}>
      <nav className={styles.links} aria-label={strings.footerNavLabel}>
        <Link href={about} aria-current={current(about)}>{strings.footerAbout}</Link>
        <Link href={privacy} aria-current={current(privacy)}>{strings.footerPrivacy}</Link>
        <Link href={contact} aria-current={current(contact)}>{strings.footerContact}</Link>
        <Link href={terms} aria-current={current(terms)}>{strings.footerTerms}</Link>
      </nav>
      <p className={styles.disclaimer}>
        {SITE_NAME} {strings.footerDisclaimer}
      </p>
      {/* Credit the IP owners, never the site: no publisher/owner identity is
          claimed for a fan site built on Nintendo's IP. */}
      <p>Pokémon © Nintendo / Creatures / GAME FREAK.</p>
    </footer>
  );
};

export default Footer;
