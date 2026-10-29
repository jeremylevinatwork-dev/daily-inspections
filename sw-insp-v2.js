/* Inspect app offline shell — the app page itself is cached on the device,
   so Inspect opens instantly even with no signal. Data (Supabase) is never
   cached here; the app already keeps its own on-device copy of the log and
   syncs when a connection returns. Strategy: stale-while-revalidate —
   serve the cached page at once, refresh it in the background.
   v2 (2026-10-29): new cache name + old caches deleted on activate, so the
   reliability build (insp-20261029-1517) replaces the old shell everywhere. */
var CACHE = 'insp-shell-v2';

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(['./', './index.html']); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) { return n === CACHE ? null : caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  if (url.indexOf('supabase.co') >= 0) return;              /* data: always the network, never the cache */
  if (url.indexOf(self.location.origin) !== 0) return;      /* other sites: leave alone */
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(e.request).then(function (res) {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});
