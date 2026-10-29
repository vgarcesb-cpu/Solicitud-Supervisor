-- ═══════════════════════════════════════════════════════
-- schema.sql — Solicitud Adquisición Supervisor (AGA FACH)
-- D1 Database: solicitud-supervisor-db
-- Modelo: HÍBRIDO offline-first — D1 es respaldo, no fuente de verdad
-- ⚠️ Ejecutar UNA instrucción a la vez en D1 Console
-- ═══════════════════════════════════════════════════════

-- Tabla principal: respaldo de solicitudes (espejo del localStorage)
CREATE TABLE IF NOT EXISTS solicitudes (
  folio_id         TEXT PRIMARY KEY,
  folio_anio       TEXT NOT NULL,
  folio_num        TEXT NOT NULL,
  folio_custom     TEXT,
  fecha            TEXT NOT NULL,
  escuadrilla      TEXT,
  cdte             TEXT,
  observaciones    TEXT,
  firma_nombre     TEXT,
  firma_grado      TEXT,
  firma_cargo      TEXT,
  firma_img        TEXT,
  items_json       TEXT NOT NULL DEFAULT '[]',
  total             REAL DEFAULT 0,
  es_historico      INTEGER DEFAULT 0,
  uid               TEXT,
  creado_en         TEXT DEFAULT (datetime('now')),
  actualizado_en    TEXT DEFAULT (datetime('now'))
);

-- MIGRACIÓN v1.4 (29-oct-2026) — solo en una base creada antes de esa fecha.
-- Ejecutar sola, una vez, en D1 Console. No modifica los datos existentes:
-- ALTER TABLE solicitudes ADD COLUMN uid TEXT;

-- Configuración del sistema (contador de folio centralizado, opcional)
CREATE TABLE IF NOT EXISTS configuracion (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  clave          TEXT UNIQUE NOT NULL,
  valor          TEXT,
  actualizado_en TEXT DEFAULT (datetime('now'))
);

-- Datos iniciales
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
  ('institucion_nombre', 'Fuerza Aérea de Chile (FACH)'),
  ('unidad_nombre',      'Academia de Guerra Aérea'),
  ('responsable_nombre', 'Victor Manuel Garces Borje'),
  ('api_worker_url',     'https://solicitud-supervisor-worker.vgarcesb.workers.dev');
