// KeyRing request guards (rate limits) and lead delivery.
import { createHash, randomUUID } from 'node:crypto';

const memory = new Map(); // per-instance fallback when Netlify Blobs isn't available

async function getBlobStore(name) {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore({ name, consistency: 'strong' });
  } catch {
    return null;
  }
}

export function hashIp(ip) {
  const salt = process.env.KEYRING_IP_SALT || 'awhind-keyring';
  return createHash('sha256').update(`${salt}:${ip || 'unknown'}`).digest('hex').slice(0, 24);
}

export const LIMITS = {
  scan: { perIpHour: 10, globalDay: 300 },
  report: { perIpHour: 4, globalDay: 100 },
  intent: { perIpHour: 6, globalDay: 150 }
};

async function bump(store, key, ttlMs) {
  const now = Date.now();
  if (store) {
    try {
      const cur = await store.get(key, { type: 'json' });
      const n = (cur && cur.exp > now ? cur.n : 0) + 1;
      await store.setJSON(key, { n, exp: cur && cur.exp > now ? cur.exp : now + ttlMs });
      return n;
    } catch { /* fall through to memory */ }
  }
  const cur = memory.get(key);
  const n = (cur && cur.exp > now ? cur.n : 0) + 1;
  memory.set(key, { n, exp: cur && cur.exp > now ? cur.exp : now + ttlMs });
  if (memory.size > 5000) for (const [k, v] of memory) if (v.exp <= now) memory.delete(k);
  return n;
}

/** Returns null when allowed, or a Response (429) when over the limit. */
export async function rateLimit(kind, ip) {
  const lim = LIMITS[kind];
  const store = await getBlobStore('keyring-ratelimit');
  const hour = Math.floor(Date.now() / 3600000);
  const day = Math.floor(Date.now() / 86400000);
  const [ipCount, globalCount] = await Promise.all([
    bump(store, `${kind}/ip/${hashIp(ip)}/${hour}`, 3600000),
    bump(store, `${kind}/global/${day}`, 86400000)
  ]);
  if (ipCount > lim.perIpHour) {
    return json({ error: 'You\u2019ve run a lot of checks in a short time. Please try again in an hour.' }, 429, { 'retry-after': '3600' });
  }
  if (globalCount > lim.globalDay) {
    return json({ error: 'KeyRing is very busy right now. Please try again tomorrow, or email us and we\u2019ll run it for you.' }, 429, { 'retry-after': '43200' });
  }
  return null;
}

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra
    }
  });
}

/** Parse a small JSON body; refuses anything large or non-JSON. */
export async function readJson(req, maxBytes = 4096) {
  if (req.method !== 'POST') return { error: json({ error: 'Use POST.' }, 405, { allow: 'POST' }) };
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return { error: json({ error: 'Expected JSON.' }, 415) };
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) return { error: json({ error: 'Request too large.' }, 413) };
  const text = await req.text();
  if (text.length > maxBytes) return { error: json({ error: 'Request too large.' }, 413) };
  try { return { body: JSON.parse(text) || {} }; } catch { return { error: json({ error: 'Invalid JSON.' }, 400) }; }
}

/** Reject cross-site form posts from other origins (browsers send Origin on POST). */
export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const self = new URL(req.url);
    return o.host === self.host || o.hostname === 'awhind.com' || o.hostname.endsWith('--awhind.netlify.app') || o.hostname === 'awhind.netlify.app';
  } catch { return false; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function leadEmail(lead) {
  const r = lead.report;
  const lines = [
    `New KeyRing ${lead.kind === 'intent' ? 'follow-up request' : 'lead'} from awhind.com/keyring/`,
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Domain: ${lead.domain}`,
    lead.intent ? `Asked for: ${lead.intent === 'fix' ? 'AWH to fix the issues' : 'AWH monitoring'}` : null,
    r ? `Overall: ${r.overall.toUpperCase()} (${r.counts.red} red, ${r.counts.yellow} yellow, ${r.counts.green} fine)` : null,
    '',
    ...(r ? r.issues.map((i) => `[${i.level.toUpperCase()}] ${i.title}`) : []),
    '',
    `Lead id: ${lead.id}`,
    `Site: ${lead.site}`
  ].filter((l) => l !== null);
  const subject = lead.kind === 'intent'
    ? `KeyRing: ${lead.name} wants AWH to ${lead.intent === 'fix' ? 'fix' : 'monitor'} ${lead.domain}`
    : `KeyRing lead: ${lead.domain} (${r ? r.overall.toUpperCase() : 'n/a'}) \u2014 ${lead.name}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${lines.map((l) => (l ? esc(l) : '&nbsp;')).join('<br>')}</div>`;
  return { subject: subject.slice(0, 200), text: lines.join('\n'), html };
}

/**
 * Store the lead (Netlify Blobs, store "keyring-leads") and email it to the AWH inbox
 * when RESEND_API_KEY + KEYRING_FROM_EMAIL are configured. Never emails the visitor.
 */
export async function deliverLead(lead) {
  const result = { stored: false, emailed: false, emailConfigured: false };
  lead.id = lead.id || `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const store = await getBlobStore('keyring-leads');
  if (store) {
    try { await store.setJSON(lead.id, lead); result.stored = true; } catch (e) { console.error('[keyring] lead store failed'); }
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.KEYRING_FROM_EMAIL;
  const to = process.env.KEYRING_LEAD_TO || 'info@awhind.com';
  if (key && from) {
    result.emailConfigured = true;
    const { subject, text, html } = leadEmail(lead);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to], reply_to: lead.email, subject, text, html }),
        signal: AbortSignal.timeout(5000)
      });
      result.emailed = res.ok;
      if (!res.ok) console.error(`[keyring] lead email failed: HTTP ${res.status}`);
    } catch {
      console.error('[keyring] lead email request failed');
    }
  } else {
    console.warn(`[keyring] RESEND_API_KEY/KEYRING_FROM_EMAIL not set; lead ${result.stored ? 'stored in Netlify Blobs (keyring-leads) only' : 'NOT stored or emailed'}`);
  }
  return result;
}
