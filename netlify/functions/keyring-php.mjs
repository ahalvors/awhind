// POST /api/keyring/php  { domain }  -> standalone PHP version check (public signals only)
import { validateDomain } from '../lib/keyring-core.mjs';
import { phpAudit } from '../lib/keyring-checks.mjs';
import { rateLimit, json, readJson, sameOrigin } from '../lib/keyring-guard.mjs';

export const config = { path: '/api/keyring/php' };

export default async function handler(req, context) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden.' }, 403);
  const { body, error } = await readJson(req, 1024);
  if (error) return error;
  const v = validateDomain(body.domain);
  if (!v.ok) return json({ error: v.error }, 400);
  const limited = await rateLimit('php', context?.ip);
  if (limited) return limited;
  try {
    return json({ result: await phpAudit(v.domain) });
  } catch (e) {
    console.error('[keyring-php] check failed', e?.name || 'error');
    return json({ error: 'We couldn\u2019t finish the check. Please try again in a minute.' }, 502);
  }
}
