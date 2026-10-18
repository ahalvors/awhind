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

  // Step 1: instant summary
  $('kr-scan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var domain = $('kr-domain').value.trim();
    $('kr-scan-error').textContent = '';
    if (!domain) { $('kr-scan-error').textContent = 'Enter a domain name, like yourbusiness.com.'; return; }
    busy($('kr-scan-btn'), $('kr-scan-status'), true);
    ['kr-summary', 'kr-lead', 'kr-report', 'kr-cta'].forEach(function (id) { $(id).hidden = true; });
    post('/api/keyring/scan', { domain: domain }).then(function (j) {
      var s = j.summary;
      state.domain = s.domain;
      badge($('kr-badge'), s.overall);
      $('kr-headline').textContent = s.domain + ': ' + HEAD[s.overall];
      $('kr-counts').textContent = counts(s.counts, s.incomplete);
      var list = $('kr-summary-list');
      clear(list);
      s.issues.forEach(function (i) {
        var li = el('li');
        li.appendChild(el('span', 'kr-dot ' + i.level));
        li.appendChild(el('span', null, i.title));
        list.appendChild(li);
      });
      if (s.fineCount) {
        var li = el('li');
        li.appendChild(el('span', 'kr-dot green'));
        li.appendChild(el('span', null, s.issues.length
          ? s.fineCount + (s.fineCount === 1 ? ' other check looks fine.' : ' other checks look fine.')
          : 'All ' + s.fineCount + ' checks look fine.'));
        list.appendChild(li);
      }
      $('kr-summary').hidden = false;
      $('kr-lead').hidden = false;
      track('keyring_scan', { overall: s.overall });
      $('kr-summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      $('kr-scan-error').textContent = err.message;
    }).then(function () { busy($('kr-scan-btn'), $('kr-scan-status'), false); });
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
    post('/api/keyring/report', {
      domain: state.domain, name: name, email: email,
      company: $('kr-company').value.trim(), website: $('kr-website').value
    }).then(function (j) {
      state.name = name; state.email = email; state.leadId = j.leadId || null;
      renderReport(j.report);
      $('kr-lead').hidden = true;
      $('kr-summary').hidden = true;
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
