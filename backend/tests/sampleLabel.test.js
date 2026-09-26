// ---------------------------------------------------------------------------
// Task 4 — every vendor/price row the API serves is visibly labelled as
// fictional demo data.
//
// Why this is more than cosmetics: a judge looking at the Vendor Sourcing
// screen sees 120 Indian firms with GSTINs, cities, MOQs and rupee prices.
// Nothing in the payload distinguishes that from real procurement data. The
// repo already carries honest provenance fields (`source:'seed'`,
// `confidence:'demo'`, `isVerified:false`) but they are inconsistent across
// sinks and none of them is a single unambiguous "this is a sample" flag.
//
// These tests pin one rule: isSample is DERIVED from provenance rather than
// hardcoded — so if a genuinely live source is ever added, the flag flips to
// false on its own instead of lying.
// ---------------------------------------------------------------------------
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSampleRow, sampleLabel } from '../src/services/vendors/sampleLabel.js';

describe('Sample labelling rule (pure)', () => {
  it('marks seed/demo provenance as sample data', () => {
    assert.equal(isSampleRow({ source: 'seed', confidence: 'demo' }), true);
    assert.equal(isSampleRow({ source: 'seed' }), true);
    assert.equal(isSampleRow({ confidence: 'demo' }), true);
    assert.equal(isSampleRow({}), true, 'unlabelled rows are sample by default');
    assert.equal(isSampleRow(undefined), true);
    assert.equal(isSampleRow(null), true);
  });

  it('does NOT mark genuinely live provenance as sample', () => {
    assert.equal(isSampleRow({ source: 'ceda', confidence: 'live' }), false);
    assert.equal(isSampleRow({ source: 'agmarknet', confidence: 'live' }), false);
    assert.equal(isSampleRow({ source: 'live', confidence: 'live' }), false);
    assert.equal(isSampleRow({ source: 'live' }), false);
  });

  it('treats a verified vendor as real regardless of provenance', () => {
    assert.equal(isSampleRow({ isVerified: true, source: 'live' }), false);
    assert.equal(
      isSampleRow({ isVerified: true, source: 'seed', confidence: 'demo' }),
      true,
      'seed provenance outranks isVerified — a seeded row is never real'
    );
  });

  it('is case-insensitive and tolerates a real mongoose doc', () => {
    assert.equal(isSampleRow({ source: 'SEED' }), true);
    assert.equal(isSampleRow({ source: 'Demo' }), true);
    // A mongoose document exposes fields via getters, not own properties.
    class Doc {
      get source() {
        return 'seed';
      }
    }
    assert.equal(isSampleRow(new Doc()), true, 'must not rely on own-property access');
  });

  it('exposes a stable, human-readable label', () => {
    assert.equal(sampleLabel({ source: 'seed' }), 'Demo data (fictional vendor)');
    assert.equal(typeof sampleLabel({}), 'string');
  });
});
