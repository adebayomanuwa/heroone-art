// GET /api/stream?t=<track>&l=<listen uuid>&s=<session id>
// Issues a short-lived signed URL for a song kept in a PRIVATE Supabase bucket, and logs the request.
// The audio file itself is never public: no permanent link exists to share or download.
import { env, configured, originAllowed, isBot, geo, ipHash, client, clip, supabase, insertEvents, send } from './_lib.js';

const TRACKS = /^[a-z0-9-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' }, { Allow: 'GET' });
  if (!originAllowed(req)) return send(res, 403, { error: 'forbidden' });
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) return send(res, 403, { error: 'forbidden' });
  if (!configured()) return send(res, 503, { error: 'streaming not configured' });

  const q = new URL(req.url, 'http://x').searchParams;
  const id = q.get('t') || '';
  if (!TRACKS.test(id)) return send(res, 400, { error: 'unknown track' });

  // Catalogue lookup (lets you switch a song off in the database without redeploying)
  const tr = await supabase('/rest/v1/rpc/heroone_track', { method: 'POST', body: JSON.stringify({ p_id: id }) });
  if (!tr.ok) return send(res, 502, { error: 'catalogue unavailable' });
  const [track] = await tr.json();
  if (!track || !track.is_live) return send(res, 404, { error: 'unknown track' });

  const path = track.storage_path.split('/').map(encodeURIComponent).join('/');
  const sign = await supabase(`/storage/v1/object/sign/${env.bucket}/${path}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn: env.ttl }),
  });
  if (!sign.ok) return send(res, 502, { error: 'could not sign stream' });
  const { signedURL } = await sign.json();
  const url = `${env.url}/storage/v1${signedURL.startsWith('/') ? '' : '/'}${signedURL}`;

  const where = geo(req);
  const who = client(ua);
  try {
    await insertEvents([{
      ts: new Date().toISOString(),
      type: 'stream_url',
      track_id: id,
      listen_id: UUID.test(q.get('l') || '') ? q.get('l') : null,
      session_id: clip(q.get('s'), 64),
      visitor_id: null,
      ip_hash: ipHash(req),
      position_s: null, listened_s: null,
      page: clip(q.get('p'), 200),
      referrer: null, referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: null,
      country: where.country, region: where.region, city: where.city,
      timezone: null, lang: null,
      device: who.device, os: who.os, browser: who.browser, screen: null,
    }]);
  } catch (err) {
    console.error(err);                                  // logging must never block playback
  }
  return send(res, 200, { url, expires_in: env.ttl });
}
