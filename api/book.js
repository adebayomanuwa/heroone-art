// POST /api/book: a booking request from the 3nity Auracle chat.
// Saved privately (heroone.bookings, readable only in /studio). The chat also hands
// the visitor the same request as a ready-made email, so nothing depends on this route.
import { configured, originAllowed, isBot, geo, clip, supabase, send, readJson } from './_lib.js';

const DESKS = new Set(['booking', 'management']);
const TOPICS = new Set(['performance', 'feature', 'production', 'sync', 'press', 'management', 'other']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' }, { Allow: 'POST' });
  if (!originAllowed(req)) return send(res, 403, { error: 'forbidden' });
  if (isBot(req.headers['user-agent'] || '')) return send(res, 403, { error: 'forbidden' });
  if (!configured()) return send(res, 503, { error: 'not configured' });

  let b;
  try { b = await readJson(req); } catch { return send(res, 400, { error: 'bad request' }); }
  if (b.website) return send(res, 204);                              // honeypot
  const row = {
    topic: TOPICS.has(b.topic) ? b.topic : 'other',
    topic_label: clip(b.topic_label, 80),
    desk: DESKS.has(b.desk) ? b.desk : 'booking',
    name: clip(b.name, 120),
    email: clip(b.email, 200),
    when_where: clip(b.when, 200),
    message: clip(b.message, 1200),
    page: clip(b.page, 200),
    country: geo(req).country,
  };
  if (!row.name || !row.email || !EMAIL.test(row.email) || !row.message || row.message.length < 8) {
    return send(res, 422, { error: 'missing fields' });
  }
  const r = await supabase('/rest/v1/rpc/heroone_log_booking', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ p_row: row }) });
  if (!r.ok) return send(res, 502, { error: 'could not save' });
  return send(res, 201, { ok: true });
}
