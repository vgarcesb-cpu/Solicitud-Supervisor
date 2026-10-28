// sw.js — Solicitud Supervisor (AGA FACH)
// Subir el número de CACHE_NAME cada vez que cambie icono.png,
// icono-maskable.png o manifest.json. Para index.html no hace falta:
// se busca primero en la red (ver fetch más abajo).
//
// El sitio está detrás de Cloudflare Access: si la sesión venció, la red
// responde con una redirección al login. Esas respuestas nunca se guardan
// en caché, y la página siempre se guarda bajo la raíz "./".
const CACHE_NAME = "solicitud-supervisor-v3";
const FILES_TO_CACHE = [
  "./",
  "./manifest.json",
  "./icono.png",
  "./icono-maskable.png"
];

// Respuesta válida para guardar: 200 OK, sin redirecciones.
function guardable(resp) {
  return resp && resp.ok && !resp.redirected && resp.type === "basic";
}

// Instalación — precarga uno por uno; si alguno falla (sesión de Access
// vencida, sin señal) se omite y se vuelve a intentar en la próxima carga.
self.addEventListener("install", function(evt) {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(FILES_TO_CACHE.map(function(url) {
        return fetch(url, { credentials: "same-origin", cache: "no-cache" })
          .then(function(resp) { if (guardable(resp)) return cache.put(url, resp); })
          .catch(function() {});
      }));
    }).then(function() { return self.skipWaiting(); })
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

  // Página: red primero, caché si no hay señal.
  // Así cada versión nueva subida a GitHub llega sola al S26.
  if (req.mode === "navigate") {
    evt.respondWith(
      fetch(req)
        .then(function(resp) {
          if (guardable(resp)) {
            var copia = resp.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put("./", copia); });
          }
          return resp;
        })
        .catch(function() {
          return caches.match("./").then(function(r) {
            return r || new Response("Sin conexión y sin copia guardada. Abre la app una vez con señal.",
              { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
          });
        })
    );
    return;
  }

  // Resto (manifest, iconos): caché primero, red si falta.
  evt.respondWith(
    caches.match(req).then(function(resp) { return resp || fetch(req); })
  );
});
