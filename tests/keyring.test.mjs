// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDomain, validateEmail, cleanName, isPublicIp, parseSpf, parseDmarc, parseRdap,
  gradeReport, summarize, nsProvider, mxProvider, inferWebHost
} from '../netlify/lib/keyring-core.mjs';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const inDays = (d) => new Date(NOW + d * 86400000).toISOString();

test('validateDomain accepts and normalizes real domains', () => {
  assert.deepEqual(validateDomain('awhind.com'), { ok: true, domain: 'awhind.com', host: 'awhind.com' });
  assert.deepEqual(validateDomain('  HTTPS://WWW.Example-Biz.co.uk/contact?x=1 '), { ok: true, domain: 'example-biz.co.uk', host: 'www.example-biz.co.uk' });
  assert.equal(validateDomain('pepper.salon').domain, 'pepper.salon');
  assert.equal(validateDomain('apdsec.com.').domain, 'apdsec.com');
  assert.equal(validateDomain('bücher.de').domain, 'xn--bcher-kva.de');
  assert.equal(validateDomain('shop.example-store.com').domain, 'shop.example-store.com');
});

test('validateDomain rejects IPs, internal hosts and junk', () => {
  const bad = [
    '', '   ', null, 123, 'localhost', '127.0.0.1', '10.0.0.5', '[::1]', '::1', '0x7f000001',
    'http://169.254.169.254/latest/meta-data', 'router.local', 'intranet.corp', 'printer.lan', 'foo.internal',
    'example.com', 'www.example.org', 'test.test', 'foo.invalid', '1.1.1.1.in-addr.arpa', 'abc', 'a..com',
    '-bad.com', 'bad-.com', 'exa mple.com', 'user@evil.com', 'evil.com:8080', 'evil.com\\@good.com',
    'a'.repeat(64) + '.com', ('a'.repeat(60) + '.').repeat(5) + 'com', 'x'.repeat(400), 'a.b.c.d.e.f.com',
    '127.0.0.1.nip.io', 'foo.localtest.me', 'file:///etc/passwd', 'evil\n.com', 'foo.123', 'gopher://x'
  ];
  for (const b of bad) assert.equal(validateDomain(b).ok, false, `should reject ${JSON.stringify(b)}`);
});

test('validateEmail / cleanName', () => {
  assert.equal(validateEmail('owner@demitris.com'), 'owner@demitris.com');
  assert.equal(validateEmail('a+b@sub.biz.co'), 'a+b@sub.biz.co');
  for (const b of ['nope', 'a@b', 'a@localhost', 'a@127.0.0.1', '<x>@y.com', 'a@example.com', 'x'.repeat(300) + '@a.com']) {
    assert.equal(validateEmail(b), null, b);
  }
  assert.equal(cleanName('  Andy   <b>H</b> '), 'Andy bH/b');
  assert.equal(cleanName(''), null);
  assert.equal(cleanName('x'.repeat(101)), null);
});

test('isPublicIp blocks private, reserved and special ranges', () => {
  for (const ip of ['8.8.8.8', '104.198.14.52', '2606:4700::6810:84e5', '2600:1f18::1']) assert.equal(isPublicIp(ip), true, ip);
  for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '192.0.2.1', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1',
    '2001:db8::1', '2002:7f00:1::', '2001:0:4136:e378::1', 'not-an-ip']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test('parseSpf', () => {
  assert.deepEqual(parseSpf(['google-site-verification=x']), { status: 'missing' });
  assert.equal(parseSpf(['v=spf1 include:_spf.google.com ~all']).all, '~');
  assert.equal(parseSpf(['v=spf1 +all']).all, '+');
  assert.equal(parseSpf(['v=spf1 a mx all']).all, '+');
  assert.equal(parseSpf(['v=spf1 -all', 'v=spf1 ~all']).status, 'multiple');
});

test('parseDmarc', () => {
  assert.equal(parseDmarc([]).status, 'missing');
  assert.equal(parseDmarc(['v=DMARC1; p=none; rua=mailto:x@y.com']).status, 'monitor');
  assert.equal(parseDmarc(['v=DMARC1; p=reject']).status, 'enforced');
  assert.equal(parseDmarc(['v=DMARC1; p=quarantine; pct=25']).status, 'partial');
  assert.equal(parseDmarc(['v=DMARC1; rua=mailto:x@y.com']).status, 'invalid');
  assert.equal(parseDmarc(['v=DMARC1; p=none', 'v=DMARC1; p=reject']).status, 'multiple');
});

test('parseRdap: registrar, expiry, redacted vs visible registrant', () => {
  const registry = {
    events: [{ eventAction: 'expiration', eventDate: '2026-12-30T17:44:23Z' }],
    entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Tucows Domains Inc.']]] }]
  };
  const redacted = { entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'REDACTED FOR PRIVACY']]] }] };
  const visible = { entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', ''], ['org', {}, 'text', 'Savior Plumbing Inc']]] }] };
  const r1 = parseRdap([registry, redacted]);
  assert.equal(r1.registrar, 'Tucows Domains Inc.');
  assert.equal(r1.expires, '2026-12-30T17:44:23Z');
  assert.equal(r1.registrant, 'hidden');
  assert.equal(parseRdap([registry]).registrant, 'hidden');
  const r2 = parseRdap([registry, visible]);
  assert.equal(r2.registrant, 'visible');
  assert.equal(r2.registrantName, 'Savior Plumbing Inc');
  const proxy = { entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['org', {}, 'text', 'Domains By Proxy, LLC']]] }] };
  assert.equal(parseRdap([registry, proxy]).registrant, 'hidden');
});

