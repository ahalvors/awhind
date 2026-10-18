// KeyRing network checks. Outbound traffic is limited to:
//   - https://dns.google/resolve (DNS-over-HTTPS)
//   - https://rdap.org/domain/<name>, plus the HTTPS registry/registrar RDAP URLs that
//     rdap.org redirects to or the registry response links to (hostname validated,
//     resolved via dns.google to public IPs only)
//   - one HTTPS/TLS connection to the validated domain (or www.), pinned to an IP that
//     dns.google returned and that passed the public-IP check.
import https from 'node:https';
import { validateDomain, isPublicIp, parseSpf, parseDmarc, parseRdap, inferWebHost, gradeReport } from './keyring-core.mjs';

const UA = 'AWHIND-KeyRing/1.0 (+https://awhind.com/keyring/)';
const TYPE = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 };

function timeoutSignal(ms, deadline) {
  const left = deadline ? Math.max(200, deadline - Date.now()) : ms;
  return AbortSignal.timeout(Math.min(ms, left));
}

export async function doh(name, type, { deadline, timeout = 3000 } = {}) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: 'application/dns-json', 'user-agent': UA }, signal: timeoutSignal(timeout, deadline), redirect: 'error' });
  if (!res.ok) throw new Error(`doh_http_${res.status}`);
  const j = await res.json();
  if (j.Status === 3) return []; // NXDOMAIN
  if (j.Status !== 0) throw new Error(`doh_status_${j.Status}`);
  const want = TYPE[type];
  return (j.Answer || []).filter((a) => a.type === want).map((a) => String(a.data));
}

const unquoteTxt = (t) => t.replace(/^"|"$/g, '').replace(/"\s*"/g, '');

async function publicIps(host, opts) {
  const [a, aaaa] = await Promise.all([
    doh(host, 'A', opts).catch(() => []),
    doh(host, 'AAAA', opts).catch(() => [])
  ]);
  const all = [...a, ...aaaa];
  return { all, v4: a.filter(isPublicIp), v6: aaaa.filter(isPublicIp), anyPrivate: all.some((ip) => !isPublicIp(ip)) };
}

// ---------- RDAP ----------

async function safeRdapUrl(href, opts) {
  let u;
  try { u = new URL(href); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  if (!/\/domain\//i.test(u.pathname)) return null;
  const v = validateDomain(u.hostname);
  if (!v.ok || v.host !== u.hostname.toLowerCase()) return null;
  if (u.hostname === 'rdap.org') return u.toString();
  const ips = await publicIps(u.hostname, opts);
  if (ips.all.length === 0 || ips.anyPrivate) return null;
  return u.toString();
}

async function rdapFetch(url, opts, hops = 0) {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { accept: 'application/rdap+json, application/json', 'user-agent': UA },
    signal: timeoutSignal(opts.timeout || 4000, opts.deadline)
  });
  if (res.status >= 300 && res.status < 400) {
    if (hops >= 3) throw new Error('rdap_redirects');
    const next = await safeRdapUrl(new URL(res.headers.get('location') || '', url).toString(), opts);
    if (!next) throw new Error('rdap_bad_redirect');
    return rdapFetch(next, opts, hops + 1);
  }
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`rdap_http_${res.status}`);
  const text = await res.text();
  if (text.length > 512 * 1024) throw new Error('rdap_too_large');
  return { json: JSON.parse(text), url };
}

export async function rdapLookup(domain, opts) {
  // Try the name as given, then parent names, so "shop.example.co.uk" still finds the registration.
  const labels = domain.split('.');
  let registry = null;
  let name = domain;
  for (let i = 0; i <= labels.length - 2; i++) {
    name = labels.slice(i).join('.');
    const r = await rdapFetch(`https://rdap.org/domain/${encodeURIComponent(name)}`, opts);
    if (!r.notFound) { registry = r.json; break; }
    if (labels.length - i <= 2) break;
  }
  if (!registry) return { notFound: true };
  const responses = [registry];
  // Follow the registrar's RDAP link (thick data: registrant) once, best-effort.
  const rel = (registry.links || []).find((l) => l.rel === 'related' && /rdap\+json/i.test(l.type || '') && /\/domain\//i.test(l.href || ''));
  if (rel) {
    try {
      const href = await safeRdapUrl(rel.href, opts);
      if (href) {
        const r2 = await rdapFetch(href, { ...opts, timeout: 3000 });
        if (r2.json) responses.push(r2.json);
      }
    } catch { /* registrar RDAP is optional */ }
  }
  return { name, ...parseRdap(responses) };
}

// ---------- Website / TLS ----------

function httpsHead(ip, hostname, path, { timeout, deadline }) {
  return new Promise((resolve) => {
    const ms = Math.max(300, Math.min(timeout, deadline - Date.now()));
    const req = https.request({
      host: ip,
      port: 443,
      servername: hostname,
      method: 'GET',
      path,
      headers: { host: hostname, 'user-agent': UA, accept: 'text/html,*/*;q=0.5' },
      rejectUnauthorized: false, // we record validity ourselves; we never send data
      timeout: ms,
      family: ip.includes(':') ? 6 : 4,
      lookup: (_h, _o, cb) => cb(new Error('no_dns')) // never resolve names here
    }, (res) => {
      const sock = res.socket;
      const cert = typeof sock.getPeerCertificate === 'function' ? sock.getPeerCertificate() : null;
      const out = {
        status: res.statusCode,
        headers: res.headers,
        tls: {
          authorized: sock.authorized === true,
          error: sock.authorizationError ? String(sock.authorizationError.code || sock.authorizationError) : null,
          validTo: cert && cert.valid_to ? new Date(cert.valid_to).toISOString() : null,
          issuer: cert?.issuer?.O || null
        }
      };
      res.destroy();
      resolve(out);
    });
    const timer = setTimeout(() => req.destroy(new Error('timeout')), ms + 100);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => { clearTimeout(timer); resolve({ error: e.code || e.message || 'error' }); });
    req.on('close', () => clearTimeout(timer));
    req.end();
  });
}

