import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKey } from '../netlify/functions/dl.mjs';
const S = 'abcdefghijklmnop_-QRSTUV';
test('page and file keys', () => {
  assert.deepEqual(resolveKey(`/dl/${S}/`), { key: `${S}/index.html`, ext: 'html' });
  assert.equal(resolveKey(`/dl/${S}/Pack.zip`).key, `${S}/Pack.zip`);
  assert.deepEqual(resolveKey(`/dl/${S}`), { redirect: `/dl/${S}/` });
});
test('rejects bad input', () => {
  for (const p of ['/dl', '/dl/', '/dl/short/', `/dl/${S}/../x.zip`, `/dl/${S}/a/b.zip`, `/dl/${S}/.env`, `/dl/${S}/x.exe`, '/dl/../../etc/']) assert.equal(resolveKey(p), null, p);
});
