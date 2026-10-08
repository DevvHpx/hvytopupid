// ============================================================
// Database connection + migration runner (SQLite via node:sqlite)
// ============================================================
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'hvytopupid.sqlite');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

// Apply schema (idempotent — uses CREATE TABLE IF NOT EXISTS)
export function migrate() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return DB_PATH;
}

// --- small helpers -------------------------------------------------
// Accept either an array (positional `?` params) or an object (named params).
function bind(method, sql, params) {
  const stmt = db.prepare(sql);
  if (params === undefined || params === null) return stmt[method]();
  return Array.isArray(params) ? stmt[method](...params) : stmt[method](params);
}
export function all(sql, params) { return bind('all', sql, params); }
export function get(sql, params) { return bind('get', sql, params); }
export function run(sql, params) { return bind('run', sql, params); }

export { DB_PATH };
