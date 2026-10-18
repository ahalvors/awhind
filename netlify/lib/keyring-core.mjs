// KeyRing core: pure helpers (validation, provider detection, grading).
// No network access in this file so it can be unit tested offline.
import { domainToASCII } from 'node:url';
import net from 'node:net';

export const MAX_INPUT_LENGTH = 300;
export const MAX_DOMAIN_LENGTH = 253;
export const MAX_LABELS = 6;

// TLDs and suffixes that are internal, reserved, or otherwise never a public business site.
const BLOCKED_TLDS = new Set([
  'localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home', 'corp', 'private',
  'test', 'example', 'invalid', 'onion', 'arpa', 'alt', 'home.arpa', 'domain', 'workgroup'
]);
const BLOCKED_SUFFIXES = [
  'example.com', 'example.net', 'example.org', 'in-addr.arpa', 'ip6.arpa',
  'nip.io', 'sslip.io', 'xip.io', 'localtest.me', 'lvh.me'
];

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD_RE = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/**
 * Normalize and strictly validate a visitor-supplied domain.
 * Accepts "Example.com", "https://www.example.com/path", "example.com." and returns
 * { ok: true, domain: "example.com", host: "www.example.com" } or { ok: false, error }.
 */
export function validateDomain(input) {
  if (typeof input !== 'string') return { ok: false, error: 'Enter a domain name, like yourbusiness.com.' };
  let s = input.trim();
  if (!s) return { ok: false, error: 'Enter a domain name, like yourbusiness.com.' };
  if (s.length > MAX_INPUT_LENGTH) return { ok: false, error: 'That is too long to be a domain name.' };
  if (/[\s\u0000-\u001f\u007f\\]/.test(s)) return { ok: false, error: 'That doesn\u2019t look like a domain name.' };

  // Strip scheme, credentials, path, query, fragment.
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  if (s.includes('@')) return { ok: false, error: 'Enter a domain, not an email address or login.' };
  s = s.split(/[/?#]/)[0];
  if (/:/.test(s)) return { ok: false, error: 'Enter just the domain, without a port number.' };
  s = s.replace(/\.$/, '').toLowerCase();

  if (/^\[.*\]$/.test(s) || net.isIP(s)) return { ok: false, error: 'Enter a domain name, not an IP address.' };

  // Internationalized names -> punycode. domainToASCII returns '' on invalid input.
  const ascii = /^[\x00-\x7f]*$/.test(s) ? s : domainToASCII(s);
  if (!ascii) return { ok: false, error: 'That doesn\u2019t look like a domain name.' };
  if (ascii.length > MAX_DOMAIN_LENGTH) return { ok: false, error: 'That is too long to be a domain name.' };

  const labels = ascii.split('.');
  if (labels.length < 2) return { ok: false, error: 'Include the ending, like .com or .org.' };
  if (labels.length > MAX_LABELS) return { ok: false, error: 'That has too many parts to be a business domain.' };
  if (!labels.every((l) => LABEL_RE.test(l))) return { ok: false, error: 'That doesn\u2019t look like a domain name.' };
  const tld = labels[labels.length - 1];
  if (!TLD_RE.test(tld)) return { ok: false, error: 'That doesn\u2019t look like a public domain name.' };
  // All-numeric labels everywhere would be an IP in disguise (e.g. 127.0.0.1 split oddly).
  if (labels.every((l) => /^\d+$/.test(l.replace(/^xn--/, '')))) return { ok: false, error: 'Enter a domain name, not an IP address.' };
  if (BLOCKED_TLDS.has(tld) || BLOCKED_TLDS.has(labels.slice(-2).join('.'))) {
    return { ok: false, error: 'That is a private or reserved name. Enter a public website domain.' };
  }
  if (BLOCKED_SUFFIXES.some((suf) => ascii === suf || ascii.endsWith('.' + suf))) {
    return { ok: false, error: 'That is a reserved or test domain. Enter your business domain.' };
  }

  const domain = labels[0] === 'www' && labels.length > 2 ? labels.slice(1).join('.') : ascii;
  return { ok: true, domain, host: ascii };
}

/** Simple, strict-enough email check for lead capture. */
export function validateEmail(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (s.length < 6 || s.length > 254) return null;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(s)) return null;
  const host = s.split('@')[1].toLowerCase();
  const v = validateDomain(host);
  return v.ok ? s : null;
}

export function cleanName(input) {
  if (typeof input !== 'string') return null;
  const s = input.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length < 1 || s.length > 100) return null;
  return s;
}

