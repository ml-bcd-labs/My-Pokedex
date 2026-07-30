import Link from "next/link";
import type { BrowseSection } from "../../../utils/browseIndex";
import styles from "./BrowseIndex.module.css";

interface IProps {
  heading: string;
  ariaLabel: string;
  sections: BrowseSection[];
  // When rendered as a direct child of a flex-column <main>, pins the index to
  // the bottom of the content area (just above the footer) even on short pages.
  pinBottom?: boolean;
}

// A server-rendered, crawlable A–Z index of internal links, rendered inside a
// native <details> so it's collapsed for humans but fully present in the static
// HTML — crawlers read <details> content regardless of open state. The links are
// grouped into per-letter sections with an A–Z quick-jump bar. This pulls every
// detail page / type-matchup combo to within one click of a hub, fixing the
// orphaned/deep-page problem without competing with the content above it. Plain
// <a>/<Link> only; no JS gate. See groupAlphabetically in utils/browseIndex.
const BrowseIndex = ({ heading, ariaLabel, sections, pinBottom = false }: IProps) => {
  if (!sections.length) return null;

  // "#" isn't valid in an id fragment; map it to a stable slug.
  const anchorId = (key: string) => `browse-${key === "#" ? "num" : key}`;

  return (
    <nav className={pinBottom ? `${styles.browse} ${styles.pinBottom}` : styles.browse} aria-label={ariaLabel}>
      <details className={styles.details}>
        <summary className={styles.summary}>{heading}</summary>
        {/* Quick-jump row: one anchor per present letter. It lives inside the
            <details>, so the panel is already open by the time a letter is
            clicked and the in-page scroll resolves. */}
        <div className={styles.jumpbar}>
          {sections.map((section) => (
            <a key={section.key} className={styles.jump} href={`#${anchorId(section.key)}`}>
              {section.letter}
            </a>
          ))}
        </div>
        <div className={styles.groups}>
          {sections.map((section) => (
            <div key={section.key} className={styles.group}>
              {/* Plain divider (not a heading) to keep the document outline and
                  landmark tree clean — a bare letter isn't a document section. */}
              <div id={anchorId(section.key)} className={styles.letter}>
                {section.letter}
              </div>
              <ul className={styles.list}>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </nav>
  );
};

export default BrowseIndex;
