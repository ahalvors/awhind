(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { domain: null, name: null, email: null, leadId: null };
  var LABEL = { red: 'Needs attention', yellow: 'Worth a look', green: 'Looking good', unknown: 'Incomplete' };
  var HEAD = {
    red: 'Something here could hurt your business soon.',
    yellow: 'Mostly fine, with a few things worth fixing.',
    green: 'Your domain looks healthy.',
    unknown: 'We couldn\u2019t finish every check. Nothing urgent turned up in the ones that ran.'
  };

  function track(name, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) {}
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function post(path, body) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    return fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (t) clearTimeout(t);
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
        return j;
      });
    }, function () {
      if (t) clearTimeout(t);
      throw new Error('We couldn\u2019t reach KeyRing. Check your connection and try again.');
    });
  }
  function busy(btn, statusEl, on) {
    btn.disabled = on;
    statusEl.hidden = !on;
  }
  function badge(node, level) {
    node.className = 'kr-badge ' + level;
    node.textContent = LABEL[level] || level;
  }
  function counts(c, incomplete) {
    var parts = [];
    if (c.red) parts.push(c.red + ' urgent');
    if (c.yellow) parts.push(c.yellow + ' to review');
    parts.push(c.green + ' looking fine');
    if (incomplete) parts.push('some checks didn\u2019t finish');
    return parts.join(' \u00b7 ');
  }

  // Step 1: animated, step-by-step reveal driven by the real scan results
  var STEPS = [
    ['domain', 'Domain & renewal'], ['dns', 'DNS host'], ['email', 'Email provider'],
    ['spf', 'SPF'], ['dmarc', 'DMARC'], ['ssl', 'SSL certificate'], ['hosting', 'Hosting & uptime']
  ];
  var ICON = { green: '\u2713', yellow: '!', red: '\u2715', unknown: '?' };
  var LVL = { green: 'Good', yellow: 'Review', red: 'Urgent', unknown: 'Not checked' };
  var STEP_SCAN_MS = 280;   // scanning state shown per panel once data is back
  var STEP_GAP_MS = 170;    // pause after a panel resolves before the next slides in
  var FIRST_MIN_MS = 450;   // minimum scanning time for the first panel
  var runId = 0;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function makeStep(i, animate) {
    var li = el('li', 'kr-step scanning' + (animate ? ' enter' : ''));
    li.setAttribute('data-step', STEPS[i][0]);
    li.appendChild(el('span', 'kr-icon'));
    var body = el('div');
    var num = el('p', 'num', String(i + 1).padStart(2, '0') + ' \u00b7 ' + STEPS[i][1]);
    num.style.margin = '0';
    body.appendChild(num);
    var f = el('p', 'finding', 'Checking');
    f.style.margin = '3px 0 0';
    body.appendChild(f);
    li.appendChild(body);
    $('kr-steps').appendChild(li);
    return li;
  }
  function resolveStep(li, check) {
    var level = check && check.level ? check.level : 'unknown';
    li.className = 'kr-step resolved ' + level;
    li.querySelector('.kr-icon').textContent = ICON[level];
    li.querySelector('.kr-icon').setAttribute('aria-hidden', 'true');
    var num = li.querySelector('.num');
    var tag = el('span', 'lvl', LVL[level]);
    num.appendChild(tag);
    li.querySelector('.finding').textContent = (check && check.finding) || 'We couldn\u2019t finish this check.';
  }
  function showOverall(s, animate) {
    badge($('kr-badge'), s.overall);
    $('kr-headline').textContent = s.domain + ': ' + HEAD[s.overall];
    $('kr-counts').textContent = counts(s.counts, s.incomplete);
    var card = $('kr-summary');
    card.classList.remove('enter');
    if (animate) { void card.offsetWidth; card.classList.add('enter'); }
    card.hidden = false;
    $('kr-lead').hidden = false;
    $('kr-steps').setAttribute('aria-busy', 'false');
    var flagged = (s.checks || []).filter(function (c) { return c.level !== 'green'; })
      .map(function (c) { return c.label + ': ' + LVL[c.level] + ', ' + c.finding; });
    $('kr-live').textContent = 'Scan complete for ' + s.domain + '. Overall: ' + LABEL[s.overall] + '. ' + counts(s.counts, s.incomplete) + '. ' + flagged.join(' ');
    try { $('kr-headline').focus({ preventScroll: true }); } catch (e) { $('kr-headline').focus(); }
    card.scrollIntoView({ behavior: animate ? 'smooth' : 'auto', block: 'center' });
  }
  function checkFor(s, id) {
    var list = s.checks || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  $('kr-scan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var domain = $('kr-domain').value.trim();
    $('kr-scan-error').textContent = '';
    if (!domain) { $('kr-scan-error').textContent = 'Enter a domain name, like yourbusiness.com.'; return; }
    var my = ++runId;
    var animate = !reducedMotion();
    busy($('kr-scan-btn'), $('kr-scan-status'), true);
    ['kr-summary', 'kr-lead', 'kr-report', 'kr-cta'].forEach(function (id) { $(id).hidden = true; });
    var steps = $('kr-steps');
    clear(steps);
    steps.hidden = false;
    steps.setAttribute('aria-busy', 'true');
    $('kr-live').textContent = 'Checking ' + domain + '\u2026';
    var started = Date.now();
    var first = animate ? makeStep(0, true) : null;
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    post('/api/keyring/scan', { domain: domain }).then(function (j) {
      if (my !== runId) return;
      var s = j.summary;
      state.domain = s.domain;
      track('keyring_scan', { overall: s.overall });
      if (!animate) {
        for (var k = 0; k < STEPS.length; k++) resolveStep(makeStep(k, false), checkFor(s, STEPS[k][0]));
        showOverall(s, false);
        return;
      }
      // Reveal real results one panel at a time with short stagger timing.
      var chain = wait(Math.max(0, FIRST_MIN_MS - (Date.now() - started)));
      STEPS.forEach(function (st, i) {
        chain = chain.then(function () {
          if (my !== runId) throw new Error('cancelled');
          var li = i === 0 ? first : makeStep(i, true);
          if (i > 0) li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return wait(i === 0 ? 0 : STEP_SCAN_MS).then(function () {
            resolveStep(li, checkFor(s, st[0]));
            return wait(STEP_GAP_MS);
          });
        });
      });
      return chain.then(function () { if (my === runId) showOverall(s, true); });
    }).catch(function (err) {
      if (my !== runId || (err && err.message === 'cancelled')) return;
      clear(steps);
      steps.hidden = true;
      steps.setAttribute('aria-busy', 'false');
      $('kr-live').textContent = '';
      $('kr-scan-error').textContent = err.message;
    }).then(function () { if (my === runId) busy($('kr-scan-btn'), $('kr-scan-status'), false); });
  });

  // Step 2: lead capture -> full report on the page
  $('kr-lead-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('kr-lead-error').textContent = '';
    var name = $('kr-name').value.trim();
    var email = $('kr-email').value.trim();
    if (!name) { $('kr-lead-error').textContent = 'Please enter your name.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('kr-lead-error').textContent = 'Please enter a valid email address.'; return; }
    busy($('kr-lead-btn'), $('kr-lead-status'), true);
    var gen = runId;
    post('/api/keyring/report', {
      domain: state.domain, name: name, email: email,
      company: $('kr-company').value.trim(), website: $('kr-website').value
    }).then(function (j) {
      if (gen !== runId) return; // a new scan started; ignore this stale report
      state.name = name; state.email = email; state.leadId = j.leadId || null;
      renderReport(j.report);
      $('kr-lead').hidden = true;
      $('kr-summary').hidden = true;
      $('kr-steps').hidden = true;
      $('kr-report').hidden = false;
      $('kr-cta').hidden = false;
      $('kr-cta-title').textContent = j.report.overall === 'green'
        ? 'Want AWHIND to keep it that way?'
        : 'Want AWHIND to handle this?';
      track('generate_lead', { overall: j.report.overall, method: 'keyring' });
      $('kr-report').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      $('kr-lead-error').textContent = err.message;
    }).then(function () { busy($('kr-lead-btn'), $('kr-lead-status'), false); });
  });

  function renderReport(r) {
    badge($('kr-r-badge'), r.overall);
    $('kr-r-headline').textContent = 'Overall: ' + LABEL[r.overall];
    $('kr-r-domain').textContent = 'Website: ' + r.domain + ' \u00b7 ' + counts(r.counts, r.incomplete);
    var wrap = $('kr-r-issues');
    clear(wrap);
    r.issues.forEach(function (i, idx) {
      var box = el('div', 'kr-issue');
      var h = el('h3');
      h.appendChild(el('span', 'kr-dot ' + i.level));
      h.appendChild(el('span', null, (idx + 1) + '. ' + i.title));
      box.appendChild(h);
      box.appendChild(el('p', null, i.why));
      var fix = el('p', 'fix');
      fix.appendChild(el('strong', null, 'What to do: '));
      fix.appendChild(document.createTextNode(i.fix));
      box.appendChild(fix);
      wrap.appendChild(box);
    });
    var fine = $('kr-r-fine');
    clear(fine);
    $('kr-r-fine-title').hidden = !r.fine.length;
    r.fine.forEach(function (f) {
      var li = el('li');
      li.appendChild(el('span', 'kr-dot green'));
      li.appendChild(el('span', null, f));
      fine.appendChild(li);
    });
    var tb = $('kr-r-holders');
    clear(tb);
    r.holders.forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('td', null, row.piece));
      tr.appendChild(el('td', null, row.company));
      tr.appendChild(el('td', null, row.yours));
      tb.appendChild(tr);
    });
    var notes = $('kr-r-notes');
    clear(notes);
    r.notes.forEach(function (n) { notes.appendChild(el('p', 'kr-note', n)); });
  }

  // CTA: fix / monitor request goes to AWHIND as a follow-up lead
  Array.prototype.forEach.call(document.querySelectorAll('[data-intent]'), function (btn) {
    btn.addEventListener('click', function () {
      var intent = btn.getAttribute('data-intent');
      $('kr-cta-error').textContent = '';
      btn.disabled = true;
      post('/api/keyring/intent', { domain: state.domain, name: state.name, email: state.email, intent: intent, leadId: state.leadId })
        .then(function () {
          $('kr-cta-thanks').hidden = false;
          $('kr-cta-thanks').textContent = 'Thanks, ' + state.name + '. We\u2019ll reach out at ' + state.email + ' about ' +
            (intent === 'fix' ? 'fixing ' : 'monitoring ') + state.domain + '.';
          track('keyring_cta', { intent: intent });
        })
        .catch(function (err) { $('kr-cta-error').textContent = err.message; btn.disabled = false; });
    });
  });

  // Prefill from ?domain= (e.g. links from emails or social posts)
  try {
    var q = new URLSearchParams(location.search).get('domain');
    if (q && q.length < 300) $('kr-domain').value = q;
  } catch (e) {}
})();
