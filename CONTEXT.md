# CONTEXT.md — Solicitud Supervisor (AGA FACH)

**🔗 URL de producción:** https://solicitud-supervisor.totis.cl/
**🔗 URL alterna (mismo despliegue):** https://vgarcesb-cpu.github.io/Solicitud-Supervisor/
**Repo:** `vgarcesb-cpu/Solicitud-Supervisor` (público, GitHub Pages)
**Worker:** `https://solicitud-supervisor-worker.vgarcesb.workers.dev`
**Stack:** PWA híbrida offline-first — `index.html` (localStorage = fuente de verdad) + `worker.js` (Cloudflare Worker) + D1 como **respaldo**, NUNCA fuente de verdad. Tiene `manifest.json` + `sw.js` (Service Worker, ojo con caché al depurar).
**Uso:** personal, un solo dispositivo activo a la vez (Mac o S25, no simultáneo).

---

## 1. Flujo principal — Nueva Solicitud (3 pasos)

1. **Paso 1 — Datos**: folio automático (correlativo por año, `ADQ-AAAA-NNNN`), fecha, escuadrilla, comandante, observaciones. Al final de este paso está la tarjeta **"Respaldo en la nube"** (ver sección 4).
2. **Paso 2 — Materiales**: ítems con cantidad, unidad (datalist con sugerencias), descripción, precio unitario. Calcula subtotal, IVA 19%, total en vivo.
3. **Paso 3 — Resumen**: muestra resumen de datos + ítems + totales. Sección de **Firma**: nombre, grado, cargo + canvas de firma a mano (mouse/touch). Botones:
   - **🖨️ Guardar / Imprimir PDF** → llena `#print-area` (oculto, solo visible en `@media print`) con el documento oficial FACH y llama `window.print()`.
   - **💾 Guardar en historial** → guarda en `localStorage` (`fach_historial`) e intenta sync a D1 vía `intentarSyncRegistro()`.
   - Botón inferior **"+ Nuevo"** (aparece solo en paso 3) limpia el formulario y avanza el folio.

## 2. Flujo Historial

- Acceso: botón **"📁 Historial"** en la barra de navegación inferior (visible en cualquier paso).
- Lista todos los registros guardados (`solicitudes` array), más recientes primero. Cada tarjeta muestra folio, badge `HISTÓRICO` si aplica, escuadrilla, cantidad de ítems, total, observaciones.
- **Editar**: carga el registro completo en el flujo normal de 3 pasos (Datos→Materiales→Resumen+Firma+Imprimir) — **igual para históricos y normales** desde el fix de 2026-06-24. Permite completar firma/nombre/grado/cargo si faltaban, modificar ítems, e imprimir.
- **Eliminar**: borra de `localStorage` y, si hay URL de Worker confirmada y hay señal, intenta `DELETE` en D1.
- **"+ Agregar Registro Antiguo"**: abre el modal pequeño (`modal-historico`) para ingresar rápidamente un folio histórico de papel (folio manual tipo `ADQ-2024-0012`, ítems, sin firma) — sigue existiendo como atajo de carga rápida; una vez guardado, también se puede reabrir/editar en el flujo completo igual que cualquier otro.
- **"🔄 Sincronizar próximo folio"**: recalcula el contador de folios según el máximo existente (normales + históricos) del año actual, para evitar duplicar números.

## 3. Flujo de Sincronización (sync híbrido)

- **Push (subir)**: automático. Al guardar cualquier registro, `intentarSyncRegistro()` intenta POST al Worker. Si falla (red **o** servidor — fix 2026-06-24), se marca pendiente en `localStorage` (`fach_sync_pendientes`) y se reintenta solo al recuperar conexión (`window.addEventListener('online', ...)`) o al recargar la app (2s después de `load`).
- **Pull (bajar)**: manual, vía botón **"⬇️ Traer respaldo desde la nube"**. Trae todos los registros de D1 y los fusiona con los locales por `id` (sin duplicar). Útil para recuperar datos creados en otro dispositivo.
- **Indicador visual**: punto de color de 12px junto a "N° Folio" en el header (todas las páginas/pasos):
  - 🟢 verde = URL configurada y todo respaldado (sin pendientes)
  - 🟡 dorado = hay registros pendientes de subir
  - ⚪ gris = sin URL de Worker configurada
  - Función `actualizarSyncDot()`, se ejecuta automáticamente desde `actualizarDisplayFolio()`.

