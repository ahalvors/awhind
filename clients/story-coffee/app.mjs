export function cents(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents(n));
}

export function lineTotal(item) {
  return cents(Number(item.qty) * Number(item.unitPrice));
}

export function subtotal(items) {
  return cents(items.reduce((sum, item) => sum + lineTotal(item), 0));
}

export function amazonItems(items) {
  return items.filter((item) => item.affiliate && item.asin);
}

export function itemUrl(item, associateTag) {
  if (item.affiliate && item.asin) {
    return `https://www.amazon.com/dp/${item.asin}?tag=${encodeURIComponent(associateTag)}`;
  }
  return item.url || null;
}

export function amazonCartUrl(bom) {
  const params = new URLSearchParams();
  params.set('AssociateTag', bom.amazonAssociateTag);
  amazonItems(bom.items).forEach((item, index) => {
    const n = index + 1;
    params.set(`ASIN.${n}`, item.asin);
    params.set(`Quantity.${n}`, String(item.qty));
  });
  return `https://www.amazon.com/gp/aws/cart/add.html?${params.toString()}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buyCell(item, associateTag) {
  if (item.estimate) {
    return '<span class="muted">AWH-supplied estimate</span>';
  }
  const url = itemUrl(item, associateTag);
  if (!url) return '<span class="muted">—</span>';
  const rel = item.affiliate ? 'sponsored nofollow noopener' : 'nofollow noopener';
  const label = item.affiliate ? 'Buy' : 'Buy (non-affiliate)';
  const cls = item.affiliate ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
  return `<a class="${cls}" href="${escapeHtml(url)}" target="_blank" rel="${rel}">${label}</a>`;
}

export function renderBom(bom, root) {
  const associateTag = bom.amazonAssociateTag;
  const items = bom.items || [];
  root.querySelector('[data-title]').textContent = bom.title;
  const note = root.querySelector('[data-price-note]');
  if (note) note.textContent = bom.priceCheckedNote;

  const body = items.map((item) => {
    const noteRow = item.note
      ? `<div class="item-note">${escapeHtml(item.note)}</div>`
      : '';
    const list = item.listPrice
      ? `<div class="list-price">List ${money(item.listPrice)}</div>`
      : '';
    return `<tr>
      <td>
        <div class="item-name">${escapeHtml(item.item)}</div>
        <div class="item-model">${escapeHtml(item.model)}</div>
        ${noteRow}
      </td>
      <td class="num">${escapeHtml(item.qty)}</td>
      <td class="num">${money(item.unitPrice)}${list}</td>
      <td class="num">${money(lineTotal(item))}</td>
      <td>${escapeHtml(item.retailer)}</td>
      <td class="buy">${buyCell(item, associateTag)}</td>
    </tr>`;
  }).join('');

  root.querySelector('[data-rows]').innerHTML = body;
  root.querySelector('[data-subtotal]').textContent = money(subtotal(items));

  const cart = root.querySelector('[data-amazon-cart]');
  if (cart) {
    cart.href = amazonCartUrl(bom);
    cart.target = '_blank';
    cart.rel = 'sponsored nofollow noopener';
  }
}

export async function loadBom(url = './bom.json') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load bill of materials (${res.status})`);
  return res.json();
}

const root = typeof document !== 'undefined' ? document.querySelector('[data-bom]') : null;
if (root) {
  loadBom().then((bom) => renderBom(bom, root)).catch((err) => {
    const status = root.querySelector('[data-status]');
    if (status) status.textContent = err.message || 'Could not load the bill of materials.';
  });
}
