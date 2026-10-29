// ═══════════════════════════════════════════════════════
// worker.js — Solicitud Adquisición Supervisor (AGA FACH) v1.4
// Modelo HÍBRIDO offline-first: este Worker es respaldo/sync,
// nunca fuente de verdad. El frontend sigue funcionando 100%
// offline con localStorage; esto solo sincroniza cuando hay señal.
// v1.1: CORS restringido por whitelist exacta (===), Vary: Origin.
// v1.2 (08-jul-2026, saneamiento): retirado vgarcesb-cpu.github.io
//       de la whitelist. catch ya no expone err.message al cliente.
// v1.3 (28-oct-2026, seguridad):
//       - Clave de sincronización obligatoria (Secret SYNC_KEY) en
//         toda ruta de datos: Authorization: Bearer <clave>.
//         El header Origin NO autentica (se falsifica con curl).
//       - /health sigue público y responde auth:true/false para que
//         la app muestre si la clave guardada es correcta.
//       - Un Origin presente y fuera de la whitelist se rechaza.
//       - Validación y límites de tamaño en POST; ítems normalizados.
//         Firma: data URL JPEG o PNG (la app guarda JPEG).
//       - Sin SYNC_KEY configurado, las rutas de datos quedan cerradas.
// v1.4 (29-oct-2026, conflictos de folio):
//       - Columna uid: huella única de cada solicitud nueva, creada en
//         el dispositivo. Requiere en D1 (una vez):
//           ALTER TABLE solicitudes ADD COLUMN uid TEXT;
//       - POST solo actualiza un folio existente si el uid coincide
//         (comprobación atómica en el mismo UPSERT). Si no coincide
//         responde 409 { error:'conflicto_folio', max_num } y no pisa nada.
//       - DELETE /solicitudes/:id?uid=... solo borra si el uid coincide.
//       - Registros sin uid (antiguos e históricos de papel) siguen como
//         antes entre ellos: el último que escribe gana.
// ═══════════════════════════════════════════════════════

const ORIGENES_PERMITIDOS = [
  'https://solicitud-supervisor.totis.cl',
];

const MAX_BODY_BYTES   = 1500000;  // 1,5 MB por solicitud
const MAX_FIRMA_CHARS  = 1000000;  // data URL PNG de la firma
const MAX_ITEMS        = 200;
const RE_UID           = /^[A-Za-z0-9-]{8,64}$/;