// ---------- IP address safety ----------

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}
const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
].map(([base, bits]) => [ipv4ToInt(base), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

/** True only for globally routable unicast addresses. */
export function isPublicIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const n = ipv4ToInt(ip);
    return !V4_BLOCKS.some(([base, mask]) => ((n & mask) >>> 0) === base);
  }
  if (kind === 6) {
    const lower = ip.toLowerCase();
    if (lower.includes('.')) return false; // IPv4-mapped/compatible forms: refuse
    const first = parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xe000) !== 0x2000) return false; // only 2000::/3 global unicast
    if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) return false; // documentation
    if (/^2001:0{0,4}:/.test(lower)) return false; // Teredo 2001::/32
    if (lower.startsWith('2002:')) return false; // 6to4
    return true;
  }
  return false;
}

// ---------- provider detection ----------

const NS_PROVIDERS = [
  [/(^|\.)cloudflare\.com$/, 'Cloudflare'],
  [/(^|\.)domaincontrol\.com$/, 'GoDaddy'],
  [/awsdns-\d+\./, 'Amazon Route 53'],
  [/^ns-cloud-[a-z]\d\.googledomains\.com$/, 'Google Cloud DNS'],
  [/(^|\.)googledomains\.com$/, 'Google Domains (legacy)'],
  [/(^|\.)nsone\.net$/, 'NS1'],
  [/(^|\.)squarespacedns\.com$/, 'Squarespace'],
  [/(^|\.)wixdns\.net$/, 'Wix'],
  [/(^|\.)registrar-servers\.com$/, 'Namecheap'],
  [/(^|\.)azure-dns\.(com|net|org|info)$/, 'Microsoft Azure DNS'],
  [/(^|\.)dnsimple\.com$/, 'DNSimple'],
  [/(^|\.)digitalocean\.com$/, 'DigitalOcean'],
  [/(^|\.)linode\.com$/, 'Linode (Akamai)'],
  [/(^|\.)vercel-dns\.com$/, 'Vercel'],
  [/(^|\.)netlify\.com$/, 'Netlify'],
  [/(^|\.)worldnic\.com$/, 'Network Solutions'],
  [/(^|\.)name-services\.com$/, 'Enom (Tucows)'],
  [/(^|\.)hover\.com$/, 'Hover'],
  [/(^|\.)name\.com$/, 'Name.com'],
  [/(^|\.)ui-dns\.(com|org|de|biz)$/, 'IONOS'],
  [/(^|\.)dreamhost\.com$/, 'DreamHost'],
  [/(^|\.)bluehost\.com$/, 'Bluehost'],
  [/(^|\.)hostgator\.com$/, 'HostGator'],
  [/(^|\.)siteground\.net$/, 'SiteGround'],
  [/(^|\.)dns-parking\.com$|(^|\.)hostinger\.com$/, 'Hostinger'],
  [/(^|\.)wordpress\.com$/, 'WordPress.com'],
  [/(^|\.)shopify\.com$/, 'Shopify'],
  [/(^|\.)webflow\.com$/, 'Webflow'],
  [/(^|\.)ultradns\.(com|net|org|biz|info)$/, 'UltraDNS'],
  [/(^|\.)akam\.net$/, 'Akamai'],
  [/(^|\.)dynect\.net$/, 'Oracle Dyn'],
  [/(^|\.)prosites\.com$/, 'ProSites'],
  [/(^|\.)zoneedit\.com$/, 'ZoneEdit'],
  [/(^|\.)porkbun\.com$/, 'Porkbun'],
  [/(^|\.)gandi\.net$/, 'Gandi'],
  [/(^|\.)ovh\.net$/, 'OVHcloud'],
  [/(^|\.)inmotionhosting\.com$/, 'InMotion Hosting'],
  [/(^|\.)a2hosting\.com$/, 'A2 Hosting'],
  [/(^|\.)wpengine\.com$/, 'WP Engine'],
  [/(^|\.)secureserver\.net$/, 'GoDaddy']
];

