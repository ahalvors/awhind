#!/usr/bin/env node
// Normalizes social preview tags on every published HTML page (runs after build-briefings.js).
// Image choice: article hero (if it is a 1200x630 file) > per-page card from
// scripts/gen_og_cards.py (images/og/...) > images/og/default.png.
const fs = require('fs');
const path = require('path');
const { listPages } = require('./build-analytics.js');

const SITE = 'https://awhind.com';
const W = 1200, H = 630;
const DEFAULT = '/images/og/default.png';

function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.slice(1, 4).toString() === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return [0, 0];
}

function usable(root, urlPath) {
  const f = path.join(root, urlPath);
  if (!fs.existsSync(f)) return false;
  const [w, h] = imageSize(f);
  return w === W && h === H;
}

function heroes(root) {
  const p = path.join(root, 'content', 'articles.json');
  const map = {};
  if (fs.existsSync(p)) for (const a of JSON.parse(fs.readFileSync(p, 'utf8'))) if (a.featured_image) map[a.slug] = a.featured_image;
  return map;
}

function pickImage(root, rel, heroMap) {
  const parts = rel.split(path.sep);
  const candidates = [];
  if (parts[0] === 'articles' && parts.length === 3) {
    if (heroMap[parts[1]]) candidates.push(heroMap[parts[1]]);
    candidates.push(`/images/og/articles/${parts[1]}.png`);
  } else if (parts[0] === 'briefing' && parts.length === 3) {
    candidates.push(`/images/og/briefing/${parts[1]}.png`);
  }
  return candidates.find((c) => usable(root, c)) || DEFAULT;
}

const esc = (s) => s.replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const STRIP = /[ \t]*<meta\s+(?:property|name)="(?:og:image(?::[a-z_]+)?|twitter:image(?::alt)?|twitter:card|twitter:site)"[^>]*>\s*\n?/gi;

function apply(html, imageUrl, fallbackTitle) {
  if (!/<\/head>/i.test(html)) return html;
  const t = (html.match(/<meta property="og:title" content="([^"]*)"/) || html.match(/<title>([^<]*)<\/title>/) || [, fallbackTitle])[1];
  const alt = imageUrl.endsWith('/default.png') ? 'AWH Industries: practical AI, IT security and daily briefings' : `Preview card: ${t}`;
  const abs = SITE + imageUrl;
  const block = [
    `<meta property="og:image" content="${abs}">`,
    `<meta property="og:image:width" content="${W}">`,
    `<meta property="og:image:height" content="${H}">`,
    `<meta property="og:image:alt" content="${esc(alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@awhxtech">`,
    `<meta name="twitter:image" content="${abs}">`,
    `<meta name="twitter:image:alt" content="${esc(alt)}">`,
  ].join('\n');
  const stripped = html.replace(STRIP, '');
  const i = stripped.search(/<\/head>/i);
  return stripped.slice(0, i) + block + '\n' + stripped.slice(i);
}

function run(root = '.') {
  const heroMap = heroes(root);
  const pages = listPages(root);
  for (const p of pages) {
    const rel = path.relative(root, p);
    const html = fs.readFileSync(p, 'utf8');
    const next = apply(html, pickImage(root, rel, heroMap), 'AWHIND');
    if (next !== html) fs.writeFileSync(p, next, 'utf8');
  }
  return pages;
}

module.exports = { imageSize, pickImage, apply, run, W, H, DEFAULT, SITE };
if (require.main === module) console.log(`Social preview tags set on ${run().length} page(s)`);
