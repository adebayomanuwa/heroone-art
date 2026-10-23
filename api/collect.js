// POST /api/collect — receives batched listening + visit events from the site.
import { env, configured, originAllowed, isBot, geo, ipHash, client, clip, insertEvents, send, readJson } from './_lib.js';

const TYPES = new Set(['pageview', 'play', 'stream_30s', 'q25', 'q50', 'q75', 'complete', 'pause', 'seek', 'stop']);
const TRACKS = /^[a-z0-9-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v) => (Number.isFinite(+v) && +v >= 0 && +v < 86400 ? Math.round(+v * 10) / 10 : null);

function hostOf(ref) {
  try { return new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' }, { Allow: 'POST' });
  if (!originAllowed(req)) return send(res, 403, { error: 'forbidden' });
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) return send(res, 204);
  if (!configured()) return send(res, 202, { stored: false, reason: 'analytics not configured' });

  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { error: 'bad payload' }); }
  const list = Array.isArray(body?.events) ? body.events.slice(0, 50) : [];
  const ctx = body?.ctx || {};
  const where = geo(req);
  const who = client(ua);
  const hash = ipHash(req);
  const ownHosts = new Set(env.origins.map((h) => h.replace(/^www\./, '')));

  const rows = [];
  for (const e of list) {
    if (!e || !TYPES.has(e.type)) continue;
    const track = e.track && TRACKS.test(e.track) ? e.track : null;
    if (e.type !== 'pageview' && !track) continue;
    const ref = clip(e.referrer || ctx.referrer, 500);
    let refHost = hostOf(ref);
    if (refHost && ownHosts.has(refHost)) refHost = null;           // internal navigation is not a source
    rows.push({
      ts: Number.isFinite(e.at) && Math.abs(Date.now() - e.at) < 6 * 3600e3 ? new Date(e.at).toISOString() : undefined,
      type: e.type,
      track_id: track,
      listen_id: e.listen && UUID.test(e.listen) ? e.listen : null,
      session_id: clip(ctx.sid, 64),
      visitor_id: clip(ctx.vid, 64),
      ip_hash: hash,
      position_s: num(e.pos),
      listened_s: num(e.listened),
      page: clip(e.page || ctx.page, 200),
      referrer: refHost ? ref : null,
      referrer_host: refHost,
      utm_source: clip(ctx.utm_source, 80),
      utm_medium: clip(ctx.utm_medium, 80),
      utm_campaign: clip(ctx.utm_campaign, 120),
      country: where.country, region: where.region, city: where.city,
      timezone: clip(ctx.tz, 60),
      lang: clip(ctx.lang, 20),
      device: who.device, os: who.os, browser: who.browser,
      screen: clip(ctx.screen, 20),
    });
  }
  // PostgREST requires identical keys across rows in a bulk insert
  for (const r of rows) if (r.ts === undefined) r.ts = new Date().toISOString();

  try {
    await insertEvents(rows);
    return send(res, 204);
  } catch (err) {
    console.error(err);
    return send(res, 502, { error: 'store failed' });
  }
}