const MX_PROVIDERS = [
  [/(^|\.)(google\.com|googlemail\.com)$/, 'Google Workspace'],
  [/(^|\.)outlook\.com$|(^|\.)office365\.us$/, 'Microsoft 365'],
  [/(^|\.)zoho\.(com|eu|in)$/, 'Zoho Mail'],
  [/(^|\.)protonmail\.ch$/, 'Proton Mail'],
  [/(^|\.)secureserver\.net$/, 'GoDaddy email'],
  [/(^|\.)emailsrvr\.com$/, 'Rackspace Email'],
  [/(^|\.)mimecast\.com$/, 'Mimecast'],
  [/(^|\.)pphosted\.com$|(^|\.)ppe-hosted\.com$/, 'Proofpoint'],
  [/(^|\.)barracudanetworks\.com$/, 'Barracuda'],
  [/(^|\.)icloud\.com$/, 'iCloud Mail'],
  [/(^|\.)messagingengine\.com$/, 'Fastmail'],
  [/(^|\.)yahoodns\.net$/, 'Yahoo'],
  [/(^|\.)improvmx\.com$/, 'ImprovMX (forwarding)'],
  [/(^|\.)titan\.email$/, 'Titan'],
  [/(^|\.)hostinger\.com$/, 'Hostinger email'],
  [/(^|\.)mailgun\.org$/, 'Mailgun'],
  [/(^|\.)registrar-servers\.com$/, 'Namecheap email'],
  [/(^|\.)ionos\.(com|de)$|(^|\.)1and1\.com$/, 'IONOS email'],
  [/(^|\.)mailspamprotection\.com$/, 'SiteGround email'],
  [/(^|\.)bluehost\.com$/, 'Bluehost email'],
  [/(^|\.)arsmtp\.com$|(^|\.)mxroute\.com$/, 'MXroute'],
  [/(^|\.)prosites\.com$/, 'ProSites']
];

export function providerFor(host, table) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  for (const [re, name] of table) if (re.test(h)) return name;
  // Fall back to the last two labels of the server name, e.g. ns1.hostco.net -> hostco.net
  const parts = h.split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : h || 'Unknown';
}
export const nsProvider = (h) => providerFor(h, NS_PROVIDERS);
export const mxProvider = (h) => providerFor(h, MX_PROVIDERS);

