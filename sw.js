// sw.js — Solicitud Supervisor (AGA FACH)
// Subir el número de CACHE_NAME cada vez que cambie icono.png,
// icono-maskable.png o manifest.json. Para index.html no hace falta:
// se busca primero en la red (ver fetch más abajo).
const CACHE_NAME = "solicitud-supervisor-v2";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icono.png",
  "./icono-maskable.png"
];

// Instalación — precarga de los archivos de la app
self.addEventListener("install", function(evt) {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(FILES_TO_CACHE); })
      .then(function() { return self.skipWaiting(); })
  );
});

// Activación — borrar cachés de versiones anteriores
self.addEventListener("activate", function(evt) {
  evt.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(evt) {
  var req = evt.request;

  // Solo GET del mismo origen. La API (supervisor-api.totis.cl) y los
  // POST/DELETE del sync pasan directo a la red, sin tocar la caché.
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // Página (index.html): red primero, caché si no hay señal.
  // Así cada versión nueva subida a GitHub llega sola al S26.
  if (req.mode === "navigate") {
    evt.respondWith(
      fetch(req)
        .then(function(resp) {
          if (resp && resp.ok) {
            var copia = resp.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put("./index.html", copia); });
          }
          return resp;
        })
        .catch(function() {
          return caches.match("./index.html").then(function(r) { return r || caches.match("./"); });
        })
    );
    return;
  }

  // Resto (manifest, iconos): caché primero, red si falta.
  evt.respondWith(
    caches.match(req).then(function(resp) { return resp || fetch(req); })
  );
});
