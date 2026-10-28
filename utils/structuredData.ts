import { SITE_ORIGIN, SITE_NAME, absoluteUrl } from "../constants/Seo";

type JsonLd = Record<string, unknown>;

export const websiteJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_ORIGIN,
  // No potentialAction/SearchAction: Google retired the Sitelinks Searchbox on
  // 21 Nov 2024, so it is inert markup.
});

export const organizationJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_ORIGIN,
  logo: absoluteUrl("/icons/icon-512.png"),
});

// No `inLanguage`: schema.org gives it no domain on BreadcrumbList/ItemList, so
// it failed vocabulary validation on every FR detail page. The page language is
// already declared by <html lang> and hreflang.
export const breadcrumbJsonLd = (items: Array<{ name: string; path: string }>): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});
