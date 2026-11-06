import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { listPages } = require('../build-analytics.js');
const ROOT = path.resolve(import.meta.dirname, '..');

// JSON.parse alone silently overwrites duplicate keys. After syntax validation,
// tokenize strings and containers to check decoded property names per object.
function parseUniqueJson(source) {
  const value = JSON.parse(source);
  const stack = [];
  const tokens = [...source.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]:]/g)].map(m => m[0]);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ':') {
      const key = JSON.parse(token);
      const keys = stack.at(-1);
      assert.ok(!keys.has(key), `Duplicate unique property: ${key}`);
      keys.add(key);
    }
  }
  return value;
}

function validatePages(root) {
  let blocks = 0;
  const types = new Set();
  for (const file of listPages(root)) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
      blocks++;
      try {
        types.add(parseUniqueJson(match[1])['@type']);
      } catch (error) {
        throw new Error(`${path.relative(root, file)}: ${error.message}`);
      }
    }
  }
  assert.ok(blocks > 0, 'must discover JSON-LD');
  assert.ok(types.has('Organization'));
  assert.ok(types.has('Article'));
  return blocks;
}

test('duplicate detection handles nested objects, escaped keys and valid repeated properties across entities', () => {
  assert.throws(() => parseUniqueJson('{"telephone":"a","telephone":"a"}'), /Duplicate unique property: telephone/);
  assert.throws(() => parseUniqueJson('{"publisher":{"name":"a","name":"b"}}'), /Duplicate unique property: name/);
  assert.throws(() => parseUniqueJson('{"name":"a","\\u006eame":"b"}'), /Duplicate unique property: name/);
  assert.throws(() => parseUniqueJson('{"name":}'), SyntaxError);
  assert.doesNotThrow(() => parseUniqueJson('{"author":{"name":"AWHIND"},"publisher":{"name":"AWHIND"},"items":[{"name":"a"},{"name":"b"}],"text":"braces {} and escaped quote \\""}'));
});

test('checked-in pages contain valid JSON-LD with unique object properties', () => {
  console.log(`Validated ${validatePages(ROOT)} checked-in JSON-LD blocks`);
});

test('full build preserves valid JSON-LD with unique object properties', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'awhind-schema-'));
  try {
    fs.cpSync(ROOT, tmp, { recursive: true, filter: s => !/[\\/](node_modules|\.git)([\\/]|$)/.test(s) });
    execFileSync('npm', ['run', 'build', '--silent'], { cwd: tmp, stdio: 'pipe' });
    console.log(`Validated ${validatePages(tmp)} built JSON-LD blocks`);
    const home = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    const schema = parseUniqueJson(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema.telephone, '+1-689-225-0286');
    assert.equal(schema['@type'], 'Organization');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
