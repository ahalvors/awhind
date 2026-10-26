import { areas, questions, score } from './model.mjs';
// Answers live only in this in-memory object. Nothing is saved or sent.
const answers = {};
const list = document.getElementById('checks');
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
list.innerHTML = areas.map((name, ai) => {
  const qs = questions.filter(q => q[1] === ai);
  return `<fieldset class="area"><legend class="eyebrow">${String(ai+1).padStart(2,'0')} / ${esc(name)}</legend>` + qs.map(([id,,q,fix]) =>
    `<div class="check" data-id="${id}"><p class="q">${esc(q)}</p><div class="choices" role="radiogroup" aria-label="${esc(q)}">` +
    `<label><input type="radio" name="${id}" value="yes"> Yes</label><label><input type="radio" name="${id}" value="no"> No / not sure</label></div>` +
    `<p class="fix" id="fix-${id}" hidden><strong>Fix:</strong> ${esc(fix)}</p></div>`).join('') + `</fieldset>`;
}).join('');
function render() {
  const s = score(answers);
  document.getElementById('score-num').textContent = s.percent;
  document.getElementById('score-rating').textContent = s.rating;
  document.getElementById('score-count').textContent = `${s.yes} of ${s.total} in place · ${s.answered} answered`;
  document.getElementById('score-bar').value = s.yes;
  for (const [id] of questions) document.getElementById('fix-' + id).hidden = answers[id] !== 'no';
  const fl = document.getElementById('fix-list');
  fl.innerHTML = s.fixes.length ? s.fixes.map(f => `<li><span class="mono">${esc(f.area)}</span> ${esc(f.fix)}</li>`).join('') : '<li class="empty">Answer “No / not sure” on any check and its fix will show up here.</li>';
}
list.addEventListener('change', e => { if (e.target.name) { answers[e.target.name] = e.target.value; render(); } });
document.getElementById('reset').addEventListener('click', () => { for (const k in answers) delete answers[k]; list.querySelectorAll('input').forEach(i => i.checked = false); render(); });
render();
