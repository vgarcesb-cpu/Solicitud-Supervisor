# Solicitud Adquisición Supervisor
### PWA institucional — Academia de Guerra Aérea, FACH
> **Versión:** 1.0.0 · **Autor:** Víctor Manuel Garcés Borje (Toti's®) · **Entidad:** AGA — Fuerza Aérea de Chile

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Arquitectura y stack](#2-arquitectura-y-stack)
3. [Estructura del archivo](#3-estructura-del-archivo)
4. [Variables globales de estado](#4-variables-globales-de-estado)
5. [Módulo de persistencia](#5-módulo-de-persistencia)
6. [Flujo wizard paso a paso](#6-flujo-wizard-paso-a-paso)
7. [Módulo de ítems](#7-módulo-de-ítems)
8. [Módulo de firma canvas](#8-módulo-de-firma-canvas)
9. [Módulo PDF / impresión](#9-módulo-pdf--impresión)
10. [Módulo historial](#10-módulo-historial)
11. [Sistema de folios](#11-sistema-de-folios)
12. [Referencia de funciones](#12-referencia-de-funciones)
13. [Paleta CSS y variables](#13-paleta-css-y-variables)
14. [Bugs documentados y estado de corrección](#14-bugs-documentados-y-estado-de-corrección)
15. [Flujo de desarrollo y despliegue](#15-flujo-de-desarrollo-y-despliegue)
16. [Limitaciones conocidas y mejoras futuras](#16-limitaciones-conocidas-y-mejoras-futuras)

---

## 1. Descripción general

**Solicitud Adquisición Supervisor** es una Progressive Web App (PWA) de archivo único (`index.html`) diseñada para generar, firmar, imprimir y archivar solicitudes formales de adquisición de materiales para escuadrillas de la Academia de Guerra Aérea (AGA).

### Propósito del documento generado

El formulario produce una **Solicitud de Adquisición de Materiales** con:

- Folio correlativo en formato `ADQ-{AÑO}-{NNNN}` (ej. `ADQ-2026-0003`)
- Fecha, escuadrilla solicitante y Cdte. de Escuadrilla
- Lista de materiales con cantidades, unidades, descripción y precios unitarios
- Subtotal neto, IVA 19 % y TOTAL con formato CLP (`$ X.XXX`)
- Firma a mano (canvas digital) con nombre, grado y cargo del firmante
- Impresión PDF lista para trámite o archivo físico

### Características principales

- **100 % offline** una vez cargada: sin dependencias de red durante el uso
- **PWA instalable** en Android/iPhone con icono en pantalla de inicio
- **Historial persistente** en `localStorage` con carga, edición y eliminación de solicitudes anteriores
- **Firma digital canvas** con soporte táctil y mouse, capturada y recuperable desde el historial
- **Sin framework**: HTML5 + CSS variables + JavaScript ES5 puro

---

## 2. Arquitectura y stack

```
┌─────────────────────────────────────────────────────┐
│               index.html  (archivo único)           │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐│
│  │  <style> │  │  <body>  │  │     <script>       ││
│  │ CSS vars │  │ 4 paneles│  │  lógica completa   ││
│  │ @print   │  │ nav-bar  │  │  28 funciones      ││
│  └──────────┘  └──────────┘  └────────────────────┘│
└─────────────────────────────────────────────────────┘
          │                        │
          ▼                        ▼
   localStorage               window.print()
   fach_folio (int)           @media print
   fach_historial (JSON)      #print-area DOM
```

| Capa | Tecnología | Detalle |
|---|---|---|
| Lenguaje | HTML5 + CSS3 + JavaScript ES5 | Sin transpiladores ni bundlers |
| Persistencia | `localStorage` | Dos claves: `fach_folio` y `fach_historial` |
| Firma | Canvas API | Touch + Mouse, DataURL base64 |
| PDF | `@media print` + `window.print()` | `#print-area` oculto en pantalla, visible al imprimir |
| PWA | `manifest.json` + `sw.js` (externos) | Service worker cache-first |
| Hosting | GitHub Pages | `vgarcesb-cpu.github.io/solicitud-adquisicion/` |
| Protección | Cloudflare (proxy + Zero Trust) | Capa DNS sobre GitHub Pages |

---

## 3. Estructura del archivo

```
index.html
│
├── <head>
│   ├── <meta> viewport, charset, theme-color
│   ├── <link> manifest.json, apple-touch-icon
│   └── <style>
│       ├── :root { variables CSS }
│       ├── Reset y layout base (.app, .app-header)
│       ├── .steps-bar (indicador de pasos 1-2-3)
│       ├── #panel-1, #panel-2, #panel-3, #panel-hist
│       ├── .item-card, .sig-wrap, #sig-canvas
│       ├── #nav-bar (botones Atrás / Historial / Reset / Siguiente)
│       ├── .toast (notificación flotante)
│       └── @media print { oculta todo, muestra #print-area }
│
└── <body>
    ├── .app
    │   ├── .app-header
    │   │   ├── img.logo-aga  (icono base64 inline)
    │   │   ├── h1 "Solicitud de Adquisición"
    │   │   └── .folio-badge  (folio próximo, ej. ADQ-2026-0001)
    │   │
    │   ├── .steps-bar
    │   │   ├── .step[data-step="1"] "Datos"
    │   │   ├── .step[data-step="2"] "Materiales"
    │   │   └── .step[data-step="3"] "Firma"
    │   │
    │   ├── .steps-content
    │   │   ├── #panel-1  ← Paso 1: Datos generales
    │   │   ├── #panel-2  ← Paso 2: Lista de materiales
    │   │   ├── #panel-3  ← Paso 3: Resumen + firma canvas
    │   │   └── #panel-hist ← Vista historial (reemplaza pasos)
    │   │
    │   └── #nav-bar
    │       ├── #btn-back    "← Atrás"
    │       ├── #btn-hist    "Historial"
    │       ├── #btn-reset   "Nuevo"
    │       └── #btn-next    "Siguiente →" / "Guardar"
    │
    ├── .toast#toast
    │
    ├── #print-area  ← DOM oculto, se puebla en imprimirPDF()
    │   ├── encabezado institucional AGA
    │   ├── tabla de datos (folio, fecha, escuadrilla, cdte.)
    │   ├── tabla de ítems (cant, und, desc, precio unit., subtotal)
    │   ├── fila totales (neto, IVA 19%, TOTAL)
    │   └── sección firma (imagen canvas + nombre/grado/cargo)
    │
    └── <script>
        └── (ver sección 12 — Referencia de funciones)
```

---

## 4. Variables globales de estado

Todas las variables se declaran con `var` en el ámbito global del `<script>`.

| Variable | Tipo | Valor inicial | Propósito |
|---|---|---|---|
| `pasoActual` | `Number` | `1` | Paso del wizard activo (1, 2 o 3) |
| `items` | `Array` | `[]` | Ítems en edición durante la sesión actual |
| `editIndex` | `Number` | `-1` | `-1` = nueva solicitud; `≥ 0` = índice en `solicitudes[]` que se está editando |
| `solicitudes` | `Array` | `[]` | Espejo en memoria del `localStorage` `fach_historial` |
| `sigDataURL` | `String` | `''` | DataURL base64 de la firma capturada en la sesión actual |
| `sigURL` | `String` | `''` | ⚠️ **Variable huérfana** — nunca se lee; debe eliminarse en la próxima refactorización |

### Diagrama de ciclo de vida de estado

```
init()
  │
  ├── getFolio()  →  pasoActual = 1
  ├── loadLS()    →  solicitudes[]  (espejo del localStorage)
  └── mostrarFolio()

        ↓  Usuario navega pasos

irPaso(n)
  │
  ├── Si saliendo paso 3 → capturarFirma()  →  sigDataURL guardada
  ├── Si entrando paso 3 → restaurarFirma() →  sigDataURL pintada en canvas
  └── actualizarResumen()  (solo al entrar paso 3)

        ↓  Usuario confirma

guardarHistorial()
  │
  ├── Construye objeto rec { folio, datos, items, total, sigDataURL }
  ├── solicitudes.push(rec)
  ├── saveLS()
  ├── setFolio(n+1)
  └── irPaso(1)  (retorna al inicio, NO limpia campos)

        ↓  Usuario presiona "Nuevo"

nuevo()  →  limpiarCampos()  +  limpiarFirma()  +  irPaso(1)
```

---

## 5. Módulo de persistencia

### Claves en `localStorage`

| Clave | Tipo serializado | Descripción |
|---|---|---|
| `fach_folio` | `String` (int) | Último número de folio **utilizado** |
| `fach_historial` | `String` (JSON array) | Array de objetos solicitud |

### Funciones de persistencia

```javascript
// Lee fach_folio y retorna entero (0 si no existe)
function getFolio() { return parseInt(localStorage.getItem('fach_folio') || '0'); }

// Escribe un nuevo valor de folio
function setFolio(n) { localStorage.setItem('fach_folio', String(n)); }

// Serializa solicitudes[] al localStorage — punto único de escritura
function saveLS() {
  try {
    localStorage.setItem('fach_historial', JSON.stringify(solicitudes));
  } catch(e) {
    alert('Error al guardar en almacenamiento local: ' + e.message);
  }
}

// Carga historial al iniciar la app
function loadLS() {
  try {
    var raw = localStorage.getItem('fach_historial');
    solicitudes = raw ? JSON.parse(raw) : [];
  } catch(e) {
    solicitudes = [];
  }
}
```

### Flujo de reset del contador

```
resetContador()
  │
  ├── setFolio(0)           ← localStorage fach_folio = "0"
  └── mostrarFolio()        ← #folio-num muestra "0001"
```

---

## 6. Flujo wizard paso a paso

### Vista general

```
┌──────────────────────────────────────────────────────────────────┐
│  PASO 1                  PASO 2                  PASO 3          │
│  Datos generales         Materiales              Firma y resumen  │
│                                                                   │
│  • Folio (readonly)      • Agregar ítems         • Resumen datos  │
│  • Año (editable)        • Cant / Und / Desc     • Resumen ítems  │
│  • Fecha                 • Precio unitario        • Canvas firma   │
│  • Escuadrilla (select)  • Totales en tiempo     • Nombre/Grado   │
│  • Cdte. Escuadrilla       real                  • Cargo          │
│  • Observaciones         • Eliminar ítem         • Imprimir PDF   │
│                                                  • Guardar        │
└──────────────────────────────────────────────────────────────────┘
         │  "Siguiente"              │  "Siguiente"
         ▼                          ▼
     irPaso(2)                  irPaso(3)
                                     │
                             capturarFirma()
                             actualizarResumen()
                             initCanvas()
```

### Paso 1 — Datos generales

Campos del formulario:

| ID | Tipo | Descripción | Validación |
|---|---|---|---|
| `#folio-anio` | `input[number]` | Año del folio (editable) | requerido |
| `#folio-num` | `input[text]` readonly | Número correlativo (ej. `0003`) | readonly, auto |
| `#fecha` | `input[date]` | Fecha de la solicitud | requerido |
| `#escuadrilla` | `select` | Bandada Instalaciones / Alimentación / Transporte | requerido |
| `#cdte` | `input[text]` | Nombre del Cdte. Escuadrilla | requerido |
| `#observaciones` | `textarea` | Observaciones adicionales | opcional |

Evento "Siguiente": `irPaso(2)` — valida campos obligatorios antes de avanzar.

### Paso 2 — Materiales

La lista de ítems se gestiona dinámicamente. Cada ítem contiene:

| Campo | Tipo | Unidades disponibles |
|---|---|---|
| `cant` | `Number` | — |
| `und` | `String` | UN / KG / MT / LT / CJ / PAQ / GL |
| `desc` | `String` | Descripción libre |
| `precioUnitario` | `Number` | CLP (sin formato) |

Los totales se recalculan en cada modificación:

```
subtotalNeto = Σ (cant[i] × precioUnitario[i])
IVA          = subtotalNeto × 0.19
TOTAL        = subtotalNeto + IVA
```

Evento "Siguiente": `irPaso(3)` — requiere al menos 1 ítem.

### Paso 3 — Firma y resumen

Al entrar al paso 3 ocurre la siguiente secuencia:

```
irPaso(3)
  │
  ├── actualizarResumen()
  │     ├── Puebla #resumen-datos con folio, fecha, escuadrilla, cdte.
  │     └── Puebla #resumen-items con tabla de ítems + totales
  │
  ├── restaurarFirma()
  │     └── Si sigDataURL ≠ '' → pinta canvas con la firma de sesión
  │
  └── setTimeout(initCanvas, 150)   ← FIX-005 obligatorio
        └── initCanvas()
              ├── ajustarCanvas()   ← mide desde .sig-wrap (padre)
              ├── Registra eventos touch (touchstart/move/end)
              └── Registra eventos mouse (mousedown/move/up)
```

Botones disponibles en paso 3:

| Botón | Función | Efecto |
|---|---|---|
| "Imprimir PDF" | `imprimirPDF()` | Puebla `#print-area` y llama `window.print()` tras 700 ms |
| "Limpiar firma" | `limpiarFirma()` | Limpia canvas y resetea `sigDataURL` |
| "Guardar" (nav) | `guardarHistorial()` | Persiste en `localStorage` e incrementa folio |

---

## 7. Módulo de ítems

### Ciclo de vida de un ítem

```
agregarItem()
  │
  ├── Lee campos #cant, #und, #desc, #precio-unit del formulario de ítem
  ├── Valida que cant > 0 y desc no esté vacía
  ├── items.push({ cant, und, desc, precioUnitario })
  ├── renderItems()    ← redibuja la lista
  └── calcTotals()     ← actualiza subtotal, IVA, total en pantalla

eliminarItem(i)
  │
  ├── items.splice(i, 1)
  ├── renderItems()
  └── calcTotals()
```

### Función `renderItems()`

Genera HTML dinámico por cada elemento en `items[]`. Cada tarjeta muestra:

```
┌─────────────────────────────────────────────────┐
│  [3 UN]  Cable eléctrico 2.5mm        $ 4.500   │
│                                    [✕ Eliminar] │
└─────────────────────────────────────────────────┘
```

### Función `calcTotals()`

```javascript
function calcTotals() {
  var neto = items.reduce(function(sum, it) {
    return sum + (it.cant * it.precioUnitario);
  }, 0);
  var iva   = neto * 0.19;
  var total = neto + iva;
  document.getElementById('subtotal-neto').textContent = fmtN(neto);
  document.getElementById('iva-monto').textContent     = fmtN(iva);
  document.getElementById('total-monto').textContent   = fmtN(total);
}
```

---

## 8. Módulo de firma canvas

### Arquitectura del canvas

```html
<div class="sig-wrap" id="sig-wrap">        ← contenedor padre (referencia de medición)
  <canvas id="sig-canvas"></canvas>         ← superficie de dibujo
</div>
```

### Inicialización correcta (incluye FIX-004 y FIX-005)

```javascript
var canvasIniciado = false;    // guard para evitar listeners duplicados

function initCanvas() {
  var canvas = document.getElementById('sig-canvas');
  if (!canvas) return;

  // FIX-004: eliminar listeners anteriores antes de añadir nuevos
  if (canvasIniciado) {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove',  onTouchMove);
    canvas.removeEventListener('touchend',   onTouchEnd);
    canvas.removeEventListener('mousedown',  onMouseDown);
    canvas.removeEventListener('mousemove',  onMouseMove);
    canvas.removeEventListener('mouseup',    onMouseUp);
  }

  ajustarCanvas();   // mide desde .sig-wrap

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   onTouchEnd);
  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);

  canvasIniciado = true;
}

// FIX-005: siempre con setTimeout de 150ms mínimo
function irPaso(n) {
  // ...
  if (n === 3) {
    setTimeout(initCanvas, 150);
  }
}
```

### Función `ajustarCanvas()`

```javascript
function ajustarCanvas() {
  var wrap   = document.getElementById('sig-wrap');   // mide el PADRE
  var canvas = document.getElementById('sig-canvas');
  if (!wrap || !canvas) return;
  canvas.width  = wrap.offsetWidth;    // dimensiones reales del contenedor
  canvas.height = wrap.offsetHeight;
}
```

### Captura y restauración de firma

```javascript
// Al salir del paso 3 (hacia paso 2 o al guardar)
function capturarFirma() {
  var canvas = document.getElementById('sig-canvas');
  if (canvas) sigDataURL = canvas.toDataURL('image/png');
}

// Al volver al paso 3
function restaurarFirma() {
  if (!sigDataURL) return;
  var canvas = document.getElementById('sig-canvas');
  var ctx    = canvas.getContext('2d');
  var img    = new Image();
  img.onload = function() {
    // FIX-006 (canvas): dimensiones explícitas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = sigDataURL;
}

// Limpiar firma — FIX-001: limpia sigDataURL (no sigURL)
function limpiarFirma() {
  var canvas = document.getElementById('sig-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  sigDataURL = '';    // ← correcto
}
```

### Listener de rotación de pantalla (FIX-010)

```javascript
window.addEventListener('resize', function() {
  if (pasoActual === 3) {
    ajustarCanvas();
    restaurarFirma();
  }
});
```

---

## 9. Módulo PDF / impresión

### Flujo completo de `imprimirPDF()`

```
imprimirPDF()
  │
  ├── Construye HTML del documento en #print-area
  │   ├── Encabezado AGA (logo + título institucional)
  │   ├── Tabla datos (folio, fecha, escuadrilla, cdte.)
  │   ├── Tabla ítems (cant, und, descripción, precio unit., subtotal)
  │   ├── Fila totales (neto, IVA 19%, TOTAL)
  │   └── Sección firma (<img src=sigDataURL> + nombre/grado/cargo)
  │
  └── setTimeout(function() { window.print(); }, 700)
      ← mínimo 700ms (BUG-5 tenía 200ms — insuficiente en S25)
```

### Reglas obligatorias de impresión (AGA)

```css
/* Elementos con fondo de color */
background-color: #003087 !important;
-webkit-print-color-adjust: exact !important;
border: 2px solid #000 !important;

/* Tamaño de página */
@page {
  size: letter portrait;
  margin: 15mm 20mm 15mm 20mm;
}

/* Durante impresión */
@media print {
  body > * { display: none !important; }
  #print-area { display: block !important; }
}
```

### Por qué 700 ms y no menos

El Samsung S25 (juez definitivo del stack AGA) aplica una transición visual al activar el modo impresión. Si `window.print()` se llama antes de que la transición termine, el diálogo de impresión se abre con el documento en blanco o parcialmente renderizado. Los 700 ms garantizan que el DOM de `#print-area` esté completamente pintado antes de que el navegador capture la vista.

---

## 10. Módulo historial

### Modelo de datos — objeto solicitud

```javascript
{
  folioAnio:       Number,   // ej. 2026
  folioNum:        String,   // ej. "0003"
  fecha:           String,   // "YYYY-MM-DD"
  escuadrilla:     String,   // "Bandada Instalaciones"
  cdte:            String,   // "Cap. Juan Pérez"
  observaciones:   String,
  firmaNombre:     String,
  firmaGrado:      String,
  firmaCargo:      String,
  items:           Array,    // copia profunda de items[]
  total:           Number,   // con IVA incluido
  sigDataURL:      String    // DataURL de la firma PNG base64
  // ← BUG-6: este campo faltaba antes de la corrección
}
```

### Funciones del historial

```
verHistorial()
  │
  ├── Oculta paneles 1-2-3 y nav-bar (.oculta { display: none })
  │   (BUG-3: faltaba esta clase en el CSS original)
  ├── Muestra #panel-hist
  └── renderHistorial()
        └── Por cada solicitud en solicitudes[]:
              Genera tarjeta con folio, fecha, escuadrilla, total
              Botones: [Cargar] [Eliminar]

cargarHistorial(i)
  │
  ├── editIndex = i
  ├── Puebla todos los campos del paso 1 desde solicitudes[i]
  ├── items = JSON.parse(JSON.stringify(solicitudes[i].items))
  ├── sigDataURL = solicitudes[i].sigDataURL || ''
  ├── Oculta #panel-hist, muestra nav-bar
  └── irPaso(1)

eliminarHistorial(i)
  │
  ├── solicitudes.splice(i, 1)
  ├── saveLS()
  └── renderHistorial()
```

### Flujo de edición de una solicitud existente

```
cargarHistorial(i)                editIndex = i
       │
       ▼
  irPaso(1) → usuario modifica → irPaso(2) → irPaso(3) → guardarHistorial()
                                                                │
                                                   Si editIndex ≥ 0:
                                                   solicitudes[editIndex] = rec  (sobreescribe)
                                                   Si editIndex = -1:
                                                   solicitudes.push(rec)         (nueva)
```

---

## 11. Sistema de folios

### Lógica completa

```
Estado inicial (primera ejecución):
  localStorage "fach_folio" → no existe
  getFolio() → 0
  mostrarFolio() → muestra "ADQ-2026-0001" (próximo)

Al guardar solicitud:
  folioUsado = getFolio() + 1
  rec.folioNum = folioStr(folioUsado)     → "0001"
  setFolio(folioUsado)                    → localStorage = "1"
  mostrarFolio()                          → muestra "ADQ-2026-0002" (próximo)

Al hacer reset del contador:
  setFolio(0)
  mostrarFolio()                          → muestra "ADQ-2026-0001"

Función folioStr(n):
  return String(n).padStart(4, '0')       → "0001", "0015", "0123"
```

### Formato del folio

```
ADQ - 2026 - 0003
│     │      │
│     │      └── Número correlativo (4 dígitos, con ceros a la izquierda)
│     └────────── Año (editable en el campo #folio-anio)
└──────────────── Prefijo fijo "ADQ"
```

---

## 12. Referencia de funciones

### Inicialización

| Función | Descripción |
|---|---|
| `init()` | Punto de entrada: carga localStorage, muestra folio próximo, va al paso 1 |
| `loadLS()` | Lee `fach_historial` de localStorage a `solicitudes[]` |
| `mostrarFolio()` | Actualiza `.folio-badge` y `#folio-num` con el próximo folio |

### Navegación wizard

| Función | Descripción |
|---|---|
| `irPaso(n)` | Muestra el panel n, actualiza `.steps-bar`, gestiona firma al entrar/salir paso 3 |
| `actualizarResumen()` | Puebla el resumen de datos e ítems en el paso 3 |
| `validarPaso(n)` | Valida campos obligatorios del paso n antes de avanzar |

### Persistencia y folios

| Función | Descripción |
|---|---|
| `getFolio()` | Lee `fach_folio` del localStorage como entero |
| `setFolio(n)` | Escribe `n` en `fach_folio` |
| `saveLS()` | Serializa `solicitudes[]` a `fach_historial` — punto único de escritura |
| `resetContador()` | Resetea folio a 0 y actualiza pantalla |
| `folioStr(n)` | Formatea entero a string de 4 dígitos con ceros: `3` → `"0003"` |

### Ítems

| Función | Descripción |
|---|---|
| `agregarItem()` | Valida, empuja a `items[]`, re-renderiza y recalcula |
| `eliminarItem(i)` | Elimina ítem en índice i, re-renderiza y recalcula |
| `renderItems()` | Genera HTML de la lista de ítems en `#items-list` |
| `calcSub(it)` | Retorna `cant × precioUnitario` de un ítem |
| `calcTotals()` | Actualiza subtotal, IVA y total en pantalla |

### Firma canvas

| Función | Descripción |
|---|---|
| `initCanvas()` | Registra eventos touch+mouse en el canvas (con limpieza de listeners anterior) |
| `ajustarCanvas()` | Dimensiona el canvas al tamaño real de `.sig-wrap` |
| `capturarFirma()` | Captura el canvas a `sigDataURL` |
| `restaurarFirma()` | Pinta `sigDataURL` en el canvas con dimensiones explícitas |
| `limpiarFirma()` | Limpia el canvas y resetea `sigDataURL` a `''` |

### Historial

| Función | Descripción |
|---|---|
| `guardarHistorial()` | Construye objeto solicitud, lo persiste y avanza al paso 1 |
| `verHistorial()` | Muestra `#panel-hist`, oculta wizard y nav-bar |
| `renderHistorial()` | Genera tarjetas HTML de cada solicitud en `solicitudes[]` |
| `cargarHistorial(i)` | Carga solicitud i en el formulario para edición |
| `eliminarHistorial(i)` | Elimina solicitud i de `solicitudes[]` y guarda |
| `volverDesdeHistorial()` | Oculta `#panel-hist`, restaura wizard y nav-bar |

### PDF e impresión

| Función | Descripción |
|---|---|
| `imprimirPDF()` | Puebla `#print-area` y llama `window.print()` tras 700 ms |

### Utilidades de formato

| Función | Retorno | Ejemplo |
|---|---|---|
| `fmtN(n)` | String CLP o `'—'` | `fmtN(15000)` → `'$ 15.000'` |
| `fmtFecha(str)` | Fecha en español | `fmtFecha('2026-04-08')` → `'8 de abril de 2026'` |
| `folioStr(n)` | Número 4 dígitos | `folioStr(3)` → `'0003'` |

### UI helpers

| Función | Descripción |
|---|---|
| `toast(msg)` | Muestra notificación flotante por 2.5 s |
| `nuevo()` | Limpia todos los campos, resetea firma, va al paso 1 |
| `limpiarCampos()` | Vacía todos los inputs del wizard (FIX-008) |

---

## 13. Paleta CSS y variables

```css
:root {
  --azul:    #003087;            /* Azul institucional FACH */
  --dorado:  #C8A45A;            /* Dorado AGA */
  --verde:   #1a7a3c;            /* Confirmación / éxito */
  --rojo:    #c0392b;            /* Error / alerta */
  --gris:    #f5f5f5;            /* Fondos de panel */
  --texto:   #1a1a2e;            /* Texto principal */
  --borde:   #d0d0d0;            /* Bordes de inputs y cards */
  --sombra:  rgba(0,48,135,0.08);/* Sombras suaves */
}
```

### Escuadrillas disponibles

| Valor | Etiqueta visible |
|---|---|
| `instalaciones` | Bandada Instalaciones |
| `alimentacion` | Bandada Alimentación |
| `transporte` | Bandada Transporte |

---

## 14. Bugs documentados y estado de corrección

### BUG-1 — `limpiarFirma()` limpia variable inerte

- **Severidad:** 🔴 Funcional
- **Síntoma:** La firma "borrada" reaparece al navegar fuera del paso 3 y volver. La función limpiaba `sigURL` (variable huérfana que nada lee) en lugar de `sigDataURL`.
- **Línea afectada:** `sigURL = '';`
- **Fix:** `sigDataURL = '';`
- **Estado:** ✅ Corregido

---

### BUG-2 — `guardarHistorial()` usa try/catch inline en lugar de `saveLS()`

- **Severidad:** 🟡 Deuda técnica
- **Síntoma:** Inconsistencia de manejo de errores: `guardarHistorial()` tenía su propio try/catch mientras `eliminarHistorial()` usaba `saveLS()`. Si `saveLS()` cambia, `guardarHistorial()` quedaba desactualizado silenciosamente.
- **Fix:** Reemplazar el bloque try/catch duplicado por una llamada directa a `saveLS()`.
- **Estado:** ✅ Corregido

---

### BUG-3 — `classList.add('oculta')` sin clase CSS definida

- **Severidad:** 🔴 Funcional
- **Síntoma:** Al entrar al historial, `#nav-bar` permanece visible porque la clase `.oculta` no existía en el `<style>`. El usuario podía pulsar "Siguiente" mientras estaba en la vista historial, rompiendo el estado del wizard.
- **Fix aplicado:** Se añadió al CSS: `.oculta { display: none !important; }`
- **Estado:** ✅ Corregido

---

### BUG-4 — `initCanvas()` acumula event listeners en cada visita

- **Severidad:** 🔴 Funcional
- **Síntoma:** Cada vez que el usuario navegaba paso 2 → paso 3, se añadía un nuevo set de listeners al canvas sin eliminar los anteriores. Después de dos viajes, el trazo se dibujaba doble; después de tres, triple.
- **Fix:** Introducir el guard `canvasIniciado` y llamar `removeEventListener` por cada evento antes de volver a añadirlo.
- **Estado:** ✅ Corregido

---

### BUG-5 — `setTimeout(print, 200)` insuficiente para Samsung S25

- **Severidad:** 🟠 Incumple requisito de arquitectura AGA
- **Síntoma:** En el S25, el diálogo de impresión se abría antes de que `#print-area` estuviera completamente pintado, resultando en documento en blanco o parcialmente renderizado.
- **Fix:** Cambiar `200` por `700` (mínimo definido por el stack AGA).
- **Estado:** ✅ Corregido

---

### BUG-6 — `sigDataURL` no se persiste en el historial

- **Severidad:** 🔴 Funcional
- **Síntoma:** Al cargar una solicitud del historial, la sección de firma aparecía vacía porque `sigDataURL` nunca se incluía en el objeto `rec` al guardar.
- **Fix guardar:** Añadir `sigDataURL: sigDataURL` al objeto `rec` en `guardarHistorial()`.
- **Fix cargar:** En `cargarHistorial(i)`: `sigDataURL = solicitudes[i].sigDataURL || '';`
- **Estado:** ✅ Corregido

---

### BUG-7 — `fmtN(n)` muestra `'—'` cuando el total es exactamente $0

- **Severidad:** 🟡 Deuda técnica
- **Síntoma:** Si todos los ítems tienen precio unitario $0 (caso válido en solicitudes sin valorizar), el total es `0` y se mostraba `—` en lugar de `$ 0`.
- **Fix:** Cambiar condición `n > 0` por `n !== null && n !== undefined`.
- **Estado:** ✅ Corregido

---

### Tabla resumen

| # | Bug | Tipo | Estado |
|---|---|---|---|
| 1 | `limpiarFirma`: limpia `sigURL` en vez de `sigDataURL` | 🔴 Funcional | ✅ Corregido |
| 2 | `guardarHistorial`: try/catch duplicado de `saveLS()` | 🟡 Deuda | ✅ Corregido |
| 3 | `classList.add('oculta')` — clase no existe en CSS | 🔴 Funcional | ✅ Corregido |
| 4 | `initCanvas` acumula listeners en cada visita al paso 3 | 🔴 Funcional | ✅ Corregido |
| 5 | `setTimeout(print, 200)` — requisito mínimo es 700ms | 🟠 Requisito | ✅ Corregido |
| 6 | `sigDataURL` no se guarda en el objeto historial | 🔴 Funcional | ✅ Corregido |
| 7 | `fmtN`: `n > 0` muestra `'—'` para total $0 exacto | 🟡 Deuda | ✅ Corregido |

---

## 15. Flujo de desarrollo y despliegue

### Etapas obligatorias (stack AGA) — NUNCA omitir ninguna

```
ETAPA 1 — DESARROLLAR en Mac
  ├── Editar index.html con VS Code / cualquier editor de texto
  ├── Probar en Chrome: DevTools → toggle device → Samsung Galaxy S
  └── Probar en Safari: comportamiento WebKit (diferente a Chrome)

ETAPA 2 — SUBIR a GitHub Pages
  ├── git checkout -b fix/descripcion-del-cambio
  ├── git add index.html
  ├── git commit -m "fix: descripción clara"
  ├── git push origin fix/descripcion-del-cambio
  └── Esperar ~30s → verificar en:
      https://vgarcesb-cpu.github.io/solicitud-adquisicion/

ETAPA 3 — VALIDAR en Samsung S25 (juez definitivo)
  ├── Abrir Chrome o Samsung Internet en el S25
  ├── Navegar a la URL de GitHub Pages
  ├── Probar TODOS los flujos tocando con los dedos (no con mouse)
  ├── Probar firma con dedo y con lápiz táctil
  ├── Probar impresión PDF real en una impresora
  └── Probar rotación de pantalla en paso 3 (canvas debe reescalarse)
```

> **Regla de oro:** NUNCA asumir que algo funciona sin pasar las 3 etapas. El S25 es el árbitro final. Lo que funciona en Chrome Desktop puede fallar en el S25.

### Gestión de branches

```bash
# Corrección de bug
git checkout -b fix/nombre-del-bug
git add index.html
git commit -m "fix: descripción clara del problema corregido"
git push origin fix/nombre-del-bug
# Pull Request en GitHub: fix/... → main

# Nueva funcionalidad
git checkout -b feat/nombre-de-la-feature
git add index.html
git commit -m "feat: descripción de la funcionalidad"
git push origin feat/nombre-de-la-feature
```

### Estructura de archivos del repositorio

```
solicitud-adquisicion/
├── index.html          ← aplicación completa (archivo único)
├── manifest.json       ← configuración PWA (nombre, íconos, colores)
├── sw.js               ← service worker cache-first
├── icono.png           ← ícono PWA 512×512 px
└── README.md           ← este documento
```

---

## 16. Limitaciones conocidas y mejoras futuras

### Limitaciones actuales

| Limitación | Impacto | Nota |
|---|---|---|
| `localStorage` tiene límite de ~5 MB | Las firmas en base64 pesan ~50 KB c/u; ~100 solicitudes max | Migrar a IndexedDB en v2 |
| Sin sincronización entre dispositivos | El historial es local al dispositivo y navegador | Roadmap: WD MyCloud + Google Drive |
| Sin autenticación de usuario | Cualquiera con acceso a la URL puede usar la app | Cloudflare Zero Trust mitiga esto |
| Variable `sigURL` huérfana aún presente | Confunde a futuros mantenedores | Eliminar en próxima refactorización |
| Un solo tipo de escuadrilla por solicitud | No permite solicitudes multi-escuadrilla | Diseño intencional (una solicitud = una escuadrilla) |

### Mejoras planificadas para v2

1. **Migración de `localStorage` a IndexedDB** — mayor capacidad, guards obligatorios, transacciones atómicas
2. **Sincronización WD MyCloud** — exportación automática por red WiFi local via REST API
3. **Integración Google Drive** — respaldo en la nube con carpetas por año y mes
4. **Variante PDF sin QR** — para destinatarios externos que reciben por WhatsApp
5. **Exportación / importación JSON** — backup manual del historial completo
6. **Generación de QR en PDF** — código QR que enlace a la solicitud digital
7. **Escáner QR** — recuperación de solicitudes escaneando el PDF impreso (Html5-QRCode)

---

*Documento técnico generado y mantenido por Toti's® — Sistemas AGA, FACH*
*Última actualización: abril 2026 — v1.0.0 con 7 bugs corregidos*