test('provider detection', () => {
  assert.equal(nsProvider('dns1.p07.nsone.net'), 'NS1');
  assert.equal(nsProvider('ns-cloud-e1.googledomains.com'), 'Google Cloud DNS');
  assert.equal(nsProvider('ns1.googledomains.com'), 'Google Domains (legacy)');
  assert.equal(nsProvider('ns02.squarespacedns.com'), 'Squarespace');
  assert.equal(nsProvider('kim.ns.cloudflare.com'), 'Cloudflare');
  assert.equal(nsProvider('ns1.somehost.net'), 'somehost.net');
  assert.equal(mxProvider('aspmx.l.google.com'), 'Google Workspace');
  assert.equal(mxProvider('acme-com.mail.protection.outlook.com'), 'Microsoft 365');
  assert.equal(mxProvider('mx.zoho.com'), 'Zoho Mail');
  assert.equal(inferWebHost({ 'x-nf-request-id': 'abc', server: 'Netlify' }).label, 'Netlify');
  assert.equal(inferWebHost({ server: 'cloudflare', 'cf-ray': '1' }).label, 'Not identified, behind Cloudflare');
  assert.equal(inferWebHost({ server: 'Squarespace' }).label, 'Squarespace');
  assert.equal(inferWebHost({}, ['shops.myshopify.com']).label, 'Shopify');
});

const base = (over = {}) => ({
  domain: 'goodbiz.com',
  rdap: { registrar: 'Squarespace Domains LLC', expires: inDays(400), registrant: 'hidden' },
  ns: ['ns-cloud-e1.googledomains.com', 'ns-cloud-e2.googledomains.com'],
  mx: ['aspmx.l.google.com'],
  spf: parseSpf(['v=spf1 include:_spf.google.com ~all']),
  dmarc: parseDmarc(['v=DMARC1; p=reject']),
  web: { up: true, host: 'goodbiz.com', status: 200, tls: { authorized: true, validTo: inDays(60) }, host_info: { platform: 'Netlify', label: 'Netlify' } },
  errors: {},
  ...over
});

test('grade: clean setup is green with no issues', () => {
  const r = gradeReport(base(), NOW);
  assert.equal(r.overall, 'green');
  assert.equal(r.issues.length, 0);
  assert.ok(r.fine.length >= 5);
  assert.ok(r.notes.some((n) => /privacy-protected/.test(n)));
});

test('grade: Demitri-style profile is red with the expected lines', () => {
  const r = gradeReport(base({
    rdap: { registrar: 'Tucows Domains Inc.', expires: '2026-12-30T17:44:23Z', registrant: 'hidden' },
    ns: ['ns01.squarespacedns.com', 'dns1.p07.nsone.net'],
    spf: parseSpf([]), dmarc: parseDmarc([])
  }), NOW);
  assert.equal(r.overall, 'red');
  const ids = r.issues.map((i) => i.id);
  assert.deepEqual(ids, ['spoofable', 'expiring', 'mixed-dns']);
  assert.equal(r.issues[0].title, 'Anyone can send email pretending to be you');
  assert.match(r.issues[1].title, /in 73 days/);
  assert.equal(r.issues[1].level, 'yellow');
  assert.equal(r.holders[1].company, 'Squarespace + NS1 (mixed)');
});

