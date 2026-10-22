#!/usr/bin/env node
// Usage: node scripts/keyring-php.mjs wordpress.org php.net github.com [--json]
import { validateDomain } from '../netlify/lib/keyring-core.mjs';
import { phpAudit } from '../netlify/lib/keyring-checks.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const out = [];
for (const d of args.filter((a) => !a.startsWith('--'))) {
  const v = validateDomain(d);
  if (!v.ok) { out.push({ domain: d, level: 'error', finding: v.error }); continue; }
  out.push(await phpAudit(v.domain));
}
if (asJson) console.log(JSON.stringify(out, null, 2));
else for (const r of out) {
  console.log(`${r.domain.padEnd(24)} ${String(r.level).toUpperCase().padEnd(8)} ${r.finding}`);
  for (const s of r.signals || []) console.log(`${' '.repeat(34)}- ${s}`);
}
