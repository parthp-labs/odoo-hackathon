import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgmarknet, normalizeCeda } from '../src/services/vendors/commodityAdapter.js';

test('normalizeAgmarknet maps a data.gov.in payload correctly', () => {
  const rec = normalizeAgmarknet(
    {
      records: [
        {
          market: 'Azadpur',
          min_price: '1000',
          max_price: '1200',
          modal_price: '1100',
          unit: 'quintal',
          arrival_date: '2026-09-20',
        },
      ],
    },
    'rice'
  );
  assert.ok(rec.live);
  assert.strictEqual(rec.source, 'agmarknet');
  assert.strictEqual(rec.commodity, 'rice');
  assert.strictEqual(rec.market, 'Azadpur');
  assert.strictEqual(rec.minPrice, 1000);
  assert.strictEqual(rec.maxPrice, 1200);
  assert.strictEqual(rec.modalPrice, 1100);
  assert.strictEqual(rec.unit, 'quintal');
});

test('normalizeAgmarknet returns null on empty payload', () => {
  assert.strictEqual(normalizeAgmarknet({ records: [] }, 'rice'), null);
});

test('normalizeCeda maps a real CEDA /agmarknet/prices payload', () => {
  const rec = normalizeCeda(
    { data: [{ date: '2026-09-18', commodity_id: 1, market: 'Ludhiana Mandi', min_price: 900, max_price: 1000, modal_price: 950 }] },
    'wheat'
  );
  assert.ok(rec.live);
  assert.strictEqual(rec.source, 'ceda');
  assert.strictEqual(rec.commodity, 'wheat');
  assert.strictEqual(rec.market, 'Ludhiana Mandi');
  assert.strictEqual(rec.minPrice, 900);
  assert.strictEqual(rec.maxPrice, 1000);
  assert.strictEqual(rec.modalPrice, 950);
  assert.strictEqual(rec.date, '2026-09-18');
});

test('normalizeCeda warns on missing data', () => {
  assert.strictEqual(normalizeCeda({}, 'wheat'), null);
});