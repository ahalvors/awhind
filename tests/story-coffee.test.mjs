import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { amazonCartUrl, amazonItems, buyUrl, lineTotal, money, subtotal } from '../clients/story-coffee/app.mjs';

const bom = JSON.parse(fs.readFileSync('clients/story-coffee/bom.json', 'utf8'));
const page = fs.readFileSync('clients/story-coffee/index.html', 'utf8');
const disclosure = fs.readFileSync('disclosure/index.html', 'utf8');
const robots = fs.readFileSync('robots.txt', 'utf8');
const toml = fs.readFileSync('netlify.toml', 'utf8');
const sitemapBuild = fs.readFileSync('build-sitemap.js', 'utf8');
const sitemap = fs.existsSync('sitemap.xml') ? fs.readFileSync('sitemap.xml', 'utf8') : '';

test('associate tag lives in one bom.json config value', () => {
  assert.equal(bom.amazonAssociateTag, 'weighhere-20');
  assert.equal(page.includes('weighhere-20'), false);
  assert.equal(page.includes('awhind-20'), false);
});

test('bom items have the required fields and expected catalog', () => {
  const required = ['item', 'model', 'qty', 'unitPrice', 'priceChecked', 'retailer', 'affiliate'];
  assert.equal(bom.items.length, 8);
  for (const item of bom.items) {
    for (const key of required) assert.ok(key in item, `${item.id || item.item} missing ${key}`);
    assert.equal(item.priceChecked, '2026-11-19');
  }
  const byId = Object.fromEntries(bom.items.map((item) => [item.id, item]));
  assert.equal(bom.items.some((item) => item.asin === 'B0CV2HW5LT'), false);
  assert.equal(bom.items.some((item) => (item.url || '').includes('monoprice.com')), false);
  assert.equal(byId['jbl-control-65pt-wh-pair'].asin, 'B00519RSDC');
  assert.equal(byId['jbl-control-65pt-wh-pair'].qty, 3);
  assert.equal(byId['jbl-control-65pt-wh-pair'].unitPrice, 440);
  assert.equal(byId['jbl-control-65pt-wh-pair'].affiliate, true);
  assert.equal(byId['wiim-pro'].asin, 'B0BJDY6D1W');
  assert.equal(byId['wiim-pro'].unitPrice, 135.20);
  assert.equal(byId['jbl-control-25-1-wh'].asin, 'B01BT3DNN2');
  assert.equal(byId['jbl-control-25-1-wh'].unitPrice, 398);
  assert.equal(byId['atlas-at35'].asin, 'B001POEZHO');
  assert.equal(byId['atlas-at35'].unitPrice, 43.99);
  assert.equal(byId['jbl-mtc-pc2'].asin, 'B008BMMJYE');
  assert.equal(byId['jbl-mtc-pc2'].unitPrice, 46.50);
  assert.equal(byId['jbl-csa-280z'].affiliate, false);
  assert.match(byId['jbl-csa-280z'].url, /bhphotovideo\.com/);
  assert.equal(byId['jbl-csa-280z'].unitPrice, 498);
  assert.equal(byId['west-penn-25225bwh0500'].affiliate, false);
  assert.equal(byId['west-penn-25225bwh0500'].unitPrice, 137.60);
  assert.equal(byId['west-penn-25225bwh0500'].url, 'https://www.aiconsol.com/25225bwh0500-west-penn-wire.html');
  assert.equal(byId['west-penn-25225bwh0500'].alternate.retailer, 'Markertek');
  assert.match(byId['west-penn-25225bwh0500'].alternate.url, /markertek\.com/);
  assert.equal(byId['west-penn-25225bwh0500'].alternate.unitPrice, 145.79);
  assert.equal(byId['small-hardware'].estimate, true);
  assert.equal(byId['small-hardware'].unitPrice, 190);
  assert.equal(byId['small-hardware'].url, undefined);
});

test('Amazon cart URL and per-item links use the shared associate tag', () => {
  const cart = amazonCartUrl(bom);
  assert.equal(
    cart,
    'https://www.amazon.com/gp/aws/cart/add.html?AssociateTag=weighhere-20&ASIN.1=B00519RSDC&Quantity.1=3&ASIN.2=B0BJDY6D1W&Quantity.2=1&ASIN.3=B01BT3DNN2&Quantity.3=1&ASIN.4=B001POEZHO&Quantity.4=1&ASIN.5=B008BMMJYE&Quantity.5=1'
  );
  assert.equal(amazonItems(bom.items).length, 5);
  for (const item of amazonItems(bom.items)) {
    assert.equal(buyUrl(item, bom), cart);
  }
  assert.equal(buyUrl(bom.items[5], bom), bom.items[5].url);
  assert.equal(buyUrl(bom.items[6], bom), bom.items[6].url);
  assert.equal(buyUrl(bom.items[7], bom), null);
});

test('Amazon buy buttons are buy-all links, not single-ASIN product pages', () => {
  const app = fs.readFileSync('clients/story-coffee/app.mjs', 'utf8');
  assert.match(app, /Buy all on Amazon/);
  assert.match(page, /Any Amazon button on this page adds all Amazon items to a cart/);
  assert.doesNotMatch(app, /amazon\.com\/dp\//);
  assert.doesNotMatch(page, /weighhere-20|awhind-20/);
  assert.equal((app.match(/amazonCartUrl\(/g) || []).length >= 2, true);
});

test('line totals and subtotal add up', () => {
  assert.equal(lineTotal({ qty: 1, unitPrice: 46.5 }), 46.5);
  assert.equal(lineTotal({ qty: 3, unitPrice: 440 }), 1320);
  assert.equal(money(135.2), '$135.20');
  assert.equal(subtotal(bom.items), 2769.29);
});

test('buy page is noindex, fetches bom.json, and uses sponsored buy links', () => {
  const app = fs.readFileSync('clients/story-coffee/app.mjs', 'utf8');
  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(app, /loadBom/);
  assert.match(app, /\.\/bom\.json/);
  assert.match(app, /sponsored nofollow noopener/);
  assert.match(page, /Prices checked Nov 19, 2026; may change\./);
  assert.match(page, /amazon-all-note/);
  assert.match(page, /As an Amazon Associate, AWH Industries earns from qualifying purchases/);
  assert.match(page, /href="\/disclosure\/"/);
  assert.match(page, /data-amazon-cart/);
  assert.match(page, /type="module" src="\.\/app\.mjs"/);
});

test('robots and Netlify headers keep /clients/ out of search results', () => {
  assert.match(robots, /Disallow:\s*\/clients\//);
  assert.match(toml, /for = "\/clients\/\*"/);
  assert.match(toml, /X-Robots-Tag = "noindex, nofollow"/);
});

test('sitemap includes /disclosure/ and omits /clients/', () => {
  assert.match(sitemapBuild, /https:\/\/awhind\.com\/disclosure\//);
  assert.equal(sitemapBuild.includes('/clients/'), false);
  if (sitemap) {
    assert.match(sitemap, /https:\/\/awhind\.com\/disclosure\//);
    assert.equal(sitemap.includes('/clients/'), false);
  }
});

test('disclosure page is indexable and states the associate relationship', () => {
  assert.doesNotMatch(disclosure, /noindex/i);
  assert.match(disclosure, /<link rel="canonical" href="https:\/\/awhind\.com\/disclosure\/">/);
  assert.match(disclosure, /Amazon Services LLC Associates Program/);
  assert.match(disclosure, /As an Amazon Associate, AWH Industries earns from qualifying purchases/);
});