## 4. Tarjeta "Respaldo en la nube" (ubicada al final del Paso 1)
- Campo URL del Worker + botón **"Guardar y probar conexión"** (hace `GET /health`, guarda en `localStorage` si responde OK).
- Estado de texto: "✓ Conectado — ..." o error.
- Botón **"⬇️ Traer respaldo desde la nube"** + estado "X nuevo(s), Y actualizado(s)".
- *(Reubicada aquí el 2026-06-24; antes vivía dentro del panel de Historial, se perdía de vista con facilidad.)*

---

## 5. Historial de cambios aplicados (2026-06-23/24)

1. **Fix sync — falta de `id`**: `guardarHistorial()` no asignaba `id` al registro → nunca sincronizaba a D1 (rechazo silencioso, error 400 del Worker por `folio_id` faltante). Se agregó `id: folioCompleto()` (y se preserva `id` original al editar: `rec.id = solicitudes[editIndex].id || rec.id;`).
2. **Fix reintento de pendientes**: `intentarSyncRegistro()` solo marcaba pendiente ante error de **red**; un error de **servidor** dejaba el registro perdido sin reintento futuro. Se agregó `else marcarPendienteSync(rec.id);` en el `.then()`.
3. **Históricos → flujo completo**: se eliminó el branch en `cargarHistorial()` que abría el modal pequeño para registros `esHistorico`. Ahora editan en el mismo flujo que los normales (con firma, ítems editables, e impresión via `imprimirPDF()`/`#print-area` ya existentes — no se duplicó lógica de impresión).
4. **UX — Respaldo en la nube reubicado**: tarjeta movida del Historial al final del Paso 1.
5. **Indicador visual de sync**: punto de color en el header (ver sección 3).

## 6. Migración manual de datos antiguos (ejecutada una vez, 2026-06-23)
Los registros creados **antes** del fix #1 quedaron sin `id` en el `localStorage` de cada dispositivo donde se crearon — un fix de código no repara datos ya guardados. Se reparó así (puede volver a necesitarse si aparece un caso similar):
```js
// 1. Reparar localStorage (agrega id a los que no lo tengan)
var s = JSON.parse(localStorage.getItem('fach_historial') || '[]');
s.forEach(function(r){ if (!r.id) r.id = r.folioCustom || ('ADQ-'+r.folioAnio+'-'+r.folioNum); });
localStorage.setItem('fach_historial', JSON.stringify(s));

// 2. Forzar reenvío manual de un registro puntual ya rechazado antes
var rec = s.find(function(r){ return r.id === 'ADQ-AAAA-NNNN'; }); // ajustar folio
fetch('https://solicitud-supervisor-worker.vgarcesb.workers.dev/solicitudes', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ folio_id: rec.id, folio_anio: rec.folioAnio, folio_num: rec.folioNum,
    folio_custom: rec.folioCustom||null, fecha: rec.fecha, escuadrilla: rec.escuadrilla, cdte: rec.cdte,
    observaciones: rec.observaciones, firma_nombre: rec.firmaNombre, firma_grado: rec.firmaGrado,
    firma_cargo: rec.firmaCargo, firma_img: rec.firmaImg, items: rec.items, total: rec.total,
    es_historico: !!rec.esHistorico })
}).then(r=>r.json()).then(console.log);
```

## 7. Lecciones aprendidas (ya en skill `portales-totis-maestro`)
- Un fix de código no repara datos ya guardados en `localStorage` de sesiones previas — requiere migración manual puntual.
- Marcar pendiente de sync debe cubrir errores de red **y** de servidor, no solo uno de los dos.
- Antes de sospechar de caché del Service Worker, confirmar primero si el dato realmente llegó al origen (D1) — "no veo el cambio" puede ser dato faltante, no caché.

## 8. Pendiente / ideas futuras (no urgente)
- Auto-pull silencioso al cargar la app — evaluado y **descartado por ahora**: uso es de un solo dispositivo a la vez, los indicadores visuales ya cubren la necesidad.
- Si en el futuro se usa en más de un dispositivo simultáneamente, reconsiderar pull automático y posible manejo de conflictos (actualmente "last write wins" sin merge inteligente).
