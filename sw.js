/* TRX Coach service worker: network first so updates show right away, cache as offline fallback. */
var CACHE = "trx-coach-v5";
var ASSETS = ["./", "index.html", "styles.css", "app.js", "workouts.js", "howto.js", "manifest.json",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (a) {
      return fetch(new Request(a, { cache: "reload" })).then(function (r) { if (r.ok) return c.put(a, r); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || (e.request.mode === "navigate" ? caches.match("index.html") : undefined);
      });
    })
  );
});
