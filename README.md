# Solicitud Adquisición Supervisor — AGA · FACH

PWA **híbrida offline-first** para emitir Solicitudes de Adquisición de Supervisor en terreno.
Fuerza Aérea de Chile · División de Educación · Academia de Guerra Aérea.

> **Principio de diseño:** la app funciona 100% sin internet. `localStorage` es la
> fuente de verdad; el respaldo en la nube (Cloudflare Worker + D1) es **opcional**
> y solo sincroniza cuando hay señal.

---

## Características

- **Flujo de 3 pasos:** Datos → Materiales → Resumen, con validación por paso.
- **Folio automático** formato `ADQ-AAAA-NNNN` (folio custom soportado).
- **Firma en canvas** híbrida touch + mouse (optimizada para Samsung S25).
- **Impresión PDF** con membrete institucional FACH (fix Android: colores exactos y bordes garantizados).
- **Historial local** con reapertura del flujo completo de 3 pasos.
- **Respaldo en la nube (opcional):**
  - Tarjeta "Respaldo en la nube" en el Paso 1: URL del Worker + *Guardar y probar conexión*.
  - Indicador de sincronización en el header: 🟢 todo respaldado · 🟡 pendiente · ⚪ sin configurar/sin señal.
  - *Traer respaldo desde la nube*: restaura registros en otro dispositivo (pull).
- **Export / Import JSON** como respaldo manual adicional.

## Stack

- **Frontend:** single-file `index.html` (HTML5 + CSS + Vanilla JS, sin frameworks) + `manifest.json` + `sw.js` (cache-first) + icono PNG 512×512.
- **Respaldo opcional:** Cloudflare Worker (API REST) + D1 (SQLite serverless).
- **Almacenamiento local:** `localStorage` (fuente de verdad).

## API del Worker de respaldo (v1.1)

| Endpoint | Método | Función |
|---|---|---|
| `/health` | GET | Estado y versión del Worker |
| `/solicitudes` | POST | Upsert por `folio_id` (sync desde el dispositivo) |
| `/solicitudes` | GET | Pull completo (restaurar en otro dispositivo) |
| `/solicitudes/:folio_id` | DELETE | Eliminar respaldo de un registro |
| `/config` | GET | Configuración clave/valor |

**Seguridad (v1.2, jul-2026):** CORS restringido por **whitelist exacta de orígenes**
(coincidencia `===`, nunca `.includes()`), header `Access-Control-Allow-Origin`
dinámico + `Vary: Origin`, y parseo protegido por fila en el pull (una fila
corrupta no impide restaurar el resto). Todas las queries usan `prepare().bind()`.
**24-jul-2026:** repo de GitHub resincronizado con el Worker real en producción
(el `worker.js` versionado había quedado atrás, con CORS `*`, tras ediciones
hechas directo en el Dashboard de Cloudflare).

## Flujo de validación

Todo cambio pasa 3 etapas obligatorias:

1. **Mac** — desarrollo y prueba (Chrome/Safari + DevTools).
2. **GitHub / Cloudflare** — deploy (Pages auto-deploy; Worker vía Dashboard).
3. **Samsung S25** — prueba final en terreno (juez definitivo).

## Estado actual

- Worker **v1.1** desplegado y validado Mac + S25 el **06-jul-2026**
  (push, pull y sync verde verificados con la whitelist activa).

## Licencia / uso

Proyecto interno AGA · FACH. Uso institucional.
