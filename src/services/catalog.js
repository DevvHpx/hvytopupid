// ============================================================
// Catalog queries. Every read the UI performs goes through here,
// so the site is driven entirely by the database.
// ============================================================
import { all, get } from '../db/index.js';
import { parseJson } from '../utils/helpers.js';

export function getCategories() {
  return all(`SELECT * FROM categories WHERE status='active' ORDER BY sort_order`);
}

export function getGames({ category = '', q = '', popular = false, limit = 0 } = {}) {
  const where = [`g.status='active'`];
  const params = [];
  if (category) { where.push(`c.slug = ?`); params.push(category); }
  if (q) {
    where.push(`(LOWER(g.name) LIKE ? OR LOWER(g.publisher) LIKE ?)`);
    params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
  }
  if (popular) where.push(`g.popular = 1`);
  let sql = `SELECT g.*, c.name AS category_name, c.slug AS category_slug,
                    (SELECT MIN(price) FROM products p WHERE p.game_id=g.id AND p.status='active') AS min_price
             FROM games g LEFT JOIN categories c ON c.id = g.category_id
             WHERE ${where.join(' AND ')}
             ORDER BY g.popular DESC, g.sort_order ASC`;
  if (limit) { sql += ` LIMIT ?`; params.push(limit); }
  return all(sql, params).map(hydrateGame);
}

export function getGameBySlug(slug) {
  const row = get(`SELECT g.*, c.name AS category_name, c.slug AS category_slug
                   FROM games g LEFT JOIN categories c ON c.id=g.category_id
                   WHERE g.slug=?`, [slug]);
  return row ? hydrateGame(row) : null;
}

export function getProducts(gameId) {
  return all(`SELECT * FROM products WHERE game_id=? AND status!='inactive'
              ORDER BY sort_order ASC`, [gameId]);
}

export function getProduct(id) {
  return get('SELECT * FROM products WHERE id=?', [id]);
}

export function getPaymentMethods({ onlyConfigured = false } = {}) {
  const rows = all(`SELECT * FROM payment_methods WHERE status='active' ORDER BY sort_order`);
  return onlyConfigured ? rows.filter((r) => r.config_status === 'configured') : rows;
}

export function getPaymentMethod(code) {
  return get('SELECT * FROM payment_methods WHERE code=?', [code]);
}

export function getPromos(limit = 0) {
  let sql = `SELECT * FROM promos WHERE status='active' ORDER BY sort_order`;
  if (limit) sql += ` LIMIT ${Number(limit)}`;
  return all(sql);
}

export function getFaqs() {
  return all(`SELECT * FROM faqs WHERE status='active' ORDER BY sort_order`);
}

export function getSettings() {
  const rows = all('SELECT key,value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function hydrateGame(row) {
  return { ...row, id_fields: parseJson(row.id_fields, []) };
}
