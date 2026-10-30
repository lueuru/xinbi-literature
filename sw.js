
var CACHE = "xinbi-basic-v69";
var SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./work.html",
  "./journal.html",
  "./admin.html",
  "./works.html",
  "./guide.html",
  "./about.html",
  "./authors.html",
  "./issue.html",
  "./craft.html",
  "./reading.html",
  "./contest.html",
  "./search.html",
  "./gallery.html",
  "./activity.html",
  "./sections.html",
  "./tags.html",
  "./timeline.html",
  "./join.html",
  "./assets/js/contest-real.js",
  "./assets/js/activities.js",
  "./assets/js/people.js",
  "./404.html",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/data.js",
  "./assets/js/config.js",
  "./assets/js/app.js",
  "./assets/js/cloud.js",
  "./assets/vendor/workbuddy-cloud.js",
  "./assets/icons/icon.svg",
  "./assets/icons/emblem-256.png",
  "./assets/icons/emblem-32.png",
  "./assets/icons/emblem-64.png",
  "./assets/icons/emblem-180.png",
  "./assets/icons/emblem-512.png",
  "./assets/photos/event-09.jpg",
  "./assets/photos/event-08.jpg",
  "./assets/photos/event-07.jpg",
  "./assets/photos/event-06.jpg",
  "./assets/photos/event-05.jpg",
  "./assets/photos/event-04.jpg",
  "./assets/photos/event-03.jpg",
  "./assets/photos/event-02.jpg",
  "./assets/photos/event-01.jpg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; 

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  if (/\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
