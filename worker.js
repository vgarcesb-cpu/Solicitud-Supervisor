// ═══════════════════════════════════════════════════════
// worker.js — Solicitud Adquisición Supervisor (AGA FACH)
// Modelo HÍBRIDO offline-first: este Worker es respaldo/sync,
// nunca fuente de verdad. El frontend sigue funcionando 100%
// offline con localStorage; esto solo sincroniza cuando hay señal.
// ═══════════════════════════════════════════════════════

function corsHeaders(origin) {
  const ok = origin !== '' && (
    origin.includes('solicitud-supervisor.totis.cl') ||
    origin.includes('vgarcesb-cpu.github.io') ||
    origin.includes('workers.dev')
  );
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://solicitud-supervisor.totis.cl',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function origenAutorizado(request) {
  const origin  = request.headers.get('Origin')  || '';
  const referer = request.headers.get('Referer') || '';
  return (
    origin.includes('solicitud-supervisor.totis.cl') ||
    origin.includes('vgarcesb-cpu.github.io') ||
    origin.includes('workers.dev') ||
    referer.includes('solicitud-supervisor.totis.cl') ||
    referer.includes('vgarcesb-cpu.github.io') ||
    origin === ''
  );
}

export default {
  async fetch(request, env) {
    const CORS_ONLY = corsHeaders(request.headers.get('Origin') || '');
    const JSON_HEADERS = { ...CORS_ONLY, 'Content-Type': 'application/json' };

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS_ONLY });

    if (!origenAutorizado(request))
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: JSON_HEADERS });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Health check — SIEMPRE presente
      if (path === '/health')
        return new Response(JSON.stringify({
          ok: true, app: 'SOLICITUD-SUPERVISOR', version: '1.0', ts: new Date().toISOString()
        }), { headers: JSON_HEADERS });

      // ── POST /solicitudes — upsert (sync desde el dispositivo) ──
      if (path === '/solicitudes' && method === 'POST') {
        const body = await request.json();
        const {
          folio_id, folio_anio, folio_num, folio_custom, fecha,
          escuadrilla, cdte, observaciones,
          firma_nombre, firma_grado, firma_cargo, firma_img,
          items, total, es_historico
        } = body;

        if (!folio_id) {
          return new Response(JSON.stringify({ error: 'folio_id requerido' }), { status: 400, headers: JSON_HEADERS });
        }

        await env.DB.prepare(`
          INSERT INTO solicitudes
            (folio_id, folio_anio, folio_num, folio_custom, fecha, escuadrilla, cdte,
             observaciones, firma_nombre, firma_grado, firma_cargo, firma_img,
             items_json, total, es_historico, actualizado_en)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        `).bind(
          folio_id, folio_anio || '', folio_num || '', folio_custom || null, fecha || '',
          escuadrilla || '', cdte || '', observaciones || '',
          firma_nombre || '', firma_grado || '', firma_cargo || '', firma_img || '',
          JSON.stringify(items || []), total || 0, es_historico ? 1 : 0
        ).run();

        return new Response(JSON.stringify({ ok: true, folio_id }), { headers: JSON_HEADERS });
      }

      // ── GET /solicitudes — pull completo (restaurar en otro dispositivo) ──
      if (path === '/solicitudes' && method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT * FROM solicitudes ORDER BY actualizado_en DESC`
        ).all();

        const data = results.map(r => ({
          ...r,
          items: JSON.parse(r.items_json || '[]'),
          es_historico: !!r.es_historico
        }));

        return new Response(JSON.stringify({ ok: true, data }), { headers: JSON_HEADERS });
      }

      // ── DELETE /solicitudes/:id ──
      if (path.startsWith('/solicitudes/') && method === 'DELETE') {
        const folioId = decodeURIComponent(path.split('/solicitudes/')[1]);
        await env.DB.prepare(`DELETE FROM solicitudes WHERE folio_id = ?`).bind(folioId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
      }

      // ── GET /config ──
      if (path === '/config' && method === 'GET') {
        const { results } = await env.DB.prepare(`SELECT clave, valor FROM configuracion`).all();
        const cfg = {};
        results.forEach(r => { cfg[r.clave] = r.valor; });
        return new Response(JSON.stringify(cfg), { headers: JSON_HEADERS });
      }

      return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), { status: 404, headers: JSON_HEADERS });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
    }
  }
};
