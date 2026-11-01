#!/usr/bin/env node
// Injects AWH's GA4 tag into every published HTML page at build time.
// Single config point: GA4_ID below (a GA4_MEASUREMENT_ID env var overrides it).
// While GA4_ID is the placeholder, no tag is injected anywhere.
const fs = require('fs');
const path = require('path');

const GA4_ID = 'G-25EMLK6VCM';
const PLACEHOLDER = 'G-XXXXXXXXXX';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tests', 'drafts', 'netlify', 'content', 'scripts', 'screenshots', '.netlify', 'dl']);

function resolveId(env = process.env) {
  const id = String(env.GA4_MEASUREMENT_ID || GA4_ID).trim();
  return /^G-[A-Z0-9]{4,15}$/.test(id) && id !== PLACEHOLDER ? id : null;
}

function snippet(id) {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
}

function injectHtml(html, id) {
  const tag = id ? snippet(id) : '';
  if (html.includes('<!-- GA4 -->')) return html.replace('<!-- GA4 -->', tag);
  if (!id || html.includes('googletagmanager.com/gtag/js')) return html;
  const i = html.search(/<\/head>/i);
  return i === -1 ? html : html.slice(0, i) + tag + '\n' + html.slice(i);
}

function listPages(root) {
  const out = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) out.push(...listPages(p)); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function run(root = '.', env = process.env) {
  const id = resolveId(env);
  const pages = listPages(root);
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    const next = injectHtml(html, id);
    if (next !== html) fs.writeFileSync(p, next, 'utf8');
  }
  return { id, pages };
}

module.exports = { GA4_ID, PLACEHOLDER, resolveId, snippet, injectHtml, listPages, run };

if (require.main === module) {
  const { id, pages } = run();
  console.log(id ? `GA4 tag injected (${id}) into ${pages.length} page(s)` : 'GA4 ID is the placeholder or invalid; no analytics tag injected');
}
