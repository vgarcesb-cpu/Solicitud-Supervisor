# CONTEXT.md · Solicitud Supervisor (AGA FACH)

Contexto técnico para retomar el proyecto. Actualizado el 29-oct-2026.

## Direcciones

| Qué | Dirección |
|---|---|
| App (producción) | https://solicitud-supervisor.totis.cl |
| API de respaldo | https://supervisor-api.totis.cl |
| Repo | `vgarcesb-cpu/Solicitud-Supervisor` (público) |
| Worker en Cloudflare | `solicitud-supervisor-worker` (dominio propio: supervisor-api.totis.cl) |
| Base D1 | `solicitud-supervisor-db` (id `52df5e2f-e887-492e-bf7d-baec1e6b0455`) |
| Login de Access | https://totis.cloudflareaccess.com |

Para conectar un dispositivo nuevo (Mac, S26 u otro) se abre siempre https://solicitud-supervisor.totis.cl. La copia que GitHub Pages publica en `vgarcesb-cpu.github.io/Solicitud-Supervisor/` no sincroniza: el Worker solo acepta el origen solicitud-supervisor.totis.cl. La URL antigua `solicitud-supervisor-worker.vgarcesb.workers.dev` ya no se usa; si un dispositivo la tiene guardada, la app la cambia sola por supervisor-api.totis.cl.

El Dashboard de Cloudflare traducido por Chrome muestra "request-supervisor-worker" y "request-supervisor-db". Son los mismos recursos con el nombre traducido. Conviene desactivar la traducción para ese sitio.

## Stack y modelo de datos

- `index.html` único (HTML + CSS + JS sin frameworks), `manifest.json`, `sw.js`, `icono.png` (512×512) e `icono-maskable.png`.
- Despliegue: Cloudflare Pages conectado al repo. Un commit en `main` queda publicado en 1 a 2 minutos. `_headers` define CSP y headers de seguridad.
- La app está detrás de Cloudflare Access. Sin sesión de Access, cualquier archivo del sitio redirige al login.
- `localStorage` es la fuente de verdad. D1 es respaldo y medio para pasar datos entre dispositivos.
- Uso: una persona, Mac y S26. Pueden usarse el mismo día, incluso sin señal.

Claves de `localStorage`:

| Clave | Contenido |
|---|---|
| `fach_historial` | Arreglo de solicitudes |
| `fach_folio` | Último número de folio usado en el año |
| `fach_sync_pendientes` | Folios guardados que aún no suben a D1 |
| `ss_api_url` | URL del Worker (se precarga sola) |
| `ss_api_key` | Clave de sincronización de este dispositivo |

Campos de cada solicitud que no son del formulario: `id` (folio), `uid` (huella única, solo solicitudes creadas desde el 29-oct-2026), `esHistorico` y `folioCustom` (registros de papel), `folioAnterior` (folio original de una solicitud reasignada) y `conflictoNube`.

## Flujo principal

1. Paso 1, Datos: folio automático `ADQ-AAAA-NNNN`, fecha, escuadrilla, comandante y observaciones. Al final está la tarjeta "Respaldo en la nube".
2. Paso 2, Materiales: ítems con cantidad, unidad, descripción y precio. Calcula subtotal, IVA 19 % y total.
3. Paso 3, Resumen: firma (nombre, grado, cargo y canvas), "Guardar / Imprimir PDF" y "Guardar en historial". "Guardar / Imprimir PDF" solo imprime; no guarda en el historial.

Campos obligatorios: "Siguiente" no avanza sin fecha y comandante (Paso 1) ni con ítems incompletos (Paso 2: descripción, cantidad > 0 y precio > 0). Guardar exige los pasos 1 y 2. Imprimir exige además nombre, grado, cargo y firma a mano. El trazo se detecta buscando píxeles oscuros en el canvas, así que también cuenta una firma restaurada del historial.

Firma: el canvas mide el ancho de la pantalla por 200 px de alto. Una firma guardada se dibuja ajustada a ese tamaño sin deformarla (FIX-006). La imagen original queda en `sigDataURL` y es la que se guarda y se imprime mientras no se dibuje encima (`firmaModificada`). Girar la pantalla vuelve a ajustarla desde esa imagen (FIX-010).

Al guardar, la pantalla no se limpia. La solicitud queda abierta en modo edición y aparece un modal con el folio, el estado del respaldo y tres botones: "Imprimir PDF", "+ Nueva solicitud" y "Seguir viendo esta solicitud". Guardar otra vez actualiza la misma solicitud. El formulario se limpia solo con "+ Nuevo" (barra inferior del Paso 3) o "+ Nueva solicitud" (modal). La impresión espera 700 ms antes de abrir el diálogo.

