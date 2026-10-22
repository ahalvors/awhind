// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectPhp, parseSupportedVersions, phpBranchStatus, scorePhp, PHP_BRANCHES_FALLBACK } from '../netlify/lib/keyring-php.mjs';
import { gradeReport } from '../netlify/lib/keyring-core.mjs';

const fx = (n) => readFileSync(new URL(`./fixtures/php/${n}`, import.meta.url), 'utf8');
const NOW = Date.parse('2026-10-21T12:00:00Z');
const LIST = parseSupportedVersions(fx('supported-versions.html'));

test('parses php.net supported-versions page', () => {
  assert.deepEqual(LIST.map((b) => b.branch), ['8.2', '8.3', '8.4', '8.5']);
  assert.deepEqual(LIST[0], { branch: '8.2', released: '2022-12-08', activeUntil: '2024-12-31', securityUntil: '2026-12-31' });
  assert.deepEqual(parseSupportedVersions('<html>nope</html>'), []);
});

test('branch status by date: active / security / eol / unknown', () => {
  assert.equal(phpBranchStatus('8.4', LIST, NOW), 'active');
  assert.equal(phpBranchStatus('8.5', LIST, NOW), 'active');
  assert.equal(phpBranchStatus('8.3', LIST, NOW), 'security');
  assert.equal(phpBranchStatus('8.2', LIST, NOW), 'security');
  assert.equal(phpBranchStatus('8.2', LIST, Date.parse('2027-01-02T00:00:00Z')), 'eol');
  assert.equal(phpBranchStatus('7.4', LIST, NOW), 'eol');
  assert.equal(phpBranchStatus('5.6', LIST, NOW), 'eol');
  assert.equal(phpBranchStatus('9.0', LIST, NOW), 'unknown');
  assert.equal(phpBranchStatus(null, LIST, NOW), 'unknown');
  assert.equal(phpBranchStatus('8.1', PHP_BRANCHES_FALLBACK, NOW), 'eol');
});

test('X-Powered-By version → red / yellow / green', () => {
  const s = (v) => scorePhp(detectPhp({ headers: { 'x-powered-by': `PHP/${v}` }, url: 'https://biz.com/' }), LIST, NOW);
  assert.equal(s('7.4.33').level, 'red');
  assert.match(s('7.4.33').finding, /PHP 7\.4\.33 is end-of-life/);
  assert.equal(s('8.3.12').level, 'yellow');
  assert.match(s('8.3.12').finding, /until 2027-12-31/);
  assert.equal(s('8.4.1').level, 'green');
  assert.equal(s('9.1.0').level, 'unknown');
});

test('Server header carrying PHP version is read', () => {
  const d = detectPhp({ headers: { server: 'Apache/2.4.41 (Ubuntu) PHP/5.6.40' }, url: 'https://biz.com/' });
  assert.equal(d.version, '5.6.40');
  assert.equal(scorePhp(d, LIST, NOW).level, 'red');
});

test('WordPress with hidden PHP version: detected, version hidden, not colored', () => {
  const d = detectPhp({ headers: { server: 'nginx', 'set-cookie': ['wordpress_test_cookie=WP; path=/'] }, html: fx('wordpress-hidden.html'), url: 'https://www.example-biz.com/' });
  assert.equal(d.php, true);
  assert.equal(d.version, null);
  assert.deepEqual(d.cms, { name: 'WordPress', version: '6.8.3' });
  assert.ok(d.signals.some((x) => /xmlrpc\.php/.test(x)));
  assert.ok(!d.signals.some((x) => /other\.org/.test(x)), 'off-site .php links ignored');
  const r = scorePhp(d, LIST, NOW);
  assert.equal(r.level, 'unknown');
  assert.match(r.finding, /runs PHP \(WordPress 6\.8\.3\), but the PHP version is hidden/);
});

test('PHPSESSID / Joomla / Drupal signals', () => {
  assert.equal(detectPhp({ headers: { 'set-cookie': 'PHPSESSID=abc; path=/' }, url: 'https://a.com/' }).php, true);
  assert.equal(detectPhp({ headers: { 'set-cookie': ['SSESS0123456789abcdef0123456789abcdef=1'] }, url: 'https://a.com/' }).php, true);
  assert.equal(detectPhp({ headers: { 'set-cookie': ['XSRF-TOKEN=1'] }, url: 'https://a.com/' }).php, false);
  const j = detectPhp({ html: fx('joomla.html'), url: 'https://a.com/' });
  assert.equal(j.cms.name, 'Joomla');
  assert.equal(j.php, true);
  const dr = detectPhp({ html: fx('drupal.html'), url: 'https://a.com/' });
  assert.deepEqual(dr.cms, { name: 'Drupal', version: '10' });
});

test('non-PHP site: no signals, says so', () => {
  const d = detectPhp({ headers: { server: 'GitHub.com', 'set-cookie': ['_gh_sess=1', 'logged_in=no'] }, html: fx('static.html'), url: 'https://a.com/' });
  assert.equal(d.php, false);
  const r = scorePhp(d, LIST, NOW);
  assert.equal(r.level, 'green');
  assert.match(r.finding, /No public sign/);
  assert.equal(scorePhp(null, LIST, NOW).level, 'unknown');
});

test('audit report gets a PHP row and an issue for EOL PHP', () => {
  const web = (php) => ({ up: true, host: 'biz.com', status: 200, tls: { authorized: true, validTo: '2027-01-01T00:00:00Z' }, host_info: {}, php });
  const base = { domain: 'biz.com', rdap: { expires: '2028-01-01T00:00:00Z' }, ns: ['ns1.cloudflare.com'], mx: [], spf: { status: 'ok' }, dmarc: { status: 'ok', policy: 'reject' }, errors: {}, phpBranches: LIST };
  const eol = gradeReport({ ...base, web: web(detectPhp({ headers: { 'x-powered-by': 'PHP/7.2.1' }, url: 'https://biz.com/' })) }, NOW);
  assert.equal(eol.checks.find((c) => c.id === 'php').level, 'red');
  assert.ok(eol.issues.some((i) => i.id === 'php-eol'));
  const hidden = gradeReport({ ...base, web: web(detectPhp({ html: fx('wordpress-hidden.html'), url: 'https://example-biz.com/' })) }, NOW);
  assert.equal(hidden.checks.find((c) => c.id === 'php').level, 'unknown');
  assert.ok(hidden.notes.some((n) => /hides the PHP version/.test(n)));
  assert.ok(!hidden.issues.some((i) => /^php/.test(i.id)));
});

test('Drupal 1978 Expires header and off-site redirect', () => {
  const d = detectPhp({ headers: { expires: 'Sun, 19 Nov 1978 05:00:00 GMT' }, status: 302, url: 'https://a.com/' });
  assert.equal(d.php, true);
  assert.equal(d.cms.name, 'Drupal');
  const r = detectPhp({ headers: { location: 'https://elsewhere.com/' }, status: 301, url: 'https://a.com/' });
  assert.equal(scorePhp(r, LIST, NOW).level, 'unknown');
  assert.match(scorePhp(r, LIST, NOW).finding, /redirects to another site/);
});