test('grade: expiry thresholds', () => {
  assert.equal(gradeReport(base({ rdap: { expires: inDays(-2), registrant: 'hidden' } }), NOW).issues[0].id, 'expired');
  assert.equal(gradeReport(base({ rdap: { expires: inDays(20), registrant: 'hidden' } }), NOW).issues[0].level, 'red');
  assert.equal(gradeReport(base({ rdap: { expires: inDays(80), registrant: 'hidden' } }), NOW).issues[0].level, 'yellow');
  assert.equal(gradeReport(base({ rdap: { expires: inDays(120), registrant: 'hidden' } }), NOW).issues.length, 0);
});

test('grade: DMARC none / missing are yellow; SPF +all is red', () => {
  assert.equal(gradeReport(base({ dmarc: parseDmarc(['v=DMARC1; p=none']) }), NOW).issues[0].id, 'dmarc-none');
  assert.equal(gradeReport(base({ dmarc: parseDmarc([]) }), NOW).overall, 'yellow');
  const open = gradeReport(base({ spf: parseSpf(['v=spf1 +all']) }), NOW);
  assert.equal(open.overall, 'red');
  assert.equal(open.issues[0].id, 'spf-open');
  // No mail at all + no SPF/DMARC is yellow, not red
  const nomail = gradeReport(base({ mx: [], spf: parseSpf([]), dmarc: parseDmarc([]) }), NOW);
  assert.equal(nomail.issues[0].level, 'yellow');
});

test('grade: website down, bad cert, and expiring cert', () => {
  assert.equal(gradeReport(base({ web: { up: false, host: 'goodbiz.com', reason: 'it took too long to respond' } }), NOW).issues[0].id, 'site-down');
  assert.equal(gradeReport(base({ web: { skipped: 'no_address' } }), NOW).overall, 'red');
  assert.equal(gradeReport(base({ web: { skipped: 'private_ip' } }), NOW).issues[0].id, 'private-ip');
  const bad = gradeReport(base({ web: { up: true, tls: { authorized: false, error: 'CERT_HAS_EXPIRED' }, host_info: {} } }), NOW);
  assert.equal(bad.issues[0].id, 'ssl-invalid');
  assert.match(bad.issues[0].why, /expired/);
  assert.equal(gradeReport(base({ web: { up: true, tls: { authorized: true, validTo: inDays(3) }, host_info: {} } }), NOW).issues[0].level, 'red');
  assert.equal(gradeReport(base({ web: { up: true, tls: { authorized: true, validTo: inDays(10) }, host_info: {} } }), NOW).issues[0].level, 'yellow');
});

test('grade: registry not found and lookup failures', () => {
  const nf = gradeReport(base({ rdap: null, errors: { rdap: 'not_found' } }), NOW);
  assert.equal(nf.issues[0].id, 'not-registered');
  const fail = gradeReport(base({ rdap: null, ns: [], mx: [], spf: null, dmarc: null, web: null, errors: { rdap: 'timeout', ns: 'failed', mx: 'failed', spf: 'failed', dmarc: 'failed', web: 'failed' } }), NOW);
  assert.equal(fail.overall, 'green');
  assert.equal(fail.issues.length, 0);
  assert.ok(fail.notes.length >= 3, 'failures surface as notes, never as false alarms');
});

test('grade: single builder vendor for everything is flagged, Google is not', () => {
  const r = gradeReport(base({ ns: ['ns1.prosites.com'], mx: ['mail.prosites.com'], web: { up: true, tls: { authorized: true, validTo: inDays(60) }, host_info: { platform: 'ProSites', label: 'ProSites' } } }), NOW);
  assert.ok(r.issues.some((i) => i.id === 'single-vendor'));
  const g = gradeReport(base({ ns: ['ns-cloud-a1.googledomains.com'], web: { up: true, tls: { authorized: true, validTo: inDays(60) }, host_info: { platform: 'Google', label: 'Google' } } }), NOW);
  assert.ok(!g.issues.some((i) => i.id === 'single-vendor'));
});

test('summarize exposes headlines only', () => {
  const s = summarize(gradeReport(base({ dmarc: parseDmarc([]) }), NOW));
  assert.equal(s.overall, 'yellow');
  assert.deepEqual(Object.keys(s.issues[0]).sort(), ['level', 'title']);
  assert.equal(s.holders, undefined);
});
