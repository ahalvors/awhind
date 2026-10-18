// POST /api/keyring/report  { domain, name, email, company? }  -> full report, lead delivered to AWH
import { validateDomain, validateEmail, cleanName } from '../lib/keyring-core.mjs';
import { runAudit } from '../lib/keyring-checks.mjs';
import { rateLimit, json, readJson, sameOrigin, deliverLead } from '../lib/keyring-guard.mjs';

export const config = { path: '/api/keyring/report' };

export default async function handler(req, context) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden.' }, 403);
  const { body, error } = await readJson(req, 2048);
  if (error) return error;
  if (body.website) return json({ error: 'Something went wrong. Please try again.' }, 400); // honeypot
  const v = validateDomain(body.domain);
  if (!v.ok) return json({ error: v.error }, 400);
  const name = cleanName(body.name);
  if (!name) return json({ error: 'Please enter your name.' }, 400);
  const email = validateEmail(body.email);
  if (!email) return json({ error: 'Please enter a valid email address.' }, 400);
  const company = body.company ? cleanName(body.company) : null;
  const limited = await rateLimit('report', context?.ip);
  if (limited) return limited;

  let report;
  try {
    report = await runAudit(v.domain);
  } catch (e) {
    console.error('[keyring-report] audit failed', e?.name || 'error');
    return json({ error: 'We couldn\u2019t finish the check. Please try again in a minute.' }, 502);
  }
  const lead = {
    kind: 'report',
    name, email, company,
    domain: v.domain,
    site: new URL(req.url).host,
    createdAt: new Date().toISOString(),
    report: { overall: report.overall, counts: report.counts, issues: report.issues.map((i) => ({ level: i.level, title: i.title })), facts: report.facts }
  };
  const delivery = await deliverLead(lead);
  const { facts, ...publicReport } = report;
  return json({ report: publicReport, leadId: lead.id, received: delivery.stored || delivery.emailed });
}
