// KeyRing PHP detector. Pure functions only (no network) so they can be unit tested.
// Signals are limited to what a normal page fetch returns: response headers, cookie
// names, the page's own links/forms/scripts, and generator meta tags. We never probe paths.

// Cached fallback of php.net/supported-versions.php (captured 2026-10-21). Used only when
// the live page can't be fetched or parsed.
export const PHP_BRANCHES_FALLBACK = [
  { branch: '8.1', released: '2021-11-25', activeUntil: '2023-11-25', securityUntil: '2025-12-31' },
  { branch: '8.2', released: '2022-12-08', activeUntil: '2024-12-31', securityUntil: '2026-12-31' },
  { branch: '8.3', released: '2023-11-23', activeUntil: '2025-12-31', securityUntil: '2027-12-31' },
  { branch: '8.4', released: '2024-11-21', activeUntil: '2026-12-31', securityUntil: '2028-12-31' },
  { branch: '8.5', released: '2025-11-20', activeUntil: '2027-12-31', securityUntil: '2029-12-31' }
];

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parsePhpDate(s) {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(s || '');
  if (!m || !(m[2].toLowerCase() in MONTHS)) return null;
  const d = new Date(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
  return d.toISOString().slice(0, 10);
}

/** Parse php.net/supported-versions.php into [{branch, released, activeUntil, securityUntil}]. */
export function parseSupportedVersions(html) {
  const out = [];
  const rowRe = /<tr class="(?:stable|security|eol)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(html || ''))) {
    const branch = /version=(\d+\.\d+)/.exec(m[1])?.[1];
    const cells = [...m[1].matchAll(/<td(?![^>]*collapse-phone)[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1].replace(/<[^>]+>/g, '').trim());
    const dates = cells.map(parsePhpDate).filter(Boolean);
    if (branch && dates.length >= 3) out.push({ branch, released: dates[0], activeUntil: dates[1], securityUntil: dates[2] });
  }
  return out;
}

const cmpBranch = (a, b) => { const [a1, a2] = a.split('.').map(Number); const [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; };

/** Find all public PHP signals in a fetched page. headers: lower-cased header object (node style). */
export function detectPhp({ headers = {}, html = '', url = '', status = 200 } = {}) {
  const signals = [];
  const versions = [];
  const h = (k) => { const v = headers[k]; return Array.isArray(v) ? v.join(', ') : (v || ''); };

  const xpb = h('x-powered-by');
  const xm = /\bPHP\/(\d+\.\d+(?:\.\d+)?)/i.exec(xpb);
  if (xm) { signals.push(`X-Powered-By header says PHP/${xm[1]}`); versions.push(xm[1]); }
  else if (/\bPHP\b/i.test(xpb)) signals.push('X-Powered-By header mentions PHP (no version)');

  const srv = h('server');
  const sm = /\bPHP\/(\d+\.\d+(?:\.\d+)?)/i.exec(srv);
  if (sm) { signals.push(`Server header says PHP/${sm[1]}`); versions.push(sm[1]); }

  const cookies = [].concat(headers['set-cookie'] || []).map((c) => String(c).split('=')[0].trim());
  // PHPSESSID (plain PHP), WordPress, Laravel, CakePHP, CodeIgniter, Drupal (SESS/SSESS + 32 hex),
  // Joomla (bare 32-hex name). XSRF-TOKEN alone isn't PHP-specific, so it's ignored.
  const PHP_COOKIE = /^(PHPSESSID|wordpress_\w*|wp-settings[\w-]*|wordpress_test_cookie|laravel_session|CAKEPHP|ci_session|S?SESS[0-9a-f]{32}|[0-9a-f]{32})$/i;
  const phpCookies = cookies.filter((n) => PHP_COOKIE.test(n));
  for (const n of new Set(phpCookies)) signals.push(`Cookie name ${n.length > 20 ? n.slice(0, 12) + '\u2026' : n} is set by PHP software`);

  if (/\.php(?:[?#"']|$)/i.test(new URL(url || 'https://x/').pathname + '"')) signals.push('The page URL itself ends in .php');
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* ignore */ }
  const linkRe = /\b(?:href|src|action)\s*=\s*["']([^"'#]+)["']/gi;
  const phpLinks = new Set();
  let lm;
  while ((lm = linkRe.exec(html)) && phpLinks.size < 50) {
    const raw = lm[1];
    let u;
    try { u = new URL(raw, url || 'https://x/'); } catch { continue; }
    if (host && u.hostname.toLowerCase().replace(/^www\./, '') !== host.replace(/^www\./, '')) continue; // same site only
    if (/\.php$/i.test(u.pathname)) phpLinks.add(u.pathname);
  }
  if (phpLinks.size) signals.push(`${phpLinks.size} link${phpLinks.size === 1 ? " on the page points" : "s on the page point"} to .php files (e.g. ${[...phpLinks][0]})`);

  let cms = null;
  const genRe = /<meta\b[^>]*>/gi;
  let gm;
  while ((gm = genRe.exec(html))) {
    const tag = gm[0];
    if (!/name\s*=\s*["']generator["']/i.test(tag)) continue;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] || '';
    const c = /\b(WordPress|Joomla!?|Drupal)\s*v?(\d+(?:\.\d+)*)?/i.exec(content);
    if (c) {
      const name = c[1].replace(/!$/, '').replace(/^./, (x) => x.toUpperCase()).replace(/^Wordpress$/, 'WordPress');
      cms = { name, version: c[2] || null };
      signals.push(`Generator tag says ${name}${c[2] ? ' ' + c[2] : ''}`);
    }
  }
  if (!cms && /\/wp-(?:content|includes)\//i.test(html)) { cms = { name: 'WordPress', version: null }; signals.push('Page loads files from /wp-content/ or /wp-includes/ (WordPress)'); }

  if (/19 Nov 1978 05:00:00/.test(h('expires'))) { signals.push('Expires header uses Drupal\u2019s fixed 1978 date'); if (!cms) cms = { name: 'Drupal', version: null }; }
  if (h('x-generator') && /drupal/i.test(h('x-generator'))) { signals.push(`X-Generator header says ${h('x-generator').slice(0, 40)}`); if (!cms) cms = { name: 'Drupal', version: /(\d+)/.exec(h('x-generator'))?.[1] || null }; }

  const version = versions.sort((a, b) => b.length - a.length)[0] || null;
  const redirected = status >= 300 && status < 400;
  return { php: signals.length > 0, redirected, version, branch: version ? version.split('.').slice(0, 2).join('.') : null, cms, signals };
}

/** Classify a branch against php.net data. Returns 'active' | 'security' | 'eol' | 'unknown'. */
export function phpBranchStatus(branch, branches, now = Date.now()) {
  if (!branch) return 'unknown';
  const today = new Date(now).toISOString().slice(0, 10);
  const row = branches.find((b) => b.branch === branch);
  if (row) return today <= row.activeUntil ? 'active' : today <= row.securityUntil ? 'security' : 'eol';
  const oldest = [...branches].sort((a, b) => cmpBranch(a.branch, b.branch))[0];
  if (oldest && cmpBranch(branch, oldest.branch) < 0) return 'eol'; // older than anything php.net still lists
  return 'unknown'; // newer than the list (pre-release) or unparseable
}

/** Turn a detection into a KeyRing check row { level, finding, ... }. */
export function scorePhp(det, branches, now = Date.now(), source = 'php.net') {
  if (!det) return { level: 'unknown', finding: 'Couldn\u2019t check for PHP because the site didn\u2019t load.' };
  if (!det.php && det.redirected) return { level: 'unknown', php: null, signals: [], finding: 'The home page redirects to another site, so we couldn\u2019t look for PHP.' };
  if (!det.php) return { level: 'green', finding: 'No public sign that this site runs PHP.', php: false, signals: [] };
  const cmsTxt = det.cms ? ` (${det.cms.name}${det.cms.version ? ' ' + det.cms.version : ''})` : '';
  if (!det.version) {
    return { level: 'unknown', php: true, version: null, signals: det.signals,
      finding: `This site runs PHP${cmsTxt}, but the PHP version is hidden, so we can\u2019t say whether it\u2019s still supported.` };
  }
  const status = phpBranchStatus(det.branch, branches, now);
  const row = branches.find((b) => b.branch === det.branch);
  const base = { php: true, version: det.version, branch: det.branch, status, signals: det.signals, source };
  if (status === 'eol') return { ...base, level: 'red', finding: `PHP ${det.version}${cmsTxt} is end-of-life${row ? ` (security fixes ended ${row.securityUntil})` : ''} and gets no security fixes.` };
  if (status === 'security') return { ...base, level: 'yellow', finding: `PHP ${det.version}${cmsTxt} only gets security fixes now, until ${row.securityUntil}. Plan an upgrade.` };
  if (status === 'active') return { ...base, level: 'green', finding: `PHP ${det.version}${cmsTxt} is actively supported.` };
  return { ...base, level: 'unknown', finding: `PHP ${det.version}${cmsTxt} isn\u2019t on php.net\u2019s supported list, so we can\u2019t rate it.` };
}
