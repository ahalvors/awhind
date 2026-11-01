import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ga = require('../build-analytics.js');
const ROOT = path.resolve(import.meta.dirname, '..');
const TEST_ID = 'G-TEST12345';

test('placeholder ID injects nothing', () => {
  assert.equal(ga.resolveId({}), ga.GA4_ID === ga.PLACEHOLDER ? null : ga.GA4_ID);
  assert.equal(ga.injectHtml('<head></head>', null), '<head></head>');
  assert.equal(ga.injectHtml('<head><!-- GA4 --></head>', null), '<head></head>');
  assert.equal(ga.resolveId({ GA4_MEASUREMENT_ID: 'bad' }), null);
});

test('inject is idempotent and goes in head', () => {
  const once = ga.injectHtml('<html><head><title>x</title></head><body></body></html>', TEST_ID);
  assert.ok(once.indexOf('gtag/js?id=' + TEST_ID) < once.indexOf('</head>'));
  assert.equal(ga.injectHtml(once, TEST_ID), once);
});

test('every built HTML page carries the gtag snippet with the configured ID', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'awhind-ga-'));
  try {
    fs.cpSync(ROOT, tmp, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(s) });
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
    execFileSync('npm', ['run', 'build', '--silent'], { cwd: tmp, env: { ...process.env, GA4_MEASUREMENT_ID: TEST_ID }, stdio: 'pipe' });
    const pages = ga.listPages(tmp);
    assert.ok(pages.length > 20, `found ${pages.length} pages`);
    assert.ok(pages.some((p) => p.includes(`${path.sep}articles${path.sep}`)), 'generated articles included');
    for (const p of pages) {
      const html = fs.readFileSync(p, 'utf8');
      assert.ok(html.includes(ga.snippet(TEST_ID)), `missing gtag: ${path.relative(tmp, p)}`);
      assert.equal(html.split('gtag/js?id=').length - 1, 1, `duplicate gtag: ${path.relative(tmp, p)}`);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
