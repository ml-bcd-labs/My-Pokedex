// Post-build: stamp out/sw.js with a unique VERSION so each deploy purges the
// previous caches on activate.
//
// The service worker keys every cache on VERSION and drops any cache not in
// CURRENT_CACHES when it activates. That only purges anything if VERSION
// actually changes between deploys. It was a hand-maintained `"v1"` with a
// comment asking whoever deployed to bump it, and git shows it untouched since
// the PWA landed — so caches were never invalidated and returning visitors
// could be served stale assets indefinitely.
//
// Uses the git short hash (stable, traceable to a commit), falling back to a
// timestamp outside a git checkout.
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const swPath = new URL('../out/sw.js', import.meta.url);

let version;
try {
  version = execSync('git rev-parse --short HEAD', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
} catch {
  version = `t${Date.now()}`;
}

const sw = await readFile(swPath, 'utf8');
const stamped = sw.replace('__CACHE_VERSION__', version);

if (stamped === sw) {
  // Hard failure, not a warning: shipping the literal placeholder is the exact
  // bug this script exists to prevent, and it is invisible once deployed.
  console.error(
    'inject-sw-version: placeholder __CACHE_VERSION__ not found in out/sw.js.\n' +
      'Either public/sw.js no longer declares it, or this ran twice on the same\n' +
      'build output. Refusing to ship an unstamped service worker.',
  );
  process.exit(1);
}

await writeFile(swPath, stamped);
console.log('inject-sw-version: VERSION =', version);