const friendlyNetError = (e) => ({
  timeout: 'it took too long to respond',
  ECONNREFUSED: 'the server refused the connection',
  ECONNRESET: 'the connection was dropped',
  EHOSTUNREACH: 'the server was unreachable',
  ENETUNREACH: 'the server was unreachable',
  EPROTO: 'the secure connection failed'
}[e] || 'the secure connection failed');

export async function webCheck(domain, opts) {
  const candidates = [domain, `www.${domain}`];
  let sawPrivate = false;
  let sawAddress = false;
  let lastError = null;
  for (const host of candidates) {
    const ips = await publicIps(host, opts);
    if (ips.all.length) sawAddress = true;
    if (ips.anyPrivate) { sawPrivate = true; continue; }
    const ip = ips.v4[0] || ips.v6[0];
    if (!ip) continue;
    let r = await httpsHead(ip, host, '/', opts);
    if (r.error) { lastError = r.error; continue; }
    let finalHost = host;
    // Follow up to two redirects, only between the apex and www over HTTPS.
    for (let hop = 0; hop < 2 && r.status >= 300 && r.status < 400 && r.headers.location; hop++) {
      let u;
      try { u = new URL(r.headers.location, `https://${finalHost}/`); } catch { break; }
      const h = u.hostname.toLowerCase();
      if (u.protocol !== 'https:' || (h !== domain && h !== `www.${domain}`) || (u.port && u.port !== '443')) break;
      const ips2 = h === finalHost ? { v4: [ip], v6: [], anyPrivate: false } : await publicIps(h, opts);
      if (ips2.anyPrivate) break;
      const ip2 = ips2.v4[0] || ips2.v6[0];
      if (!ip2) break;
      const r2 = await httpsHead(ip2, h, (u.pathname + u.search).slice(0, 512) || '/', opts);
      if (r2.error) break;
      r = r2; finalHost = h;
    }
    const cnames = await doh(finalHost, 'CNAME', opts).catch(() => []);
    return {
      up: r.status < 500,
      host: finalHost,
      status: r.status,
      tls: r.tls,
      host_info: inferWebHost(r.headers, cnames),
      reason: r.status >= 500 ? `the server returned an error (${r.status})` : null
    };
  }
  if (sawPrivate) return { skipped: 'private_ip' };
  if (!sawAddress) return { skipped: 'no_address' };
  return { up: false, host: domain, reason: friendlyNetError(lastError) };
}

// ---------- Orchestration ----------

export async function runAudit(domain, { budgetMs = 8500 } = {}) {
  const deadline = Date.now() + budgetMs;
  const opts = { deadline, timeout: 3000 };
  const errors = {};
  const settle = (key, p) => p.catch((e) => { errors[key] = e?.message === 'not_found' ? 'not_found' : (e?.name === 'TimeoutError' ? 'timeout' : 'failed'); return null; });

  const [rdap, ns, mx, txt, dmarcTxt, web] = await Promise.all([
    settle('rdap', rdapLookup(domain, { deadline, timeout: 4000 }).then((r) => { if (r.notFound) throw new Error('not_found'); return r; })),
    settle('ns', doh(domain, 'NS', opts).then((a) => a.map((h) => h.toLowerCase().replace(/\.$/, '')))),
    settle('mx', doh(domain, 'MX', opts).then((a) => a.map((m) => m.split(/\s+/).pop().toLowerCase().replace(/\.$/, '')).filter((h) => h && h !== '.' && h !== ''))),
    settle('spf', doh(domain, 'TXT', opts).then((a) => a.map(unquoteTxt))),
    settle('dmarc', doh(`_dmarc.${domain}`, 'TXT', opts).then((a) => a.map(unquoteTxt))),
    settle('web', webCheck(domain, { deadline, timeout: 4000 }))
  ]);

  // A "null MX" (RFC 7505, "0 .") means the domain explicitly accepts no mail.
  const facts = {
    domain,
    rdap,
    ns: ns || [],
    mx: mx || [],
    spf: txt ? parseSpf(txt) : null,
    dmarc: dmarcTxt ? parseDmarc(dmarcTxt) : null,
    web,
    errors
  };
  const report = gradeReport(facts);
  report.facts = {
    registrar: rdap?.registrar || null,
    expires: rdap?.expires || null,
    registrant: rdap?.registrant || 'unknown',
    nameservers: facts.ns,
    mx: facts.mx,
    spf: facts.spf?.record || facts.spf?.status || null,
    dmarc: facts.dmarc?.record || facts.dmarc?.status || null,
    web: web ? { host: web.host || null, status: web.status || null, up: !!web.up, certValidTo: web.tls?.validTo || null, certValid: web.tls?.authorized ?? null, platform: web.host_info?.label || null } : null,
    errors
  };
  return report;
}
