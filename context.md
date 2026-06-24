# CONTEXT.md — Solicitud Supervisor (AGA FACH)

**Repo:** `vgarcesb-cpu/Solicitud-Supervisor` (público, GitHub Pages)
**Dominios:** `vgarcesb-cpu.github.io/Solicitud-Supervisor/` y `solicitud-supervisor.totis.cl` (mismo despliegue)
**Stack:** PWA híbrida offline-first — `index.html` (localStorage) + `worker.js` (Cloudflare Worker) + D1 como respaldo, NUNCA fuente de verdad. Tiene `manifest.json` + `sw.js` (Service Worker).

---

## Cambios aplicados (2026-06-23/24)

1. **Fix sync — falta de `id`**: `guardarHistorial()` no asignaba `id` al registro → nunca sincronizaba a D1, fallaba silenciosamente (error 400 del Worker). Se agregó `id: folioCompleto()`.
2. **Fix reintento de pendientes**: `intentarSyncRegistro()` solo marcaba pendiente ante error de **red**; un error de **servidor** (400/500) dejaba el registro perdido sin reintento. Se agregó `else marcarPendienteSync(rec.id);` en el `.then()`.
3. **Históricos → flujo completo**: se eliminó el branch en `cargarHistorial()` que abría el modal pequeño para registros `esHistorico`. Ahora **todos** los folios (históricos y normales) se editan en el mismo flujo de 3 pasos (Datos→Materiales→Resumen+Firma+Imprimir), reutilizando `imprimirPDF()` y `#print-area` ya existentes.
4. **UX — Respaldo en la nube reubicado**: la tarjeta completa de configuración de sync se movió del panel de Historial al final del **Paso 1 (Datos)**, para reducir el olvido de revisarla.
5. **Indicador visual de sync**: punto de color de 12px junto a "N° Folio" en el header. 🟢 verde = todo respaldado, 🟡 dorado = pendientes, ⚪ gris = sin URL configurada. Función `actualizarSyncDot()`, llamada desde `actualizarDisplayFolio()` (que ya se ejecuta en todos los puntos clave del flujo).

## Migración manual necesaria una vez (ya ejecutada)
Registros creados **antes** del fix #1 quedaron sin `id` en `localStorage` de cada dispositivo — un fix de código no repara datos viejos. Se reparó vía consola del navegador iterando `fach_historial` y asignando `id` a los registros que no lo tenían, luego forzando el POST manual al Worker para el caso que ya había sido rechazado una vez (no quedaba marcado pendiente por el bug #2).

## Pendiente / próxima sesión
- Nada crítico pendiente. Posible mejora futura: auto-pull silencioso al cargar (evaluado y descartado por ahora — uso es de un solo dispositivo a la vez, indicadores visuales son suficientes).
