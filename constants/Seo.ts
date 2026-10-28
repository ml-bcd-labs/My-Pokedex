export const SITE_ORIGIN = "https://my-pokedex.com";
export const SITE_NAME = "My Pokédex";
export const SITE_LOCALE = "en_US";

export const DEFAULT_TITLE = "Pokédex — Search Every Pokémon by Type, Stats & Weakness";
export const DEFAULT_DESCRIPTION =
  "Explore every Pokémon by type, weakness, ability and evolution. Search by name or National Pokédex number and compare base stats and type matchups.";
export const DEFAULT_OG_IMAGE = "/images/og-default.png";

// Absolute URLs for canonical/OG. Already-absolute inputs (e.g. remote artwork)
// pass through untouched; root-relative paths get the canonical origin prefixed.
export const absoluteUrl = (path: string): string =>
  /^https?:\/\//.test(path) ? path : `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
