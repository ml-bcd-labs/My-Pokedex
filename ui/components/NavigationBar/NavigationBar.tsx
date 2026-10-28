import { useEffect, useRef, useState } from "react";
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
// The options sheet only exists below this width (NavigationBar.module.css).
const SHEET_MEDIA_QUERY = "(max-width: 900px)";
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const NavigationBar = () => {
  const router = useRouter();
  const locale = useLocale();
  const strings = useStrings();
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Set when the sheet is dismissed by the user (Escape / overlay tap) so focus
  // goes back to the Options button — not on route changes, where it should
  // follow the navigation instead.
  const returnFocusRef = useRef(false);

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

  const dismissMenu = () => {
    returnFocusRef.current = true;
    setMenuOpen(false);
  };

  // While the options sheet is open it behaves as a modal (WCAG 2.4.11 / 2.1.2):
  // everything else is `inert` (so focus can never land on content hidden behind
  // the sheet and overlay), Tab cycles inside the sheet, Escape closes it, and
  // focus returns to the Options button.
  useEffect(() => {
    const overlay = overlayRef.current;
    const sheet = sheetRef.current;
    if (!menuOpen || !overlay?.parentElement || !sheet) {
      if (returnFocusRef.current) {
        returnFocusRef.current = false;
        menuBtnRef.current?.focus();
      }
      return;
    }

    const background = Array.from(overlay.parentElement.children).filter(
      (el): el is HTMLElement => el !== overlay && el instanceof HTMLElement && !el.inert,
    );
    background.forEach((el) => {
      el.inert = true;
    });

    const focusables = () =>
      Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0,
      );
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        returnFocusRef.current = true;
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && sheet.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    // The sheet is mobile-only: if the viewport grows past the breakpoint while
    // it is open, close it rather than leave the page inert behind a hidden sheet.
    const media = window.matchMedia(SHEET_MEDIA_QUERY);
    const onMediaChange = () => {
      if (!media.matches) setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onMediaChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", onMediaChange);
      background.forEach((el) => {
        el.inert = false;
      });
    };
  }, [menuOpen]);

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
            ref={menuBtnRef}
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
      {/* The overlay's click only dismisses when the backdrop itself is hit
          (not a bubbled click from inside the sheet). It is a pointer
          convenience: keyboard users close with Escape. */}
      <div
        ref={overlayRef}
        role="presentation"
        className={`${styles.sheetOverlay} ${menuOpen ? styles.sheetOpen : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismissMenu();
        }}
      >
        {/* `inert` when closed: the sheet stays display:block (only opacity/
            transform hide it on mobile), so without this its controls remain
            keyboard-focusable and announced to screen readers as ghost tab stops. */}
        <div ref={sheetRef} className={styles.sheet} inert={!menuOpen}>

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