/** Infer the web host / platform from response headers and CNAME targets. */
export function inferWebHost(headers = {}, cnames = []) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(Array.isArray(v) ? v.join(',') : v).toLowerCase()]));
  const server = h['server'] || '';
  const powered = h['x-powered-by'] || '';
  const cn = cnames.map((c) => String(c).toLowerCase()).join(' ');
  let platform = null;
  let cdn = null;

  if (h['x-nf-request-id'] || server.includes('netlify') || /netlify\.(app|com)/.test(cn)) platform = 'Netlify';
  else if (h['x-vercel-id'] || server.includes('vercel') || /vercel-dns\.com|vercel\.app/.test(cn)) platform = 'Vercel';
  else if (h['x-wix-request-id'] || server.includes('pepyaka') || /wixdns\.net/.test(cn)) platform = 'Wix';
  else if (server.includes('squarespace') || /squarespace\.com/.test(cn)) platform = 'Squarespace';
  else if (h['x-shopid'] || h['x-shopify-stage'] || powered.includes('shopify') || /myshopify\.com|shopify\.com/.test(cn)) platform = 'Shopify';
  else if (/webflow\.(io|com)/.test(cn) || Object.keys(h).some((k) => k.startsWith('x-wf-'))) platform = 'Webflow';
  else if (h['x-github-request-id'] || /github\.io/.test(cn)) platform = 'GitHub Pages';
  else if (powered.includes('wp engine') || h['wpe-backend'] || /wpengine\.com/.test(cn)) platform = 'WP Engine';
  else if (h['x-kinsta-cache'] || /kinsta\.cloud/.test(cn)) platform = 'Kinsta';
  else if (h['x-pantheon-styx-hostname'] || /pantheonsite\.io/.test(cn)) platform = 'Pantheon';
  else if (h['x-ah-environment']) platform = 'Acquia';
  else if (/godaddysites\.com/.test(cn) || server.includes('dps/')) platform = 'GoDaddy Website Builder';
  else if (h['fly-request-id'] || /fly\.dev/.test(cn)) platform = 'Fly.io';
  else if (h['x-render-origin-server'] || /onrender\.com/.test(cn)) platform = 'Render';
  else if (/herokuapp\.com|herokudns\.com/.test(cn) || h['via']?.includes('vegur')) platform = 'Heroku';
  else if (/azurewebsites\.net/.test(cn) || h['x-azure-ref'] || h['x-ms-request-id']) platform = 'Microsoft Azure';
  else if (server.includes('google frontend') || server === 'gws' || /ghs\.googlehosted\.com/.test(cn)) platform = 'Google';
  else if (h['x-hostinger-datacenter'] || server.includes('hostinger')) platform = 'Hostinger';
  else if (h['x-siteground-optimizer'] || h['host-header']?.includes('siteground') ) platform = 'SiteGround';
  else if (/wordpress\.com|wp\.com/.test(cn) || h['x-ac']?.includes('dfw') ) platform = 'WordPress.com';
  else if (server.includes('owner')) platform = 'Owner.com';

  if (h['cf-ray'] || server === 'cloudflare') cdn = 'Cloudflare';
  else if (h['x-amz-cf-id'] || /cloudfront\.net/.test(cn)) cdn = 'Amazon CloudFront';
  else if (h['x-akamai-transformed'] || /akamaiedge\.net|edgekey\.net/.test(cn)) cdn = 'Akamai';
  else if (h['x-served-by']?.includes('cache-') || h['x-fastly-request-id'] || /fastly\.net/.test(cn)) cdn = 'Fastly';
  else if (h['x-sucuri-id']) cdn = 'Sucuri';

  if (!platform) {
    if (server.includes('litespeed')) platform = 'a LiteSpeed web host';
    else if (server.includes('nginx')) platform = 'an nginx server (host not identified)';
    else if (server.includes('apache')) platform = 'an Apache server (host not identified)';
    else if (server.includes('microsoft-iis')) platform = 'a Microsoft IIS server';
  }
  const label = platform && cdn && platform !== cdn ? `${platform}, behind ${cdn}` : platform || (cdn ? `Not identified, behind ${cdn}` : 'Not identified');
  return { platform, cdn, label };
}

// ---------- record parsing ----------

export function parseSpf(txtRecords = []) {
  const spf = txtRecords.filter((t) => /^v=spf1(\s|$)/i.test(t.trim()));
  if (spf.length === 0) return { status: 'missing' };
  if (spf.length > 1) return { status: 'multiple', records: spf };
  const rec = spf[0].trim();
  const all = (rec.match(/(^|\s)([+~?-]?)all(\s|$)/i) || [])[2];
  let qualifier = 'none';
  if (all !== undefined) qualifier = all === '' ? '+' : all;
  return { status: 'present', record: rec, all: qualifier };
}

export function parseDmarc(txtRecords = []) {
  const recs = txtRecords.filter((t) => /^v=DMARC1(\s*;|\s*$)/i.test(t.trim()));
  if (recs.length === 0) return { status: 'missing' };
  if (recs.length > 1) return { status: 'multiple', records: recs };
  const rec = recs[0].trim();
  const tags = Object.fromEntries(rec.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    return i === -1 ? [p.toLowerCase(), ''] : [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()];
  }));
  const p = (tags.p || '').toLowerCase();
  const pct = tags.pct ? Number(tags.pct) : 100;
  let status;
  if (p === 'reject' || p === 'quarantine') status = pct >= 100 ? 'enforced' : 'partial';
  else if (p === 'none') status = 'monitor';
  else status = 'invalid';
  return { status, policy: p || null, pct, rua: tags.rua || null, record: rec };
}

const REDACT_RE = /redact|privacy|private|proxy|withheld|not\s*disclosed|data\s*protected|gdpr|whoisguard|domains by proxy|identity protect|contact privacy|perfect privacy|statutory masking|on behalf of|anonymi[sz]ed|hidden|registration private|super privacy|see privacypost|whois agent|mask/i;