// Folio más alto usado en un año (para que el dispositivo se renumere)
async function maxFolioAnio(env, anio) {
  const row = await env.DB.prepare(
    `SELECT MAX(CAST(folio_num AS INTEGER)) AS m FROM solicitudes WHERE folio_anio = ?`
  ).bind(String(anio || '')).first();
  return (row && row.m) || 0;
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && ORIGENES_PERMITIDOS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

// Comparación en tiempo constante (evita adivinar la clave por tiempos)
function claveValida(request, env) {
  const esperada = env.SYNC_KEY || '';
  if (!esperada) return false;
  const auth = request.headers.get('Authorization') || '';
  const recibida = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const enc = new TextEncoder();
  const a = enc.encode(recibida);
  const b = enc.encode(esperada);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

// ── Validación ──
function texto(v, max) {
  if (v === null || v === undefined) return '';
  return String(v).slice(0, max);
}
function numero(v, min, max) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.min(Math.max(n, min), max);
}
function validarSolicitud(b) {
  if (!b || typeof b !== 'object') return 'cuerpo inválido';
  if (typeof b.folio_id !== 'string' || !/^[A-Za-z0-9\-_/ ]{1,40}$/.test(b.folio_id)) return 'folio_id inválido';
  if (b.folio_anio && !/^\d{4}$/.test(String(b.folio_anio))) return 'folio_anio inválido';
  if (b.folio_num && !/^\d{1,6}$/.test(String(b.folio_num))) return 'folio_num inválido';
  if (b.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha))) return 'fecha inválida';
  // La app guarda la firma como JPEG (toDataURL('image/jpeg')); se acepta PNG
  // también. 'data:,' (canvas sin tamaño) se trata como firma vacía.
  if (b.firma_img && b.firma_img !== 'data:,' && (typeof b.firma_img !== 'string' ||
      !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(b.firma_img) ||
      b.firma_img.length > MAX_FIRMA_CHARS)) return 'firma_img inválida';
  if (b.uid && (typeof b.uid !== 'string' || !RE_UID.test(b.uid))) return 'uid inválido';
  if (b.items !== undefined && b.items !== null && !Array.isArray(b.items)) return 'items inválido';
  if (Array.isArray(b.items) && b.items.length > MAX_ITEMS) return 'demasiados ítems';
  return null;
}
// Solo se guardan los campos conocidos de cada ítem, con tipo correcto
function normalizarItems(items) {
  return (Array.isArray(items) ? items : []).map(function (it) {
    it = it || {};
    return {
      cant:        numero(it.cant, 0, 10000000),
      unidad:      texto(it.unidad, 10),
      descripcion: texto(it.descripcion, 150),
      pUnitario:   numero(it.pUnitario, 0, 1000000000000),
    };
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(origin) });

    // Origin presente y ajeno → fuera. (Origin vacío = curl/script:
    // pasa a la verificación de clave, que es la que autentica.)
    if (origin && !ORIGENES_PERMITIDOS.includes(origin))
      return json({ error: 'No autorizado' }, 403, origin);

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Health check — público, informa si la clave enviada es válida
      if (path === '/health')
        return json({
          ok: true, app: 'SOLICITUD-SUPERVISOR', version: '1.4',
          auth: claveValida(request, env), ts: new Date().toISOString()
        }, 200, origin);

      // Desde aquí, toda ruta exige la clave
      if (!claveValida(request, env))
        return json({ error: 'Clave de sincronización inválida' }, 401, origin);

      // ── POST /solicitudes — upsert (sync desde el dispositivo) ──
      if (path === '/solicitudes' && method === 'POST') {
        const largo = Number(request.headers.get('Content-Length') || 0);
        if (largo > MAX_BODY_BYTES) return json({ error: 'Solicitud demasiado grande' }, 413, origin);

        let body;
        try { body = await request.json(); }
        catch (_) { return json({ error: 'JSON inválido' }, 400, origin); }

        const err = validarSolicitud(body);
        if (err) return json({ error: err }, 400, origin);

        const items = normalizarItems(body.items);
        const uid = body.uid || null;

        // Si el folio ya existe, solo se actualiza cuando el uid coincide
        // (NULL = registro antiguo/histórico). Si no coincide, no se escribe
        // nada (changes = 0) y se responde 409. Todo en una sola instrucción.
        const res = await env.DB.prepare(`
          INSERT INTO solicitudes
            (folio_id, folio_anio, folio_num, folio_custom, fecha, escuadrilla, cdte,
             observaciones, firma_nombre, firma_grado, firma_cargo, firma_img,
             items_json, total, es_historico, uid, actualizado_en)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(folio_id) DO UPDATE SET
            folio_anio=excluded.folio_anio,
            folio_num=excluded.folio_num,
            folio_custom=excluded.folio_custom,
            fecha=excluded.fecha,
            escuadrilla=excluded.escuadrilla,
            cdte=excluded.cdte,
            observaciones=excluded.observaciones,
            firma_nombre=excluded.firma_nombre,
            firma_grado=excluded.firma_grado,
            firma_cargo=excluded.firma_cargo,
            firma_img=excluded.firma_img,
            items_json=excluded.items_json,
            total=excluded.total,
            es_historico=excluded.es_historico,
            actualizado_en=datetime('now')
          WHERE COALESCE(solicitudes.uid, '') = COALESCE(excluded.uid, '')
        `).bind(
          body.folio_id,
          texto(body.folio_anio, 4), texto(body.folio_num, 6),
          body.folio_custom ? texto(body.folio_custom, 40) : null,
          texto(body.fecha, 10),
          texto(body.escuadrilla, 100), texto(body.cdte, 100), texto(body.observaciones, 300),
          texto(body.firma_nombre, 100), texto(body.firma_grado, 50), texto(body.firma_cargo, 100),
          (body.firma_img && body.firma_img !== 'data:,') ? body.firma_img : '',
          JSON.stringify(items), numero(body.total, 0, 1e15), body.es_historico ? 1 : 0,
          uid
        ).run();

        if (!res.meta || res.meta.changes === 0) {
          return json({
            error: 'conflicto_folio', folio_id: body.folio_id,
            max_num: await maxFolioAnio(env, body.folio_anio)
          }, 409, origin);
        }

        return json({ ok: true, folio_id: body.folio_id }, 200, origin);
      }

      // ── GET /solicitudes — pull completo (restaurar en otro dispositivo) ──
      if (path === '/solicitudes' && method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT * FROM solicitudes ORDER BY actualizado_en DESC`
        ).all();

        // FIX-007: parse protegido POR FILA — un items_json corrupto
        // no debe impedir restaurar el resto de los registros.
        const data = results.map(r => {
          let items = [];
          try { items = normalizarItems(JSON.parse(r.items_json || '[]')); } catch (_) { items = []; }
          return { ...r, items, es_historico: !!r.es_historico };
        });

        return json({ ok: true, data }, 200, origin);
      }

      // ── DELETE /solicitudes/:id ──
      if (path.startsWith('/solicitudes/') && method === 'DELETE') {
        let folioId = '';
        try { folioId = decodeURIComponent(path.slice('/solicitudes/'.length)); } catch (_) {}
        if (!/^[A-Za-z0-9\-_/ ]{1,40}$/.test(folioId)) return json({ error: 'folio_id inválido' }, 400, origin);
        const uidDel = url.searchParams.get('uid') || '';
        if (uidDel && !RE_UID.test(uidDel)) return json({ error: 'uid inválido' }, 400, origin);
        // Solo borra si el registro de la nube es el mismo (mismo uid)
        const del = await env.DB.prepare(
          `DELETE FROM solicitudes WHERE folio_id = ? AND COALESCE(uid, '') = ?`
        ).bind(folioId, uidDel).run();
        if (del.meta && del.meta.changes === 0) {
          const existe = await env.DB.prepare(`SELECT 1 FROM solicitudes WHERE folio_id = ?`).bind(folioId).first();
          if (existe) return json({ error: 'conflicto_folio', folio_id: folioId }, 409, origin);
        }
        return json({ ok: true }, 200, origin);
      }

      // ── GET /config ──
      if (path === '/config' && method === 'GET') {
        const { results } = await env.DB.prepare(`SELECT clave, valor FROM configuracion`).all();
        const cfg = {};
        results.forEach(r => { cfg[r.clave] = r.valor; });
        return json(cfg, 200, origin);
      }

      return json({ error: 'Ruta no encontrada' }, 404, origin);

    } catch (e) {
      console.error('supervisor worker:', e);
      return json({ error: 'Error interno del servidor' }, 500, origin);
    }
  }
};
