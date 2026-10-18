// POST /api/keyring/scan  { domain }  -> instant summary (headlines only)
import { validateDomain, summarize } from '../lib/keyring-core.mjs';
import { runAudit } from '../lib/keyring-checks.mjs';
import { rateLimit, json, readJson, sameOrigin } from '../lib/keyring-guard.mjs';

export const config = { path: '/api/keyring/scan' };

export default async function handler(req, context) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden.' }, 403);
  const { body, error } = await readJson(req, 1024);
  if (error) return error;
  const v = validateDomain(body.domain);
  if (!v.ok) return json({ error: v.error }, 400);
  const limited = await rateLimit('scan', context?.ip);
  if (limited) return limited;
  try {
    const report = await runAudit(v.domain);
    return json({ summary: summarize(report) });
  } catch (e) {
    console.error('[keyring-scan] audit failed', e?.name || 'error');
    return json({ error: 'We couldn\u2019t finish the check. Please try again in a minute.' }, 502);
  }
}
