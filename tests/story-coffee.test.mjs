import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { amazonCartUrl, amazonItems, buyUrl, isInstallHardware, lineTotal, money, subtotal } from '../clients/story-coffee/app.mjs';

const bom = JSON.parse(fs.readFileSync('clients/story-coffee/bom.json', 'utf8'));
const page = fs.readFileSync('clients/story-coffee/index.html', 'utf8');
const disclosure = fs.readFileSync('disclosure/index.html', 'utf8');
const robots = fs.readFileSync('robots.txt', 'utf8');
const toml = fs.readFileSync('netlify.toml', 'utf8');
const sitemapBuild = fs.readFileSync('build-sitemap.js', 'utf8');
const sitemap = fs.existsSync('sitemap.xml') ? fs.readFileSync('sitemap.xml', 'utf8') : '';

const EXPECTED_CART = 'https://www.amazon.com/gp/aws/cart/add.html?AssociateTag=weighhere-20&ASIN.1=B00519RSDC&Quantity.1=3&ASIN.2=B0BJDY6D1W&Quantity.2=1&ASIN.3=B01BT3DNN2&Quantity.3=1&ASIN.4=B001POEZHO&Quantity.4=1&ASIN.5=B008BMMJYE&Quantity.5=1&ASIN.6=B01M293JOP&Quantity.6=1&ASIN.7=B01D5H8PQ0&Quantity.7=1&ASIN.8=B07869J8M8&Quantity.8=1&ASIN.9=B003D879OG&Quantity.9=1&ASIN.10=B0CP9Y8NJZ&Quantity.10=1';

const HARDWARE_AMAZON = [
  ['skywalker-bridle-2in-25', 'B01M293JOP', 1, 22.99],
  ['amazon-basics-rca-8ft', 'B01D5H8PQ0', 1, 7.03],
  ['mr-label-cable-tags-100', 'B07869J8M8', 1, 9.99],
  ['panduit-plt2i-c', 'B003D879OG', 1, 17.30],
  ['cable-matters-cat6-6ft-wh', 'B0CP9Y8NJZ', 1, 7.79],
];

const HOME_DEPOT_IDS = [
  'everbilt-eye-lag-14-334',
  'carlon-b120r',
  'wiremold-500-5ft',
  'wiremold-500-acc',
  'tapcon-ss-14-175-8',
  'tapcon-bit-316-552',
  'milwaukee-bit-78-6in',
  'cantex-pvc-12-10ft',
  'ce-bushing-12-10pk',
  'osi-quad-max-white',
  'bell-wp-box-5323',
  'taymac-mm420c',
];

test('associate tag lives in one bom.json config value', () => {
  assert.equal(bom.amazonAssociateTag, 'weighhere-20');
  assert.equal(page.includes('weighhere-20'), false);
  assert.equal(page.includes('awhind-20'), false);
});

test('bom items have the required fields and expected catalog', () => {
  const required = ['item', 'model', 'qty', 'unitPrice', 'priceChecked', 'retailer', 'affiliate'];
  assert.equal(bom.items.length, 24);
  assert.equal(bom.items.filter(isInstallHardware).length, 17);
  assert.equal(bom.items.filter((item) => !isInstallHardware(item)).length, 7);
  assert.equal(bom.items.some((item) => item.id === 'small-hardware'), false);
  assert.equal(bom.items.some((item) => item.estimate), false);

  const byId = Object.fromEntries(bom.items.map((item) => [item.id, item]));
  for (const item of bom.items) {
    for (const key of required) assert.ok(key in item, `${item.id || item.item} missing ${key}`);
    if (isInstallHardware(item)) {
      assert.equal(item.section, 'install-hardware');
      assert.equal(item.priceChecked, '2026-11-20');
    } else {
      assert.equal(item.priceChecked, '2026-11-19');
    }
  }

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

  for (const [id, asin, qty, unitPrice] of HARDWARE_AMAZON) {
    assert.equal(byId[id].asin, asin);
    assert.equal(byId[id].qty, qty);
    assert.equal(byId[id].unitPrice, unitPrice);
    assert.equal(byId[id].affiliate, true);
    assert.equal(byId[id].retailer, 'Amazon');
    assert.equal(isInstallHardware(byId[id]), true);
  }
  assert.match(byId['panduit-plt2i-c'].note, /Low stock on Nov 20, 2026/);
  assert.match(byId['panduit-plt2i-c'].note, /B0BMM8D6V9/);
  assert.equal(byId['everbilt-eye-lag-14-334'].qty, 12);
  assert.equal(byId['everbilt-eye-lag-14-334'].unitPrice, 1.30);
  assert.equal(byId['tapcon-ss-14-175-8'].qty, 2);
  assert.equal(byId['tapcon-ss-14-175-8'].unitPrice, 12.97);
});

