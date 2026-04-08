# Solicitud Adquisición Supervisor
### Fuerza Aérea de Chile · División de Educación · Academia de Guerra Aérea

---

## Índice

1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Estructura del Archivo](#estructura-del-archivo)
4. [Flujo de Usuario (Wizard 3 pasos)](#flujo-de-usuario-wizard-3-pasos)
5. [Modelo de Datos](#modelo-de-datos)
6. [Sistema de Folios](#sistema-de-folios)
7. [Módulo de Ítems y Cálculo](#módulo-de-ítems-y-cálculo)
8. [Módulo de Firma Digital](#módulo-de-firma-digital)
9. [Módulo PDF / Impresión](#módulo-pdf--impresión)
10. [Módulo Historial](#módulo-historial)
11. [Persistencia (localStorage)](#persistencia-localstorage)
12. [Referencia de Funciones](#referencia-de-funciones)
13. [Variables Globales de Estado](#variables-globales-de-estado)
14. [Paleta de Colores y CSS](#paleta-de-colores-y-css)
15. [Limitaciones Conocidas](#limitaciones-conocidas)
16. [Próximas Mejoras Sugeridas](#próximas-mejoras-sugeridas)

---

## Descripción General

Aplicación web de una sola página (`index.html`) que permite a los supervisores de la AGA generar, firmar e imprimir solicitudes formales de adquisición de materiales. Funciona completamente offline una vez cargada (no requiere servidor ni backend).

**Nombre institucional del documento generado:**
`SOLICITUD DE ADQUISICIÓN DE MATERIALES`

**Folio generado automáticamente:**
`ADQ-{AÑO}-{NNNN}` — ej. `ADQ-2026-0003`

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   index.html                    │
│  ┌─────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  HTML   │  │    CSS     │  │  Vanilla JS │  │
│  │  DOM    │  │ Variables  │  │  (sin fw.)  │  │
│  └────┬────┘  └─────┬──────┘  └──────┬──────┘  │
│       │             │                │          │
│       └─────────────┴────────────────┘          │
│                       │                         │
│          ┌────────────┴────────────┐            │
│          │       localStorage      │            │
│          │  fach_historial (JSON)  │            │
│          │  fach_folio    (int)    │            │
│          └─────────────────────────┘            │
│                                                 │
│          ┌──────────────────────────┐           │
│          │    Canvas API (firma)    │           │
│          └──────────────────────────┘           │
│                                                 │
│          ┌──────────────────────────┐           │
│          │  window.print() → PDF   │           │
│          └──────────────────────────┘           │
└─────────────────────────────────────────────────┘
```

**Stack:**
| Capa | Tecnología |
|---|---|
| UI | HTML5 semántico + CSS variables |
| Lógica | Vanilla JavaScript (ES5 compatible) |
| Persistencia | `localStorage` (clave `fach_historial` y `fach_folio`) |
| Firma | Canvas API (eventos touch + mouse) |
| PDF | `@media print` + `window.print()` |
| Iconografía | Emojis Unicode (sin dependencias externas) |

---

## Estructura del Archivo

```
index.html
│
├── <head>
│   ├── Meta viewport (sin zoom — apto S25)
│   ├── <link rel="apple-touch-icon">  ← ícono PWA inline base64
│   └── <style>                        ← Todo el CSS en :root variables
│
└── <body>
    │
    ├── .app                           ← Contenedor flex columna 100dvh
    │   ├── .app-header                ← Logo AGA + título + folio miniatura
    │   ├── .steps-bar                 ← Barra de pasos (1-2-3)
    │   │
    │   ├── .steps-content             ← Zona scrollable de contenido
    │   │   ├── #panel-1  (Datos)
    │   │   ├── #panel-2  (Materiales)
    │   │   ├── #panel-3  (Resumen + Firma)
    │   │   └── #panel-hist (Historial)
    │   │
    │   └── #nav-bar                   ← Botones Atrás / Historial / Reset / Siguiente
    │
    ├── .toast                         ← Notificación flotante
    ├── #print-area                    ← DOM oculto para impresión
    └── <script>                       ← Lógica completa
```

---

## Flujo de Usuario (Wizard 3 pasos)

```
┌──────────────────────────────────────────────────────────────┐
│                      INICIO / init()                         │
│  • Leer fach_folio → siguiente número                        │
│  • Prellenar: año, fecha hoy, folio correlativo              │
│  • Agregar ítem vacío por defecto                            │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  PASO 1 — DATOS GENERALES              (#panel-1)            │
│                                                              │
│  Campo              ID elemento           Tipo              │
│  ─────────────────  ────────────────────  ────────────────  │
│  Folio (año)        #folio-anio           text / 4 dígitos  │
│  Folio (número)     #folio-num            text / readonly   │
│  Fecha              #fecha                date              │
│  Escuadrilla        #escuadrilla          select            │
│  Cdte. Escuadrilla  #cdte                 text              │
│  Observaciones      #observaciones        textarea          │
│                                                              │
│  Opciones escuadrilla:                                       │
│    • Bandada Instalaciones                                   │
│    • Bandada Alimentación                                    │
│    • Bandada Transporte                                      │
└───────────────────────┬──────────────────────────────────────┘
                        │ [Siguiente →]
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  PASO 2 — MATERIALES                   (#panel-2)            │
│                                                              │
│  Por cada ítem en el array `items[]`:                        │
│    • Cant.        (number, mín 1)                            │
│    • Unidad       (select: UN/KG/MT/LT/CJ/PAQ/GL)           │
│    • Descripción  (text libre)                               │
│    • P. Unitario  (número formato miles CL)                  │
│    • Subtotal     (calc. automático, solo lectura)           │
│                                                              │
│  Totales automáticos:                                        │
│    Subtotal neto = Σ(cant × p.unitario)                      │
│    IVA (19%)     = subtotal × 0.19                           │
│    TOTAL         = subtotal × 1.19                           │
│                                                              │
│  [+ Agregar ítem]  — máx sin límite                          │
│  [×] en cada ítem  — eliminar (mín 1 ítem)                   │
└───────────────────────┬──────────────────────────────────────┘
                        │ [Siguiente →]
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  PASO 3 — RESUMEN + FIRMA              (#panel-3)            │
│                                                              │
│  Sección Resumen:                                            │
│    • Tabla resumen de todos los campos del Paso 1            │
│    • Lista de ítems con subtotales                           │
│    • Totales (neto / IVA / TOTAL)                            │
│                                                              │
│  Sección Firma:                                              │
│    • #firma-nombre   (texto mayúsculas)                      │
│    • #firma-grado    (grado militar)                         │
│    • #firma-cargo    (cargo)                                 │
│    • #sig-canvas     (firma a mano: touch + mouse)           │
│    • [Borrar firma]                                          │
│                                                              │
│  Acciones:                                                   │
│    [🖨️ Guardar / Imprimir PDF] → imprimirPDF()              │
│    [💾 Guardar en historial]   → guardarHistorial()          │
│    [+ Nuevo] (btn Siguiente)   → nuevoFormulario()           │
└──────────────────────────────────────────────────────────────┘

        [📁 Historial]  →  panel-hist
                        ←  [← Volver al formulario]
```

### Diagrama de transiciones de pasos

```
           irPaso(n)
    ┌─────────────────────────────────────┐
    │                                     │
   [1] ──→ [2] ──→ [3]                   │
    │  ←──  │  ←──  │                    │
    │        │       └── guardarHistorial()
    │        │             incrementa folio
    │        │             resetea form
    │        │             irPaso(1)
    │        │
    │       [HIST]  ─── renderHistorial()
    │                     cargarHistorial(i) → irPaso(1)
    │                     eliminarHistorial(i)
    └─────────────────────────────────────┘
```

---

## Modelo de Datos

### Objeto Ítem (en memoria — array `items[]`)

```javascript
{
  cant:       Number,   // Cantidad (ej: 3)
  unidad:     String,   // "UN" | "KG" | "MT" | "LT" | "CJ" | "PAQ" | "GL"
  descripcion: String,  // Texto libre
  pUnitario:  Number    // Precio unitario (sin formato, número puro)
}
```

### Objeto Solicitud (guardado en historial)

```javascript
{
  folioAnio:    String,   // "2026"
  folioNum:     String,   // "0003"
  fecha:        String,   // "2026-04-08" (ISO)
  escuadrilla:  String,   // "Bandada Instalaciones"
  cdte:         String,   // Nombre del comandante
  observaciones: String,  // Texto libre
  firmaNombre:  String,   // Nombre en firma
  firmaGrado:   String,   // Grado militar
  firmaCargo:   String,   // Cargo
  items:        Array,    // Copia profunda de items[] en ese momento
  total:        Number    // Total con IVA
}
```

---

## Sistema de Folios

```
localStorage "fach_folio"  →  entero (último folio USADO)
                                ↓
init()
  getFolio() → n
  folio a mostrar = n + 1
  folio formateado = String(n+1).padStart(4,'0')
  → "#folio-num" = "0001"
  → "ADQ-2026-0001" mostrado en header

guardarHistorial()
  usa folio del campo #folio-num
  setFolio(usado)          ← guarda el que se usó
  siguiente = usado + 1    ← prepara el próximo
  #folio-num = folioStr(siguiente)

resetContador()
  setFolio(0)
  #folio-num = "0001"      ← vuelve desde cero
```

**Formato folio:** `ADQ-{#folio-anio}-{#folio-num}`
- Año: editable por el usuario (campo `#folio-anio`)
- Número: readonly, incremento automático, 4 dígitos con ceros a la izquierda

---

## Módulo de Ítems y Cálculo

```javascript
// Flujo de edición de un ítem:
updItem(i, 'cant', valor)
  └─→ items[i].cant = parseFloat(valor) || 0
  └─→ renderItems()

updItem(i, 'pUnitario', valor)
  └─→ strip puntos miles → parsear float
  └─→ items[i].pUnitario = resultado
  └─→ renderItems()

// Cálculos:
calcSub(it) = it.cant × it.pUnitario

calcTotals() = {
  sub:   Σ calcSub(item)  para todos los items
  iva:   sub × 0.19
  total: sub × 1.19
}

// Formato visual:
fmtN(n) = Math.round(n).toLocaleString('es-CL')
          → "1.234.567" (puntos de miles, Chile)
```

**Ciclo render:** Cada cambio en un ítem llama `renderItems()` que reconstruye todo el DOM de ítems y actualiza los 3 totales en pantalla.

---

## Módulo de Firma Digital

```
initCanvas()
  ├── sc.width  = sc.offsetWidth   (ancho real del contenedor)
  ├── sc.height = 200px
  ├── ctx: strokeStyle=#000, lineWidth=2, lineCap=round
  │
  ├── Eventos MOUSE: mousedown → beginPath/moveTo
  │                 mousemove → lineTo/stroke  (si drawing)
  │                 mouseup / mouseleave → drawing=false
  │
  └── Eventos TOUCH: touchstart → beginPath/moveTo
                    touchmove  → lineTo/stroke  (preventDefault)
                    touchend   → drawing=false

capturarFirma()
  ├── Crea canvas temporal mismo tamaño
  ├── Fondo blanco (fillRect)
  ├── drawImage del sig-canvas
  └── Retorna DataURL JPEG calidad 0.7

limpiarFirma()
  └── clearRect(0,0,w,h)

// Persistencia en sesión:
sigDataURL (var global)
  ├── Se captura al navegar fuera del Paso 3
  └── Se restaura al volver al Paso 3 (restaurarFirma)
```

**Nota S25:** `touch-action: none` en el canvas y `{passive:false}` en los listeners previenen el scroll mientras se firma.

---

## Módulo PDF / Impresión

```
imprimirPDF()
  │
  ├── 1. Poblar #print-area (DOM oculto):
  │       #p-folio, #p-fecha, #p-escuadrilla, #p-cdte
  │       #p-obs, #p-sub, #p-iva, #p-total
  │       #p-items  → <tbody> con <tr> por cada ítem con descripción
  │       #p-sig-img → DataURL de la firma (si existe)
  │       #p-firma-nombre/grado/cargo
  │
  ├── 2. setTimeout(print, 200ms)   ← evita pantalla blanca en S25
  │
  └── 3. @media print:
          body > * { display: none }   ← oculta la app
          #print-area { display: block } ← muestra solo el documento
          @page { size: letter portrait; margin: 15mm 20mm }
```

**Estructura del PDF impreso:**
```
Encabezado institucional centrado
Título subrayado: SOLICITUD DE ADQUISICIÓN DE MATERIALES
Folio + Fecha (fila flex)
Escuadrilla + Cdte. (grid 2 cols)
Tabla de ítems (Cant/Unidad/Descripción/P.Unitario/Subtotal)
Totales (derecha: neto, IVA, TOTAL bold)
Observaciones
Firma (imagen canvas + nombre/grado/cargo centrados)
```

---

## Módulo Historial

```
verHistorial()
  ├── Activa #panel-hist
  ├── Oculta #nav-bar (agrega div con botón "Volver")
  └── renderHistorial()

renderHistorial()
  └── solicitudes.slice().reverse()
      → Por cada registro: .hist-item-app
        • Folio + fecha
        • Escuadrilla + N° ítems + total formateado
        • Observaciones (si existen)
        • [Eliminar] (stopPropagation para no abrir)
        • onclick → cargarHistorial(i)

cargarHistorial(i)
  ├── Puebla todos los campos del formulario
  ├── items[] ← copia profunda de h.items
  ├── renderItems()
  ├── editIndex = i   ← al guardar, sobreescribe en vez de agregar
  └── irPaso(1)

guardarHistorial()
  ├── Lee TODOS los campos en variables locales
  ├── Construye objeto solicitud
  ├── Si editIndex >= 0 → sobrescribe solicitudes[editIndex]
  │   Else → solicitudes.push(rec)
  ├── localStorage.setItem('fach_historial', JSON.stringify(...))
  ├── Muestra toast confirmación
  └── setTimeout 1000ms:
        • Incrementa folio
        • Limpia formulario
        • items = [], agregarItem()
        • irPaso(1)

eliminarHistorial(i)
  ├── solicitudes.splice(i,1)
  ├── saveLS()
  └── renderHistorial()
```

---

## Persistencia (localStorage)

| Clave | Tipo | Descripción |
|---|---|---|
| `fach_folio` | String (int) | Último número de folio **usado**. Default 0. |
| `fach_historial` | JSON string | Array de objetos `Solicitud`. |

**Lectura segura (con try/catch):**
```javascript
getFolio()  → parseInt(localStorage.getItem('fach_folio') || '0')
saveLS()    → localStorage.setItem('fach_historial', JSON.stringify(solicitudes))
```

**Límite práctico:** localStorage ≈ 5MB. Con firmas JPEG calidad 0.7 ≈ 30-80KB por solicitud, capacidad aproximada de 60-160 registros con firma. Sin firma, cientos de registros.

---

## Referencia de Funciones

| Función | Descripción |
|---|---|
| `init()` | Inicialización al cargar. Folio siguiente, fecha hoy, primer ítem. |
| `irPaso(n)` | Navega al paso 1, 2 o 3. Actualiza steps-bar, captura firma si sale del 3. |
| `agregarItem()` | Push a `items[]` con valores vacíos. Llama `renderItems()`. |
| `eliminarItem(i)` | Splice en `items[]`. Solo si hay más de 1. |
| `updItem(i, k, v)` | Actualiza `items[i][k]` con parseo adecuado según campo. |
| `calcSub(it)` | Retorna `cant × pUnitario` de un ítem. |
| `calcTotals()` | Retorna `{sub, iva, total}` del array completo. |
| `renderItems()` | Reconstruye el DOM de ítems y actualiza totales en pantalla. |
| `actualizarResumen()` | Puebla el panel de resumen (Paso 3) con datos actuales. |
| `initCanvas()` | Inicializa el canvas de firma con listeners touch+mouse. |
| `capturarFirma()` | Retorna DataURL JPEG del canvas. |
| `limpiarFirma()` | Limpia el canvas. |
| `restaurarFirma()` | Dibuja `sigDataURL` en el canvas tras regresar al Paso 3. |
| `imprimirPDF()` | Puebla `#print-area` y lanza `window.print()` con delay 200ms. |
| `guardarHistorial()` | Guarda solicitud en `solicitudes[]` y localStorage. Incrementa folio. |
| `cargarHistorial(i)` | Carga solicitud[i] en el formulario. Activa modo edición. |
| `eliminarHistorial(i)` | Elimina solicitud[i] de array y localStorage. |
| `nuevoFormulario()` | Limpia el formulario para una nueva solicitud. |
| `verHistorial()` | Activa panel de historial, oculta nav-bar. |
| `volverDeHistorial()` | Regresa al paso actual, restaura nav-bar. |
| `resetContador()` | Pide confirmación y resetea `fach_folio` a 0. |
| `mostrarToast(msg)` | Muestra notificación flotante por 2.5s. |
| `fmtN(n)` | Formatea número como pesos CL con puntos de miles. |
| `fmtFecha(f)` | Convierte "YYYY-MM-DD" → "DD/MM/YYYY". |
| `folioStr(n)` | Formatea número como 4 dígitos con ceros. |
| `getFolio()` | Lee entero de localStorage "fach_folio". |
| `setFolio(n)` | Guarda entero en localStorage "fach_folio". |
| `saveLS()` | Serializa `solicitudes[]` en localStorage. |

---

## Variables Globales de Estado

```javascript
var pasoActual = 1;          // Paso actual del wizard (1|2|3)
var items = [];              // Array de ítems en edición
var editIndex = -1;          // Índice en solicitudes[] si editando historial (-1=nuevo)
var solicitudes = [];        // Array de solicitudes guardadas (espejo del localStorage)
var sigDataURL = '';         // DataURL de la firma capturada (persistencia en sesión)
```

---

## Paleta de Colores y CSS

Todas las variables en `:root`:

```css
--azul:   #0d1f3c   /* Fondo principal / header */
--azul2:  #1a3a6e   /* Cards secundarias / botones */
--dorado: #c8a84b   /* Acentos / borders / totales */
--dorado2:#a07830   /* Hover/gradiente dorado */
--blanco: #ffffff   /* Fondo cards */
--gris:   #f4f6f9   /* Fondo inputs */
--borde:  #dde3ed   /* Borders suaves */
--verde:  #2ecc71   /* Step completado */
--rojo:   #e74c3c   /* Botón eliminar */
```

**Layout:** Flex columna en `.app` con `height: 100dvh`. El área de contenido (`.steps-content`) ocupa el espacio restante con `flex:1;overflow:hidden`. Cada panel es `position:absolute;inset:0;overflow-y:auto`.

---

## Limitaciones Conocidas

| N° | Limitación | Impacto |
|---|---|---|
| 1 | Sin Service Worker → no es offline real al primer acceso | Requiere carga inicial con red |
| 2 | localStorage (no IndexedDB) → sin transacciones, sin guards IDB | App simple; suficiente para ≤200 registros |
| 3 | Firma solo captura la sesión actual (no persiste en historial) | Si se recarga antes de guardar, se pierde |
| 4 | `window.print()` depende del diálogo del SO | En algunos Android abre "Vista previa" no PDF directo |
| 5 | Sin validación obligatoria de campos | Puede guardarse con campos vacíos |
| 6 | Sin sincronización con servidor | Solo local por dispositivo |
| 7 | Sin autenticación | Cualquier usuario del dispositivo accede |

---

## Próximas Mejoras Sugeridas

1. **Service Worker** → cache-first para uso 100% offline desde segundo acceso
2. **IndexedDB** → reemplazar localStorage con guards `!db`, null-checks y `onerror` (alineado con arquitectura AGA estándar)
3. **Guardar firma en historial** → serializar `sigDataURL` en el objeto solicitud
4. **Validación por paso** → alertar campos vacíos antes de avanzar (FIX-009)
5. **Exportar JSON** → botón de backup/restore del historial completo
6. **QR en PDF** → incrustar QR con folio para trazabilidad (QRCode.js vía CDN)
7. **WhatsApp sharing** → compartir PDF por `wa.me` con URL del documento
8. **manifest.json + icono externo** → completar estructura PWA instalable
9. **Selector de Escuadrillas dinámico** → cargar desde JSON configurable
10. **Modo oscuro** → ya preparado con CSS variables, solo agregar `prefers-color-scheme`

---

*Documento generado automáticamente — AGA PWA Suite · Toti's®*