/** Pull the facts we use out of one or more RDAP domain responses (registry first). */
export function parseRdap(responses = []) {
  const out = { registrar: null, expires: null, registered: null, registrant: 'unknown', registrantName: null, status: [] };
  const vcardField = (ent, field) => {
    const arr = ent?.vcardArray?.[1];
    if (!Array.isArray(arr)) return null;
    const f = arr.find((x) => Array.isArray(x) && x[0] === field);
    const v = f?.[3];
    return Array.isArray(v) ? v.filter(Boolean).join(' ') : (typeof v === 'string' ? v : null);
  };
  const walk = (ents, fn) => {
    for (const e of ents || []) { fn(e); walk(e.entities, fn); }
  };
  let sawRegistrantEntity = false;
  let registrantVisible = false;
  let registrantRedacted = false;

  for (const r of responses) {
    if (!r || typeof r !== 'object') continue;
    for (const ev of r.events || []) {
      const a = String(ev.eventAction || '').toLowerCase();
      if (a === 'expiration' && !out.expires && ev.eventDate) out.expires = ev.eventDate;
      if (a === 'registration' && !out.registered && ev.eventDate) out.registered = ev.eventDate;
    }
    if (Array.isArray(r.status)) out.status = [...new Set([...out.status, ...r.status])];
    walk(r.entities, (e) => {
      const roles = (e.roles || []).map((x) => String(x).toLowerCase());
      if (roles.includes('registrar') && !out.registrar) {
        out.registrar = vcardField(e, 'fn') || vcardField(e, 'org') || null;
      }
      if (roles.includes('registrant')) {
        sawRegistrantEntity = true;
        const name = vcardField(e, 'fn');
        const org = vcardField(e, 'org');
        const remarks = (e.remarks || []).map((m) => [m.title, ...(m.description || [])].join(' ')).join(' ');
        const candidates = [name, org].filter((x) => x && x.trim());
        const meaningful = candidates.filter((x) => !REDACT_RE.test(x));
        if (meaningful.length && !REDACT_RE.test(remarks)) {
          registrantVisible = true;
          out.registrantName = out.registrantName || org || name;
        } else {
          registrantRedacted = true;
        }
      }
    });
    if (Array.isArray(r.redacted) && r.redacted.some((x) => /registrant/i.test(JSON.stringify(x)))) registrantRedacted = true;
  }
  if (registrantVisible) out.registrant = 'visible';
  else if (registrantRedacted || !sawRegistrantEntity) out.registrant = 'hidden';
  if (out.registrar) out.registrar = out.registrar.replace(/\s+/g, ' ').trim();
  return out;
}

// ---------- grading ----------

