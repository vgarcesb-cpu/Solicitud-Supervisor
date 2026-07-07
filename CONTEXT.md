# CONTEXT.md — Solicitud Adquisición Supervisor (PWA híbrida)

> Documento de contexto técnico para Claude / desarrolladores.
> Última actualización: **06-jul-2026** (Worker v1.1 validado Mac + S25).
> ⚠️ Repo PÚBLICO: no incluir IDs de D1, tokens ni configuración sensible.

---

## 1. Identidad del proyecto

| Campo | Valor |
|---|---|
| Nombre | Solicitud Adquisición Supervisor — AGA · FACH |
| Tipo | **PWA híbrida offline-first** (skill: `portales-totis-pwa`) |
| Frontend | `https://solicitud-supervisor.totis.cl` (Cloudflare Pages) |
| Worker respaldo | `https://supervisor-api.totis.cl` (custom domain, migrado de workers.dev jun-2026) |
| Base de datos | Cloudflare D1 (binding en Dashboard; **ID nunca en el repo — repo público**) |
| Versión actual | Worker **v1.1** · Frontend PWA estable |

## 2. Principio arquitectónico (NO negociable)

**localStorage es la FUENTE DE VERDAD. El Worker/D1 es respaldo opcional.**

- La app funciona 100% sin internet; el sync solo corre cuando hay señal y URL configurada.
- Ninguna función del flujo principal puede depender de la red.
- Un fallo del Worker NUNCA debe bloquear emisión, firma, impresión ni historial.
- Señal visible de estado: punto de 12px en el header — 🟢 todo respaldado · 🟡 pendiente de sync · ⚪ sin configurar/sin señal.

## 3. Estructura de archivos

`index.html` (single-file HTML5+CSS+Vanilla JS) + `manifest.json` + `sw.js` (cache-first) + icono PNG 512×512 + `README.md` + `CONTEXT.md`.

Aplican los **10 FIXES obligatorios** del estándar PWA totis.cl (guards IDB/almacenamiento, canvas desde `sig-wrap`, `setTimeout` 150ms, `drawImage` con dimensiones, try/catch en imports JSON, `nuevo()` limpia todo, validación por paso, resize listener S25) y los fixes de impresión Android (`-webkit-print-color-adjust: exact`, bordes negros, `setTimeout(print, 700)`, modal post-guardado).

## 4. Flujo funcional

- **3 pasos:** Datos → Materiales → Resumen, validación por paso (FIX-009).
- **Folio:** `ADQ-AAAA-NNNN` autogenerado; `folio_custom` soportado.
- **Firma:** canvas híbrido touch+mouse.
- **Historial:** reabre el flujo completo de 3 pasos (bug del modal simplificado corregido).
- **Respaldo:** tarjeta "Respaldo en la nube" en Paso 1 (URL Worker + Guardar y probar conexión + Traer respaldo desde la nube).

## 5. Contrato de datos con el Worker (v1.1)

Campos del registro: `folio_id` (clave de upsert — **obligatorio**), `folio_anio`, `folio_num`, `folio_custom`, `fecha`, `escuadrilla`, `cdte`, `observaciones`, `firma_nombre`, `firma_grado`, `firma_cargo`, `firma_img`, `items` (JSON), `total`, `es_historico`.

Endpoints:

| Endpoint | Método | Nota |
|---|---|---|
| `/health` | GET | ok/app/version/ts |
| `/solicitudes` | POST | Upsert `ON CONFLICT(folio_id)`; rechaza sin `folio_id` (400) |
| `/solicitudes` | GET | Pull completo ordenado por `actualizado_en` |
| `/solicitudes/:folio_id` | DELETE | `decodeURIComponent` en el id |
| `/config` | GET | clave/valor |

**Regla de consistencia:** cualquier cambio a este contrato exige revisar `index.html` (funciones de sync) ↔ `worker.js` ↔ schema D1, explícitamente.

## 6. Seguridad — estado actual

| Ítem | Estado | Detalle |
|---|---|---|
| CORS | ✅ **v1.1, 06-jul-2026** | Whitelist EXACTA (`===`, nunca `.includes()`): dominio propio + GitHub Pages de validación. ACAO dinámico + `Vary: Origin`. Eliminado `'*'` |
| Origin vacío | ⚠️ decisión consciente | Permitido (curl/health checks); mismo criterio que Portal-Adq. Mitigación planificada: WAF rate limiting |
| Robustez pull | ✅ v1.1 | FIX-007 por fila: `items_json` corrupto → esa fila restaura con `items: []`, el resto no se pierde |
| SQL | ✅ | 100% `prepare().bind()` |
| Errores | ✅ | try/catch global → 500 con JSON limpio |
| WAF rate limiting | ⬜ PENDIENTE | Regla estándar (20 req/10s) aún no activada para este subdominio |
| Preview Worker | ⬜ PENDIENTE | Auditar toggle Preview y desactivar si no se usa |

## 7. Historial de versiones del Worker

- **v1.0** — API base de respaldo (upsert/pull/delete/config).
- **v1.1 (06-jul-2026)** — CORS whitelist exacta + ACAO dinámico + `Vary: Origin` (elimina `'*'` y patrón `.includes()`); FIX-007 por fila en el pull. **Validado Mac (push + pull "5 nuevos" + punto verde) y Samsung S25 (flujo completo en terreno) el 06-jul-2026.**

## 8. Bugs históricos corregidos (no regresionar)

1. `guardarHistorial()` sin campo `id` → el Worker rechazaba el sync en silencio. El upsert exige `folio_id`.
2. El sync solo reintentaba en errores de RED; los errores de SERVIDOR (4xx/5xx) no reintentaban → corregido: ambos caminos marcan pendiente (punto 🟡) y reintentan.
3. Historial abría un modal simplificado en vez del flujo completo de 3 pasos → corregido.

## 9. Flujo de validación obligatorio

1. **Mac** — Chrome/Safari + DevTools (Network para CORS/headers; punto de sync).
2. **GitHub / Cloudflare** — Pages auto-deploy; Worker editado en Dashboard.
3. **Samsung S25** — juez definitivo. NUNCA declarar cerrado sin esta etapa.

## 10. Pendientes del proyecto

1. Activar WAF rate limiting para el subdominio.
2. Auditar/desactivar Preview toggle del Worker.
