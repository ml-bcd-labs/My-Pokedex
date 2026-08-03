import Head from "next/head";
import {
  SITE_NAME,
  SITE_LOCALE,
  DEFAULT_OG_IMAGE,
  absoluteUrl,
} from "../../../constants/Seo";

type JsonLd = Record<string, unknown>;

export interface Alternate {
  hrefLang: string;
  href: string;
}

// Pure, render-free mapping of hreflang alternates to their absolutized form so
// it can be unit-tested without mounting next/head. Order is preserved; an
// empty or undefined list yields no tags.
export const alternateLinkTags = (
  alternates?: Alternate[],
): Alternate[] =>
  (alternates ?? []).map((a) => ({
    hrefLang: a.hrefLang,
    href: absoluteUrl(a.href),
  }));

interface IProps {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image";
  jsonLd?: JsonLd | JsonLd[];
  alternates?: Alternate[];
  ogLocale?: string;
}

const Header = ({
  title,
  description,
  canonicalPath = "/",
  image = DEFAULT_OG_IMAGE,
  imageAlt,
  imageWidth,
  imageHeight,
  ogType = "website",
  twitterCard = "summary_large_image",
  jsonLd,
  alternates,
  ogLocale = SITE_LOCALE,
}: IProps) => {
  const canonical = absoluteUrl(canonicalPath);
  const ogImage = absoluteUrl(image);
  const ogImageAlt = imageAlt ?? title;
  // Dimensions are only safe to advertise for our known default banner; remote
  // artwork on detail pages varies, so emit them only when a page passes them.
  const usingDefaultImage = image === DEFAULT_OG_IMAGE;
  const ogWidth = imageWidth ?? (usingDefaultImage ? 1200 : undefined);
  const ogHeight = imageHeight ?? (usingDefaultImage ? 630 : undefined);
  const jsonLdItems = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const alternateLinks = alternateLinkTags(alternates);

  return (
    <Head>
      <title>{title}</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      <meta name="description" content={description} />
      {/* Google Discover large-image cards + full image/snippet previews. Cheap,
          site-wide, high value for an image-heavy Pokédex (MASTER_SEO_COOKBOOK §1). */}
      <meta
        name="robots"
        content="max-image-preview:large, max-snippet:-1, max-video-preview:-1"
      />
      <link rel="canonical" href={canonical} />
      {alternateLinks.map((a) => (
        <link
          key={a.hrefLang}
          rel="alternate"
          hrefLang={a.hrefLang}
          href={a.href}
        />
      ))}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={ogImageAlt} />
      {ogWidth && <meta property="og:image:width" content={String(ogWidth)} />}
      {ogHeight && <meta property="og:image:height" content={String(ogHeight)} />}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={ogLocale} />

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />

      <meta name="theme-color" content="#b91c1c" />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      <link rel="manifest" href="/site.webmanifest" />

      {/* The brand fonts load via their @font-face rules (globals.css) with
          font-display: swap, so text paints immediately in the system fallback
          and the branded face swaps in when it arrives. We deliberately do NOT
          preload them: preloading fetches ~149 KB at the highest priority, which
          on slow connections competes with the LCP image for bandwidth and pushes
          LCP out — while swap already guarantees the fonts never block paint.
          Content first; the branded typeface is deferred behind it. */}

      {jsonLdItems.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </Head>
  );
};

export default Header;
