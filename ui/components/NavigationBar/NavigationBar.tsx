import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  addClassToElement,
  doesElementContainClass,
  getElementById,
  removeClassFromElement,
} from "../../../utils/domManipulation";
import TypesSelector from "../TypesSelector/TypesSelector";
import SearchInput from "../SearchInput/SearchInput";
import ListSortingDropdown from "../ListSortingDropdown/ListSortingDropdown";
import styles from "./NavigationBar.module.css";
import ResolutionToggleSwitch from "../ResolutionToggleSwitch/ResolutionToggleSwitch";
import ThemeToggleSwitch from "../ThemeToggleSwitch/ThemeToggleSwitch";
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";
import { HOME, TYPE_INTERACTIONS, FR_HOME, FR_TYPE_INTERACTIONS } from "../../../constants/Routes";
import { useLocale, useStrings } from "../../../hooks/useLocale";

const DRAWER_ELEMENT_ID = "drawerElementId";
const FILTER_ELEMENT_ID = "filterButtonId";
const SCROLL_HIDE_THRESHOLD = 120;

const NavigationBar = () => {
  const router = useRouter();
  const locale = useLocale();
  const strings = useStrings();
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Locale-aware destinations: the FR chrome links into the /fr tree, the EN
  // chrome keeps the root routes (unchanged output on English pages).
  const homeHref = locale === "fr" ? FR_HOME : HOME;
  const typeChartHref = locale === "fr" ? FR_TYPE_INTERACTIONS : TYPE_INTERACTIONS;

  // Also true on the per-combo pages (/type-interactions/[combo]) so the tab
  // stays highlighted after picking a type — matched for both locales.
  const isTypeChart =
    router.pathname === TYPE_INTERACTIONS ||
    router.pathname.startsWith(`${TYPE_INTERACTIONS}/`) ||
    router.pathname === FR_TYPE_INTERACTIONS ||
    router.pathname.startsWith(`${FR_TYPE_INTERACTIONS}/`);
  const isHome = router.pathname === HOME || router.pathname === FR_HOME;
  const showTypeFilter = !isTypeChart;

  // Hide the bar when scrolling down (past its own height), reveal it the moment
  // the user scrolls back up, and always show it at the top of the page.
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= SCROLL_HIDE_THRESHOLD) {
        setHidden(false);
      } else if (currentScrollY > lastScrollY) {
        setHidden(true);
      } else if (currentScrollY < lastScrollY) {
        setHidden(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the mobile options sheet whenever the route changes.
  useEffect(() => setMenuOpen(false), [router.pathname]);

  const openDrawer = (drawer: HTMLElement, button: HTMLElement) => {
    addClassToElement(drawer, styles.open);
    addClassToElement(button, styles.filterActive);
    setFilterOpen(true);
  };

  const closeDrawer = (drawer: HTMLElement, button: HTMLElement) => {
    removeClassFromElement(drawer, styles.open);
    removeClassFromElement(button, styles.filterActive);
    setFilterOpen(false);
  };

  const toggleDrawer = () => {
    const drawer = getElementById(DRAWER_ELEMENT_ID);
    const button = getElementById(FILTER_ELEMENT_ID);

    if (!drawer || !button) {
      return;
    }

    return doesElementContainClass(drawer, styles.open) ? closeDrawer(drawer, button) : openDrawer(drawer, button);
  };

  const renderDrawer = () =>
    showTypeFilter ? (
      <div className={[styles.drawer, styles.close].join(" ")} id={DRAWER_ELEMENT_ID}>
        <p>{strings.filterByType}</p>
        <TypesSelector />
      </div>
    ) : null;

  // The right-hand cluster (sort · theme · resolution). On desktop it sits inline
  // in the bar; on mobile it is rendered inside the slide-up options sheet.
  const renderControls = () => (
    <>
      {isHome && <ListSortingDropdown />}
      <div className={styles.toggleGroup}>
        <ThemeToggleSwitch />
        <ResolutionToggleSwitch />
      </div>
      <LanguageSwitcher />
    </>
  );

  return (
    <>
      <nav className={`${styles.container} ${hidden ? styles.hidden : ""}`} aria-label={strings.navPrimaryLabel}>
        <div className={styles.bar}>
          <Link href={homeHref} className={styles.logoLink} aria-label={strings.navHomeAria}>
            {/* The link's aria-label already names this for assistive tech, so the
                alt text is not announced twice — it exists for crawlers and for
                images-off rendering. Bing Webmaster reports a bare alt="" here as
                a missing-alt notice regardless of the surrounding aria-label. */}
            <img
              className={styles.logo}
              src="/icons/logo.webp"
              alt={strings.navLogoAlt}
              width={400}
              height={143}
              fetchPriority="high"
            />
          </Link>

          {/* Desktop-only segmented tabs (mobile uses the bottom tab bar). */}
          <div className={styles.tabs}>
            <Link
              href={homeHref}
              className={`${styles.tab} ${!isTypeChart ? styles.tabActive : ""}`}
              aria-current={!isTypeChart ? "page" : undefined}
            >
              {strings.navPokedex}
            </Link>
            <Link
              href={typeChartHref}
              className={`${styles.tab} ${isTypeChart ? styles.tabActive : ""}`}
              aria-current={isTypeChart ? "page" : undefined}
            >
              {strings.navTypeChart}
            </Link>
          </div>

          <div className={styles.searchWrap}>
            <SearchInput />
          </div>

          {/* Desktop-only type-filter funnel (mobile folds this into the sheet). */}
          {showTypeFilter && (
            <button
              type="button"
              id={FILTER_ELEMENT_ID}
              className={styles.filterBtn}
              onClick={toggleDrawer}
              aria-label={strings.navFilterAria}
              aria-expanded={filterOpen}
              aria-controls={DRAWER_ELEMENT_ID}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          )}

          {/* Desktop-only control cluster. */}
          <div className={styles.controls}>{renderControls()}</div>

          {/* Mobile-only overflow menu trigger. */}
          <button
            type="button"
            className={`${styles.menuBtn} ${menuOpen ? styles.menuActive : ""}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={strings.navOptionsAria}
            aria-expanded={menuOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
        </div>
        {renderDrawer()}
      </nav>

      {/* Mobile-only options sheet: type filter + sort + theme + resolution. */}
      <div
        className={`${styles.sheetOverlay} ${menuOpen ? styles.sheetOpen : ""}`}
        onClick={() => setMenuOpen(false)}
      >
        {/* `inert` when closed: the sheet stays display:block (only opacity/
            transform hide it on mobile), so without this its controls remain
            keyboard-focusable and announced to screen readers as ghost tab stops. */}
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()} inert={!menuOpen}>

          <div className={styles.sheetHandle} />
          <div className={styles.sheetControls}>{renderControls()}</div>
          {showTypeFilter && (
            <div className={styles.sheetFilter}>
              <p>{strings.filterByType}</p>
              <TypesSelector />
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only bottom tab bar. */}
      <nav className={styles.bottomTabs} aria-label={strings.navPrimaryLabel}>
        <Link
          href={homeHref}
          className={`${styles.bottomTab} ${!isTypeChart ? styles.bottomTabActive : ""}`}
          aria-current={!isTypeChart ? "page" : undefined}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
          </svg>
          {strings.navPokedex}
        </Link>
        <Link
          href={typeChartHref}
          className={`${styles.bottomTab} ${isTypeChart ? styles.bottomTabActive : ""}`}
          aria-current={isTypeChart ? "page" : undefined}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {strings.navTypeChart}
        </Link>
      </nav>
    </>
  );
};

export default NavigationBar;