El encabezado, el resumen y el PDF muestran el folio del registro abierto, incluido el folio de papel de un histórico. "Traer respaldo" y "Sincronizar próximo folio" no cambian ese folio; solo ajustan el contador para la próxima solicitud.

Historial: lista de solicitudes con Editar y Eliminar, "+ Agregar Registro Antiguo" para folios de papel y "Sincronizar próximo folio". Editar abre el flujo completo de 3 pasos, también para los históricos.

## Sincronización

- Subida: automática al guardar. Si no hay señal o el Worker falla, el folio queda en `fach_sync_pendientes` y se reintenta al volver la señal o al abrir la app.
- Bajada: manual, con "Traer respaldo desde la nube". No reemplaza un registro local con cambios pendientes ni un registro local distinto que tenga el mismo folio.
- Punto junto a "N° Folio": verde sin pendientes, dorado con pendientes, gris sin URL o sin clave.

Folios entre dispositivos:

- Al abrir la app, al pulsar "+ Nuevo", después de guardar y al volver la señal, la app consulta D1. Si otro dispositivo usó un folio más alto, sube el contador local. Nunca lo baja.
- Una solicitud nueva no reutiliza un folio que ya esté en el historial local.
- Si dos dispositivos crean el mismo folio sin señal, conserva el número el que sincroniza primero. El otro recibe 409 del Worker, pasa al siguiente folio libre y queda con la marca "REASIGNADO · antes ADQ-…-… · reimprimir". La marca se quita al imprimir de nuevo esa solicitud.
- Los históricos de papel y los registros sin `uid` nunca se renumeran. Si chocan, quedan con la marca "CONFLICTO EN LA NUBE" para revisión manual.

## Worker v1.4 (activo desde el 29-oct-2026, versión `82e27533`)

| Endpoint | Método | Clave | Función |
|---|---|---|---|
| `/health` | GET | no | Estado, versión y `auth: true/false` según la clave enviada |
| `/solicitudes` | POST | sí | Upsert por `folio_id`; 409 si el folio es de otra solicitud |
| `/solicitudes` | GET | sí | Respaldo completo |
| `/solicitudes/:folio_id?uid=` | DELETE | sí | Borra solo si el `uid` coincide |
| `/config` | GET | sí | Tabla `configuracion` |

- Autenticación: header `Authorization: Bearer <clave>`, comparado con el Secret `SYNC_KEY` del Worker. El header Origin no autentica, porque cualquiera lo escribe en un curl.
- CORS: solo `https://solicitud-supervisor.totis.cl`. Un Origin distinto recibe 403.
- POST valida folio, fecha, firma (data URL JPEG o PNG, máximo 1 MB), `uid` e ítems (máximo 200), y guarda cada ítem solo con `cant`, `unidad`, `descripcion` y `pUnitario`.
- El control de folio repetido va dentro del mismo UPSERT (`WHERE COALESCE(solicitudes.uid,'') = COALESCE(excluded.uid,'')`). Si no escribe nada, responde 409 con `max_num`, el folio más alto del año.
- Sin `SYNC_KEY` configurado, las rutas de datos quedan cerradas.

Comprobación rápida desde la Terminal:

```bash
curl -s https://supervisor-api.totis.cl/health; echo        # version 1.4, auth false
curl -s https://supervisor-api.totis.cl/solicitudes; echo   # "Clave de sincronización inválida"
```

## Clave de sincronización

La clave vive en dos lugares: el Secret `SYNC_KEY` del Worker (Configuración → Variables y secretos) y `localStorage` de cada dispositivo. Nunca va en el repo ni en un chat.

Para conectar un dispositivo nuevo:

1. En el Mac, abrir https://solicitud-supervisor.totis.cl, abrir la consola (Cmd + Option + J) y ejecutar `copy(localStorage.getItem('ss_api_key'))`. Debe medir 48 caracteres.
2. Enviarla por un correo a uno mismo, copiarla en el dispositivo nuevo y pegarla en "Clave de sincronización".
3. Pulsar "Guardar y probar conexión". Debe decir "· clave correcta".
4. Borrar el correo, también de la papelera.

Escribirla a mano en el teléfono falló una vez (28-oct). Hay que copiar y pegar.

Para cambiar la clave: generar otra con `openssl rand -hex 24`, reemplazar el Secret en Cloudflare y pegarla en cada dispositivo.

## PWA

