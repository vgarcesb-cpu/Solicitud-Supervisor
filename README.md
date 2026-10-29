# Solicitud Adquisición Supervisor · AGA FACH

PWA para emitir Solicitudes de Adquisición de Supervisor en terreno.
Fuerza Aérea de Chile · División de Educación · Academia de Guerra Aérea.

App: **https://solicitud-supervisor.totis.cl**
API de respaldo: https://supervisor-api.totis.cl

La app funciona sin internet. `localStorage` es la fuente de verdad. Cuando hay señal, cada solicitud se respalda en Cloudflare D1 a través de un Worker, y desde ahí se recupera en otro dispositivo.

## Qué hace

- Flujo de 3 pasos (Datos, Materiales, Resumen). No deja avanzar sin fecha, comandante e ítems completos (descripción, cantidad y precio). El PDF exige nombre, grado, cargo y firma a mano; guardar sin firma queda como borrador.
- Folio automático `ADQ-AAAA-NNNN`. Los folios de papel antiguos se cargan como registros históricos.
- Firma en canvas con dedo o mouse, pensada para el Samsung S25/S26.
- PDF con membrete institucional FACH.
- Historial local con edición en el flujo completo.
- Al guardar, la solicitud queda en pantalla y un modal confirma el folio. El formulario se limpia solo con "+ Nuevo".
- Respaldo en la nube con clave de sincronización e indicador en el encabezado: verde (todo respaldado), dorado (pendiente), gris (sin URL o sin clave).
- Detección de folios repetidos entre dispositivos. Si el Mac y el teléfono crean el mismo folio sin señal, la solicitud que sincroniza después pasa al folio siguiente y queda marcada para reimprimir.
- Se instala como app en Android y abre sin señal.

## Archivos

| Archivo | Función |
|---|---|
| `index.html` | App completa (HTML + CSS + JS, sin frameworks) |
| `manifest.json` | Datos de instalación de la PWA |
| `sw.js` | Service Worker: red primero para la página, caché sin señal |
| `icono.png`, `icono-maskable.png` | Iconos 512×512 |
| `_headers` | CSP y headers de seguridad (Cloudflare Pages) |
| `worker.js` | Worker de respaldo, v1.4 |
| `schema.sql` | Tablas de D1 y migración de la columna `uid` |
| `wrangler.toml` | Nombre del Worker y enlace a D1 |
| `CONTEXT.md` | Detalle técnico, procedimientos e historial de cambios |

## API del Worker (v1.4)

Todas las rutas, salvo `/health`, exigen `Authorization: Bearer <clave>`. La clave es el Secret `SYNC_KEY` del Worker.

| Endpoint | Método | Función |
|---|---|---|
| `/health` | GET | Estado, versión y si la clave enviada es válida |
| `/solicitudes` | POST | Guarda o actualiza por `folio_id`; 409 si el folio es de otra solicitud |
| `/solicitudes` | GET | Respaldo completo |
| `/solicitudes/:folio_id?uid=` | DELETE | Borra solo si el `uid` coincide |
| `/config` | GET | Configuración clave/valor |

CORS acepta solo `https://solicitud-supervisor.totis.cl`. Las consultas usan `prepare().bind()`.

## Conectar un dispositivo nuevo

1. Abrir https://solicitud-supervisor.totis.cl e iniciar sesión en Cloudflare Access.
2. En "Respaldo en la nube", la URL del Worker ya viene cargada.
3. Pegar la clave de sincronización (se copia desde el Mac; el procedimiento está en `CONTEXT.md`).
4. Pulsar "Guardar y probar conexión". Debe decir "· clave correcta".
5. Pulsar "Traer respaldo desde la nube".
6. En Android: menú ⋮ → "Instalar app".

## Flujo de validación

Todo cambio pasa por tres etapas:

1. Mac: desarrollo y prueba en Chrome/Safari con DevTools.
2. GitHub y Cloudflare: Pages publica el repo en 1 a 2 minutos. El Worker se despliega desde el Dashboard y después se sube el mismo `worker.js` al repo.
3. Samsung S26: prueba final en terreno.

## Estado

29-oct-2026: Worker v1.4 activo, Service Worker v3, app instalada en el S26. Validado en Mac y S26.

## Uso

Proyecto interno AGA · FACH. Uso institucional.
