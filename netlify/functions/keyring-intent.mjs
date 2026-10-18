// POST /api/keyring/intent  { domain, name, email, intent: "fix"|"monitor", leadId? }
import { validateDomain, validateEmail, cleanName } from '../lib/keyring-core.mjs';
import { rateLimit, json, readJson, sameOrigin, deliverLead } from '../lib/keyring-guard.mjs';

export const config = { path: '/api/keyring/intent' };

export default async function handler(req, context) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden.' }, 403);
  const { body, error } = await readJson(req, 2048);
  if (error) return error;
  const v = validateDomain(body.domain);
  const name = cleanName(body.name);
  const email = validateEmail(body.email);
  const intent = body.intent === 'fix' || body.intent === 'monitor' ? body.intent : null;
  if (!v.ok || !name || !email || !intent) return json({ error: 'Please run the check and enter your details first.' }, 400);
  const limited = await rateLimit('intent', context?.ip);
  if (limited) return limited;
  const leadId = typeof body.leadId === 'string' && /^[\w-]{10,80}$/.test(body.leadId) ? body.leadId : null;
  const delivery = await deliverLead({
    kind: 'intent', intent, name, email, domain: v.domain, relatedLead: leadId,
    site: new URL(req.url).host, createdAt: new Date().toISOString()
  });
  return json({ ok: delivery.stored || delivery.emailed });
}
