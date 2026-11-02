import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const og = require('../build-og.js');
const { listPages } = require('../build-analytics.js');
const ROOT = path.resolve(import.meta.dirname, '..');

const TAGS = [
  ['property', 'og:image', 'url'], ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'],
  ['property', 'og:image:alt', 'text'], ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:site', '@awhxtech'],
  ['name', 'twitter:image', 'url'], ['name', 'twitter:image:alt', 'text'],
];

test('apply replaces old tags instead of duplicating', () => {
  const html = '<html><head><meta name="twitter:card" content="summary"><meta property="og:image" content="https://x/y.jpg"></head></html>';
  const once = og.apply(html, '/images/og/default.png', 'T');
  assert.equal(og.apply(once, '/images/og/default.png', 'T').match(/twitter:card/g).length, 1);
  assert.match(once, /summary_large_image/);
  assert.doesNotMatch(once, /x\/y\.jpg/);
});

test('every built page has exactly one of each social tag, pointing at real 1200x630 images', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'awhind-og-'));
  try {
    fs.cpSync(ROOT, tmp, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(s) });
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
    execFileSync('npm', ['run', 'build', '--silent'], { cwd: tmp, stdio: 'pipe' });
    const pages = listPages(tmp);
    assert.ok(pages.length > 20);
    let perPage = 0;
    for (const p of pages) {
      const html = fs.readFileSync(p, 'utf8');
      const rel = path.relative(tmp, p);
      for (const [attr, key, kind] of TAGS) {
        const re = new RegExp(`<meta\\s+${attr}="${key.replace(/:/g, ':')}"\\s+content="([^"]*)"`, 'g');
        const m = [...html.matchAll(re)];
        assert.equal(m.length, 1, `${rel}: ${key} x${m.length}`);
        const v = m[0][1];
        if (kind === 'url') {
          assert.match(v, /^https:\/\/awhind\.com\/images\/.+\.(png|jpe?g)$/, `${rel}: ${key}`);
          const file = path.join(tmp, new URL(v).pathname);
          assert.ok(fs.existsSync(file), `${rel}: missing ${v}`);
          assert.deepEqual(og.imageSize(file), [1200, 630], `${rel}: ${v} not 1200x630`);
          if (!v.endsWith('/default.png')) perPage++;
        } else if (kind === 'text') assert.ok(v.length > 3, `${rel}: empty ${key}`);
        else assert.equal(v, kind, `${rel}: ${key}`);
      }
      assert.equal((html.match(/name="twitter:card"/g) || []).length, 1, `${rel}: stray twitter:card`);
    }
    assert.ok(perPage > 50, 'articles and briefings use their own cards');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('committed card images are 1200x630 and under 300 KB', () => {
  const dir = path.join(ROOT, 'images', 'og');
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.png'));
  assert.ok(files.includes('default.png'));
  for (const f of files) {
    const p = path.join(dir, f);
    assert.deepEqual(og.imageSize(p), [1200, 630], f);
    assert.ok(fs.statSync(p).size < 300 * 1024, f);
  }
});
