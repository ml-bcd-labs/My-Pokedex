/* My Pokédex service worker — hand-rolled (no build plugin, Turbopack-safe).
 *
 * Strategy:
 *   - Precache a small app shell (home route, fonts, key icons) on install.
 *   - navigations      -> network-first, fall back to cached page, then "/".
 *   - /_next/static/*  -> cache-first (immutable, content-hashed).
 *   - images           -> stale-while-revalidate, LRU-capped.
 *   - other same-origin (data JSON, fonts, css) -> stale-while-revalidate.
 *
 * Everything cross-origin is ignored entirely: the fetch handler returns early
 * for requests whose origin !== ours, so GTM / GA are NEVER touched by the SW
 * and keep their normal network + online-detection behaviour.
 *
 * VERSION is stamped at build time by scripts/inject-sw-version.mjs (git short
 * hash), so every deploy invalidates the previous caches on activate. Do not
 * hand-edit it: a constant VERSION means caches are never purged.
 */

const VERSION = "__CACHE_VERSION__";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const IMG_CACHE = `img-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, IMG_CACHE, DATA_CACHE];

// Cap the runtime image cache so a long browsing session can't grow unbounded
// (each Pokémon can pull full + basic + pixel art). FIFO ~ LRU here.
const MAX_IMAGES = 200;

// Stable, known URLs only. Next's JS/CSS bundles are content-hashed, so their
// names aren't knowable here — they get runtime-cached on first visit instead.
const SHELL_ASSETS = [
  "/",
  "/site.webmanifest",
  "/fonts/hdPokemonFont.woff",
  "/fonts/hdPokemonFont-bold.woff",
  "/fonts/pixelPokemonFont.ttf",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/images/surprised-pikachu.png",
];

const IMAGE_RE = /\.(?:png|webp|jpe?g|gif|svg|ico|avif)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Per-asset so one 404 can't fail the whole install.
      .then((cache) =>
        Promise.all(
          SHELL_ASSETS.map((url) =>
            cache.add(url).catch(() => {
              /* asset missing — skip, don't abort install */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !CURRENT_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only. Cross-origin requests (fonts CDN, etc.) fall through to
  // the browser's default handling untouched.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (IMAGE_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMG_CACHE, MAX_IMAGES));
    return;
  }

  // Data (Next data JSON, TypeInteractions.json), fonts, css, etc.
  event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return (
      cached ||
      (await cache.match("/")) ||
      new Response("Offline", { status: 503, statusText: "Offline" })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => {
          if (maxItems) trimCache(cacheName, maxItems);
        });
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) return cached; // instant; cache refreshes in background
  const network = await networkPromise;
  return network || new Response("", { status: 504, statusText: "Offline" });
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Cache keys preserve insertion order, so the front is the oldest.
  for (let i = 0; i < keys.length - maxItems; i++) {
    await cache.delete(keys[i]);
  }
}
