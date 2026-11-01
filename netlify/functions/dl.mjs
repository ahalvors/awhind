// Private download delivery for /dl/*.
// Files live in the site-wide Netlify Blobs store "dl-files" (not in this repo),
// keyed as "<slug>/index.html" and "<slug>/<filename>". Unknown keys return 404.
// Site-wide blobs are not tied to a deploy, so they persist through future deploys.
import { getStore } from '@netlify/blobs';

export const config = { path: ['/dl', '/dl/*'] };

const BASE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

const TYPES = {
  html: 'text/html; charset=utf-8',
  zip: 'application/zip',
  pdf: 'application/pdf',
};

function notFound() {
  return new Response('Not found', { status: 404, headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}

export function resolveKey(pathname) {
  const rest = pathname.replace(/^\/dl\/?/, '');
  const parts = rest.split('/');
  const slug = parts[0];
  if (!slug || !/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return null;
  if (parts.length === 1) return { redirect: `/dl/${slug}/` };
  const file = parts.slice(1).join('/');
  if (file === '') return { key: `${slug}/index.html`, ext: 'html' };
  if (parts.length !== 2 || !/^[A-Za-z0-9._-]{1,128}$/.test(file) || file.startsWith('.')) return null;
  const ext = (file.split('.').pop() || '').toLowerCase();
  if (!TYPES[ext]) return null;
  return { key: `${slug}/${file}`, ext, file };
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return notFound();
  const r = resolveKey(new URL(req.url).pathname);
  if (!r) return notFound();
  if (r.redirect) return new Response(null, { status: 301, headers: { ...BASE_HEADERS, Location: r.redirect } });
  const data = await getStore('dl-files').get(r.key, { type: 'arrayBuffer' });
  if (!data) return notFound();
  const headers = { ...BASE_HEADERS, 'Content-Type': TYPES[r.ext], 'Content-Length': String(data.byteLength) };
  if (r.file) headers['Content-Disposition'] = `attachment; filename="${r.file}"`;
  return new Response(req.method === 'HEAD' ? null : data, { status: 200, headers });
}