test('Amazon cart URL covers all 10 ASINs with the shared associate tag', () => {
  const cart = amazonCartUrl(bom);
  assert.equal(cart, EXPECTED_CART);
  assert.equal(amazonItems(bom.items).length, 10);
  const asins = amazonItems(bom.items).map((item) => [item.asin, String(item.qty)]);
  assert.deepEqual(asins, [
    ['B00519RSDC', '3'],
    ['B0BJDY6D1W', '1'],
    ['B01BT3DNN2', '1'],
    ['B001POEZHO', '1'],
    ['B008BMMJYE', '1'],
    ['B01M293JOP', '1'],
    ['B01D5H8PQ0', '1'],
    ['B07869J8M8', '1'],
    ['B003D879OG', '1'],
    ['B0CP9Y8NJZ', '1'],
  ]);
  for (const item of amazonItems(bom.items)) {
    assert.equal(buyUrl(item, bom), cart);
  }
});

test('Home Depot and other non-affiliate links have no associate tag', () => {
  const byId = Object.fromEntries(bom.items.map((item) => [item.id, item]));
  const homeDepot = bom.items.filter((item) => item.retailer === 'Home Depot');
  assert.equal(homeDepot.length, 12);
  assert.deepEqual(homeDepot.map((item) => item.id), HOME_DEPOT_IDS);
  for (const item of homeDepot) {
    assert.equal(item.affiliate, false);
    assert.equal(item.asin, undefined);
    assert.ok(item.url.startsWith('https://www.homedepot.com/p/'));
    assert.doesNotMatch(item.url, /tag=|AssociateTag|associate|affiliate/i);
    assert.equal(buyUrl(item, bom), item.url);
    assert.equal(isInstallHardware(item), true);
  }
  assert.equal(buyUrl(byId['jbl-csa-280z'], bom), byId['jbl-csa-280z'].url);
  assert.equal(buyUrl(byId['west-penn-25225bwh0500'], bom), byId['west-penn-25225bwh0500'].url);
  assert.doesNotMatch(byId['jbl-csa-280z'].url, /tag=|AssociateTag/i);
  assert.doesNotMatch(byId['west-penn-25225bwh0500'].url, /tag=|AssociateTag/i);
});

test('Amazon buy buttons are buy-all links, not single-ASIN product pages', () => {
  const app = fs.readFileSync('clients/story-coffee/app.mjs', 'utf8');
  assert.match(app, /Buy all on Amazon/);
  assert.match(app, /Buy \(non-affiliate\)/);
  assert.match(page, /Any Amazon button on this page adds all Amazon items to a cart/);
  assert.match(page, /including the Amazon install-hardware items/);
  assert.doesNotMatch(page, /Small hardware is an AWH-supplied estimate and has no button/);
  assert.doesNotMatch(app, /amazon\.com\/dp\//);
  assert.doesNotMatch(page, /weighhere-20|awhind-20/);
  assert.equal((app.match(/amazonCartUrl\(/g) || []).length >= 2, true);
});

test('install hardware is grouped in its own section', () => {
  const app = fs.readFileSync('clients/story-coffee/app.mjs', 'utf8');
  assert.match(page, /<h2 class="section-title">Install hardware<\/h2>/);
  assert.match(page, /data-rows-gear/);
  assert.match(page, /data-rows-hardware/);
  assert.match(app, /data-rows-gear/);
  assert.match(app, /data-rows-hardware/);
  assert.match(app, /isInstallHardware/);
});

test('line totals and subtotal add up', () => {
  assert.equal(lineTotal({ qty: 1, unitPrice: 46.5 }), 46.5);
  assert.equal(lineTotal({ qty: 3, unitPrice: 440 }), 1320);
  assert.equal(lineTotal({ qty: 12, unitPrice: 1.3 }), 15.6);
  assert.equal(lineTotal({ qty: 2, unitPrice: 12.97 }), 25.94);
  assert.equal(money(135.2), '$135.20');
  assert.equal(subtotal(bom.items.filter(isInstallHardware)), 201.80);
  assert.equal(subtotal(bom.items), 2781.09);
});

test('buy page is noindex, fetches bom.json, and uses sponsored buy links', () => {
  const app = fs.readFileSync('clients/story-coffee/app.mjs', 'utf8');
  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(app, /loadBom/);
  assert.match(app, /\.\/bom\.json/);
  assert.match(app, /sponsored nofollow noopener/);
  assert.match(page, /Prices checked Nov 19–20, 2026; may change\./);
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
