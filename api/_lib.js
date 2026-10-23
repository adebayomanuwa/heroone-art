// Shared helpers for heroone.art server routes (Vercel Functions, Node 18+).
// Files starting with "_" are not exposed as routes.
import crypto from 'node:crypto';

export const env = {
  url: process.env.SUPABASE_URL?.replace(/\/$/, ''),
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  salt: process.env.IP_SALT || '',
  bucket: process.env.STREAM_BUCKET || 'heroone-streams',
  ttl: Math.min(Math.max(parseInt(process.env.STREAM_URL_TTL || '3600', 10) || 3600, 300), 21600),
  origins: (process.env.ALLOWED_ORIGINS || 'heroone.art,www.heroone.art')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
};

export const configured = () => Boolean(env.url && env.key);

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegrambot|discordbot|embedly|headless|lighthouse|pingdom|uptime/i;
export const isBot = (ua = '') => BOT.test(ua);

/** Requests must come from the site itself (or a Vercel preview / localhost while developing). */
export function originAllowed(req) {
  const raw = req.headers.origin || req.headers.referer || '';
  let host = '';
  try { host = new URL(raw).hostname.toLowerCase(); } catch { return false; }
  if (env.origins.includes(host)) return true;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  const self = (process.env.VERCEL_URL || '').toLowerCase();
  if (self && host === self) return true;
  if (process.env.VERCEL_ENV === 'preview' && host.endsWith('.vercel.app')) return true;
  return false;
}

function header(req, name) {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Location comes from Vercel's edge network headers (no IP lookups, no third parties). */
export function geo(req) {
  const dec = (v) => { try { return v ? decodeURIComponent(v) : null; } catch { return v || null; } };
  return {
    country: header(req, 'x-vercel-ip-country') || header(req, 'cf-ipcountry') || null,
    region: dec(header(req, 'x-vercel-ip-country-region')),
    city: dec(header(req, 'x-vercel-ip-city')),
  };
}

/** Salted, daily-rotating hash: counts unique listeners per day without storing an IP. */
export function ipHash(req) {
  const ip = (header(req, 'x-forwarded-for') || header(req, 'x-real-ip') || req.socket?.remoteAddress || '')
    .split(',')[0].trim();
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${env.salt}|${day}|${ip}`).digest('hex').slice(0, 32);
}

export function client(ua = '') {
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? 'tablet'
    : /mobi|iphone|ipod|android/i.test(ua) ? 'mobile' : 'desktop';
  const os = /windows/i.test(ua) ? 'Windows' : /iphone|ipad|ipod/i.test(ua) ? 'iOS'
    : /mac os x/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /linux/i.test(ua) ? 'Linux' : 'other';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera'
    : /samsungbrowser/i.test(ua) ? 'Samsung' : /chrome|crios/i.test(ua) ? 'Chrome'
    : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'other';
  return { device, os, browser };
}

export const clip = (v, n = 300) => (v == null ? null : String(v).slice(0, n));

export async function supabase(path, init = {}) {
  const res = await fetch(`${env.url}${path}`, {
    ...init,
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return res;
}

export async function insertEvents(rows) {
  if (!rows.length) return;
  // Tables live in the private `heroone` schema; the only way in is this function (service role only).
  const res = await supabase('/rest/v1/rpc/heroone_log_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ p_rows: rows }),
  });
  if (!res.ok) throw new Error(`events insert failed: ${res.status} ${await res.text()}`);
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error('payload too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
