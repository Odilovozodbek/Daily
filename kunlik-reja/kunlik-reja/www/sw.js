/* Oflayn ishlash uchun oddiy service worker: fayllarni birinchi ochilishda saqlab qo'yadi. */
var CACHE = "kunlik-reja-v2";
var FILES = [
  "index.html",
  "css/style.css",
  "js/app.js",
  "manifest.json",
  "img/logo.svg",
  "img/favicon.svg",
  "img/hero.svg",
  "img/empty.svg",
  "img/icon-192.png",
  "img/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
