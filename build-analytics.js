#!/usr/bin/env node
// Injects AWH's GA4 tag into pages that carry the <!-- GA4 --> marker, using the
// GA4_MEASUREMENT_ID environment variable (set in Netlify). No ID -> no tag.
const fs = require('fs');

const PAGES = ['keyring/index.html', 'security-checklist/index.html'];
const id = (process.env.GA4_MEASUREMENT_ID || '').trim();
const valid = /^G-[A-Z0-9]{4,15}$/.test(id);

for (const page of PAGES) {
  if (!fs.existsSync(page)) continue;
  const html = fs.readFileSync(page, 'utf8');
  if (!html.includes('<!-- GA4 -->')) continue;
  const tag = valid
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`
    : '';
  fs.writeFileSync(page, html.replace('<!-- GA4 -->', tag), 'utf8');
}
console.log(valid ? `GA4 tag injected (${id}) into ${PAGES.length} page(s)` : 'GA4_MEASUREMENT_ID not set or invalid; no analytics tag injected');