- `index.html` enlaza `manifest.json` con `crossorigin="use-credentials"`. Sin ese atributo Chrome pide el manifest sin la cookie de Access, recibe el login y el CSP lo bloquea ("No se detectó ningún manifiesto").
- `sw.js` v3 (`solicitud-supervisor-v3`): la página se busca primero en la red y la caché queda para cuando no hay señal, así cada versión nueva llega sola. Manifest e iconos se sirven desde la caché. No intercepta la API ni los POST y DELETE. Nunca guarda una respuesta redirigida, como el login de Access.
- Subir `CACHE_NAME` solo cuando cambien `manifest.json` o los iconos.
- Instalar en el S26: con sesión de Access abierta, menú ⋮ → "Instalar app". El icono queda sin el logo de Chrome y abre a pantalla completa. Una vez instalada, abre sin señal.

## Despliegue y validación

Todo cambio pasa por tres etapas: Mac, después GitHub y Cloudflare, y al final el S26. El S26 decide.

- Frontend: subir los archivos al repo con "Add file → Upload files". Pages publica solo.
- Worker: pegar `worker.js` en el editor del Dashboard y pulsar Implementar. Después subir el mismo archivo al repo para que el repo y producción coincidan.
- D1: en la Consola, una instrucción por envío, y verificar con un `SELECT` aparte.
- Volver atrás: Worker → Implementaciones → versión anterior. D1 tiene Time Travel de 30 días.

## Historial de cambios

28 y 29-oct-2026:

1. URL del Worker precargada. Un campo vacío usa la URL por defecto y una URL `workers.dev` antigua se reemplaza.
2. PWA instalable: link al manifest, registro de `sw.js`, icono maskable. Después, `crossorigin="use-credentials"` por Access y `sw.js` v3.
3. Protección de folios: consulta a D1 antes de asignar el siguiente folio.
4. XSS: la cantidad de los ítems se escapa con `escHTML()` en el formulario y en el modal de históricos.
5. Worker v1.3: clave de sincronización. Antes, un curl sin Origin leía, cambiaba y borraba todas las solicitudes.
6. Worker v1.4 y columna `uid`: los folios repetidos entre dispositivos ya no se pisan.
7. Editar un registro conserva folio, `uid`, folio de papel y marca HISTÓRICO. Antes un histórico perdía la marca y un folio de papel sin formato pasaba a 0001.
8. "Traer respaldo" ya no borra ediciones locales pendientes.
9. La pantalla no se limpia al guardar: la solicitud queda abierta en edición y un modal confirma el folio. Guardar dos veces ya no puede crear un duplicado.
10. Impresión a los 700 ms (antes 200 ms).
11. Encabezado, resumen y PDF usan el folio del registro abierto. Antes, "Traer respaldo" podía cambiar el folio mostrado y un histórico de papel se imprimía como `ADQ-AAAA-0000`.
12. D1: `configuracion.api_worker_url` actualizada a `https://supervisor-api.totis.cl` (antes la URL `workers.dev`).
13. Validación por paso (FIX-009). Paso 1: fecha y comandante. Paso 2: al menos un ítem; cada ítem usado con descripción, cantidad > 0 y precio > 0. Imprimir exige además nombre, grado, cargo y trazo de firma; guardar sin firma se permite como borrador. Los campos que faltan quedan en rojo y un aviso los nombra. "Atrás" no valida. Un registro antiguo sin comandante o sin ítems hay que completarlo antes de volver a guardarlo.
14. Editar una solicitud firmada ya no borra la firma: al abrir un registro se carga su firma guardada en el canvas. Antes, editar y guardar la reemplazaba por una firma en blanco.
15. FIX-006: la firma guardada se dibuja con dimensiones explícitas que conservan la proporción. Una firma hecha en el Mac se ve completa en el S26, y al girar el teléfono ya no se estira. Mientras no se dibuje encima, guardar e imprimir usan la imagen original, así que la firma no se achica al pasar entre dispositivos. El grosor del trazo se mantiene en 2 px al volver al Paso 3 o al girar.

23 y 24-jun-2026: `id` asignado al guardar, reintento ante error de servidor, históricos en el flujo completo, tarjeta de respaldo movida al Paso 1 e indicador de sincronización.

## Lecciones

- Un fix de código no repara datos guardados antes en `localStorage`. Puede requerir una migración puntual.
- Antes de culpar a la caché del Service Worker, revisar si el dato llegó a D1.
- El Worker editado en el Dashboard se desfasa del repo. Después de cada despliegue, subir el mismo `worker.js` al repo y comparar.
- Con Access delante, todo archivo que el navegador pida sin cookies (manifest, por ejemplo) termina en el login.
- La consola de D1 no siempre limpia el campo después de Enter. Revisar que esté vacío antes de escribir la siguiente instrucción.

## Pendiente

- Export / Import JSON como respaldo manual. El README anterior lo mencionaba, pero la app no lo tiene.