const DAY = 86400000;
export function daysUntil(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((t - now) / DAY);
}
export function fmtDate(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const LEVEL_RANK = { red: 3, yellow: 2, unknown: 1, green: 0 };

/**
 * Turn raw check facts into a plain-language graded report.
 * facts = { domain, rdap, ns, mx, spf, dmarc, web, errors }
 */
export function gradeReport(facts, now = Date.now()) {
  const issues = [];
  const fine = [];
  const notes = [];
  const add = (level, id, title, why, fix) => issues.push({ level, id, title, why, fix });
  const err = facts.errors || {};

  // 1. Domain registration / renewal
  const rdap = facts.rdap;
  if (err.rdap === 'not_found') {
    add('red', 'not-registered', 'We couldn\u2019t find a registration record for this domain',
      'Public registry records don\u2019t list this name. If it\u2019s your business domain, it may have lapsed or be registered under a different spelling.',
      'Double-check the spelling. If it\u2019s yours, log in to your registrar right away and confirm the domain is active.');
  } else if (!rdap || err.rdap) {
    notes.push('We couldn\u2019t reach the public registration records right now, so renewal date and registrar aren\u2019t included.');
  } else if (rdap.expires) {
    const d = daysUntil(rdap.expires, now);
    const when = fmtDate(rdap.expires);
    const reg = rdap.registrar ? ` through ${rdap.registrar}` : '';
    if (d !== null && d < 0) {
      add('red', 'expired', `Your web address expired on ${when}`,
        `The registry record says this domain expired${reg}. Your website and email at this address can stop working at any moment, and someone else could buy the name.`,
        'Log in to your registrar and renew it today. If you don\u2019t know who registered it, that\u2019s the first thing to find out.');
    } else if (d !== null && d <= 30) {
      add('red', 'expiring', `Your web address expires on ${when} (in ${d} day${d === 1 ? '' : 's'})`,
        `Your domain is registered${reg}. If it isn\u2019t renewed, your website and any email at this address stop working, and someone else could buy the name.`,
        'Find out who pays this renewal (you, your website company, or a past designer) and make sure auto-renew is on with a card you control. Public records can\u2019t show whether auto-renew is already on.');
    } else if (d !== null && d <= 90) {
      add('yellow', 'expiring', `Your web address expires on ${when} (in ${d} days)`,
        `Your domain is registered${reg}. If it isn\u2019t renewed, your website and any email at this address stop working, and someone else could buy the name.`,
        'Confirm who pays this renewal and that auto-renew is on with a card you control. Public records can\u2019t show whether auto-renew is already on.');
    } else if (d !== null) {
      fine.push(`Your domain is registered${reg} and doesn\u2019t expire until ${when}.`);
    }
  }

  // 2. Nameservers / DNS host
  const ns = facts.ns || [];
  const nsProviders = [...new Set(ns.map(nsProvider))];
  if (!err.ns) {
    if (ns.length === 0 && err.rdap !== 'not_found') {
      add('red', 'no-dns', 'Your domain has no working "phone book" (nameservers)',
        'Nameservers tell the internet where your website and email live. Without them, nothing at this address can be found.',
        'Ask whoever manages your domain to set nameservers at your registrar.');
    } else if (nsProviders.length > 1) {
      add('yellow', 'mixed-dns', 'Your domain\u2019s "phone book" points two different directions',
        `Your domain lists ${ns.length} nameservers from ${nsProviders.length} different companies (${nsProviders.join(' and ')}). Usually there\u2019s one. Mixed settings like this often happen after a move from one website company to another, and they can cause intermittent outages or email problems.`,
        'Ask your website or IT provider which set is correct, and remove the leftovers.');
    } else if (nsProviders.length === 1) {
      fine.push(`Your DNS (the domain\u2019s \u201cphone book\u201d) is hosted in one place: ${nsProviders[0]}.`);
    }
  }

  // 3. Email authentication
  const mx = facts.mx || [];
  const hasMail = mx.length > 0;
  const mailProviders = [...new Set(mx.map(mxProvider))];
  const spf = facts.spf || { status: 'unknown' };
  const dmarc = facts.dmarc || { status: 'unknown' };
  const emailChecked = !err.mx && !err.spf && !err.dmarc;

  if (emailChecked) {
    const recv = hasMail ? `You receive email at this domain through ${mailProviders.join(' and ')}, ` : 'This domain doesn\u2019t receive email, ';
    if (spf.status === 'missing' && dmarc.status === 'missing') {
      add(hasMail ? 'red' : 'yellow', 'spoofable', 'Anyone can send email pretending to be you',
        `${recv}but there are no SPF or DMARC records. Those records tell Gmail, Outlook and others which senders are really you. Without them, a scammer can send fake invoices or gift card requests \u201cfrom\u201d your business${hasMail ? ', and your own messages are more likely to land in spam' : ''}.`,
        hasMail
          ? 'Add one SPF record and one DMARC record. It takes about 15 minutes for whoever manages your DNS.'
          : 'Even a domain that never sends email should publish a \u201cno one sends from here\u201d SPF record and a DMARC reject policy. It takes a few minutes.');
    } else {
      if (spf.status === 'missing') {
        add('yellow', 'spf-missing', 'There\u2019s no list of who\u2019s allowed to send your email (SPF)',
          'An SPF record names the services allowed to send email as your domain. Without it, your real messages are more likely to land in spam and fakes are easier to pass off.',
          'Add one SPF record listing your email provider and any services that send for you (newsletters, invoicing).');
      } else if (spf.status === 'multiple') {
        add('yellow', 'spf-multiple', 'Your domain has two competing SPF records',
          'Email providers treat more than one SPF record as an error, which can cancel both. That makes your mail more likely to be rejected or marked as spam.',
          'Merge them into a single SPF record.');
      } else if (spf.status === 'present' && spf.all === '+') {
        add('red', 'spf-open', 'Your SPF record lets the whole internet send as you',
          'Your SPF record ends in \u201c+all\u201d, which tells receivers that any server anywhere is allowed to send your email. That defeats the point of having it.',
          'Change the ending to \u201c~all\u201d or \u201c-all\u201d after listing your real senders.');
      } else if (spf.status === 'present') {
        fine.push('You have an SPF record listing who may send email for you.');
      }

      if (dmarc.status === 'missing') {
        add('yellow', 'dmarc-missing', 'Nothing tells inboxes to block fake email from your domain (no DMARC)',
          'DMARC is the instruction that tells Gmail, Outlook and others what to do with email that claims to be from you but isn\u2019t. Without it, many fakes still get delivered.',
          'Add a DMARC record. Start in monitoring mode, then move to \u201cquarantine\u201d once your real senders are confirmed.');
      } else if (dmarc.status === 'monitor') {
        add('yellow', 'dmarc-none', 'Your email protection is set to watch, not block (DMARC p=none)',
          'You have a DMARC record, but it only monitors. Fake email using your name is still delivered.',
          'Review the DMARC reports, confirm your real senders, then change the policy to \u201cquarantine\u201d or \u201creject\u201d.');
      } else if (dmarc.status === 'partial') {
        add('yellow', 'dmarc-partial', 'Your email protection only applies to part of your mail',
          `Your DMARC policy is \u201c${dmarc.policy}\u201d but only for ${dmarc.pct}% of messages, so some fakes still get through.`,
          'Raise the percentage to 100 once you\u2019re confident in your real senders.');
      } else if (dmarc.status === 'multiple' || dmarc.status === 'invalid') {
        add('yellow', 'dmarc-broken', 'Your DMARC record isn\u2019t set up correctly',
          'Inboxes ignore a DMARC record that is duplicated or malformed, so it isn\u2019t protecting you.',
          'Replace it with a single, valid DMARC record.');
      } else if (dmarc.status === 'enforced') {
        fine.push(`Your DMARC policy is set to \u201c${dmarc.policy}\u201d, so inboxes are told to block fake email using your name.`);
      }
    }
    if (hasMail) {
      const solid = mailProviders.every((p) => /Google Workspace|Microsoft 365/.test(p));
      fine.push(`Email is on ${mailProviders.join(' and ')}${solid ? ', which is a solid provider' : ''}.`);
    }
  } else {
    notes.push('We couldn\u2019t finish the email checks right now.');
  }

  // 4. Website up + SSL
  const web = facts.web;
  if (web && web.skipped === 'private_ip') {
    add('yellow', 'private-ip', 'Your domain points to a private network address',
      'The website address resolves to an internal or reserved IP, so the public can\u2019t reach it. This is usually a DNS mistake.',
      'Ask whoever manages your DNS to point the domain at your real web host.');
  } else if (web && web.skipped === 'no_address') {
    add('red', 'site-down', 'Your website doesn\u2019t load',
      'Neither your domain nor its www version points to a web server, so visitors get an error instead of your site.',
      'Ask your website provider to check your DNS settings.');
  } else if (web && !web.up) {
    add('red', 'site-down', 'Your website didn\u2019t load securely when we checked',
      `We couldn\u2019t open https://${web.host || facts.domain}${web.reason ? ` (${web.reason})` : ''}. Visitors may see an error or a browser warning instead of your site.`,
      'Ask your website provider to check that the site is up and has a valid security certificate.');
  } else if (web && web.up) {
    const tls = web.tls || {};
    const d = tls.validTo ? daysUntil(tls.validTo, now) : null;
    if (tls.authorized === false) {
      add('red', 'ssl-invalid', 'Visitors see a security warning on your website',
        `Your site\u2019s security certificate isn\u2019t valid${tls.error ? ` (${humanTlsError(tls.error)})` : ''}. Browsers show a full-page warning, and most people leave.`,
        'Ask your web host to install a valid certificate. Most hosts do this free and automatically.');
    } else if (d !== null && d <= 7) {
      add('red', 'ssl-expiring', `Your website\u2019s security certificate expires in ${Math.max(d, 0)} day${d === 1 ? '' : 's'}`,
        'Certificates that renew automatically usually do so weeks ahead. One this close to expiring suggests renewal is failing, and browsers will warn visitors once it lapses.',
        'Ask your web host to check certificate auto-renewal today.');
    } else if (d !== null && d <= 21) {
      add('yellow', 'ssl-expiring', `Your website\u2019s security certificate expires on ${fmtDate(tls.validTo)}`,
        'Automatic certificates normally renew well before this point, so it may be worth confirming renewal is working. If it lapses, browsers warn visitors away.',
        'Ask your web host to confirm the certificate renews automatically.');
    } else if (d !== null) {
      fine.push(`The website is up and loads securely (security certificate valid through ${fmtDate(tls.validTo)}).`);
    } else {
      fine.push('The website is up and loads securely.');
    }
  } else {
    notes.push('We couldn\u2019t finish the website check right now.');
  }

  // 5. One vendor controls everything (only for builder/agency vendors, not big neutral providers)
  const webPlatform = web?.host_info?.platform || null;
  const neutral = /Google|Microsoft|Cloudflare|Amazon|Azure/;
  if (nsProviders.length === 1 && webPlatform && mailProviders.length === 1) {
    const v = nsProviders[0];
    const sameWeb = webPlatform.toLowerCase().includes(v.toLowerCase().split(' ')[0]);
    const sameMail = mailProviders[0].toLowerCase().includes(v.toLowerCase().split(' ')[0]);
    if (sameWeb && sameMail && !neutral.test(v)) {
      add('yellow', 'single-vendor', `One company holds the keys to everything (${v})`,
        `${v} runs your DNS, your email and your website. That\u2019s convenient until you want to leave, change designers, or they have an outage, and then everything moves (or stops) at once.`,
        'Make sure you have your own login to the domain registration, and know how to export your email and site if you ever switch.');
    }
  }

  if (rdap && !err.rdap) {
    if (rdap.registrant === 'visible') {
      notes.push(`Public records list the domain owner as \u201c${rdap.registrantName}\u201d. Make sure that\u2019s your business and not a former designer or agency.`);
    } else {
      notes.push('The owner details on your domain are privacy-protected, so public records can\u2019t show whose name it\u2019s in. If a past designer or agency registered it, they may legally own it. Confirming takes a few minutes with your registrar login.');
    }
  }

  issues.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
  const counts = { red: 0, yellow: 0, green: fine.length };
  for (const i of issues) if (i.level in counts) counts[i.level]++;
  const overall = counts.red ? 'red' : counts.yellow ? 'yellow' : 'green';

  const holders = [
    { piece: 'Domain registration', company: rdap?.registrar || 'Unknown', yours: rdap?.registrant === 'visible' ? `Listed as \u201c${rdap.registrantName}\u201d` : 'Unknown (owner details are privacy-protected)' },
    { piece: 'DNS', company: nsProviders.length ? nsProviders.join(' + ') + (nsProviders.length > 1 ? ' (mixed)' : '') : 'Unknown', yours: 'Unknown' },
    { piece: 'Website', company: web?.host_info?.label || 'Unknown', yours: 'Unknown' },
    { piece: 'Email', company: hasMail ? mailProviders.join(' + ') : 'No email at this domain', yours: 'Unknown' }
  ];

  return { domain: facts.domain, overall, counts, issues, fine, notes, holders };
}

export function humanTlsError(code) {
  const map = {
    CERT_HAS_EXPIRED: 'it has expired',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'it is self-signed',
    SELF_SIGNED_CERT_IN_CHAIN: 'it is self-signed',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'the certificate chain is incomplete',
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'the certificate chain is incomplete',
    ERR_TLS_CERT_ALTNAME_INVALID: 'it was issued for a different name',
    CERT_NOT_YET_VALID: 'it isn\u2019t valid yet'
  };
  return map[code] || 'it failed validation';
}

/** The instant summary shown before lead capture: headline-level only. */
export function summarize(report) {
  return {
    domain: report.domain,
    overall: report.overall,
    counts: report.counts,
    issues: report.issues.map((i) => ({ level: i.level, title: i.title })),
    fineCount: report.fine.length
  };
}
