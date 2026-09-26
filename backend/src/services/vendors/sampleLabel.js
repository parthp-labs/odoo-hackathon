// ---------------------------------------------------------------------------
// Sample-data labelling for vendor + price rows (Task 4).
//
// Every vendor firm, GSTIN and rupee price in this demo is fictional but
// plausible. The UI needs ONE unambiguous flag to render a "demo data" badge,
// while the underlying provenance fields (source/confidence/isVerified) keep
// carrying the detail.
//
// The flag is DERIVED, never hardcoded. A row is sample data unless it carries
// explicit live provenance. That direction matters: if a real price feed is
// ever wired in, its rows flip to isSample:false automatically instead of
// being mislabelled by a flag someone remembered to flip.
// ---------------------------------------------------------------------------

const LIVE_SOURCES = new Set(['live', 'ceda', 'agmarknet', 'nse', 'api']);
const SAMPLE_SOURCES = new Set(['seed', 'demo', 'sample', 'synthetic']);
const SAMPLE_CONFIDENCE = new Set(['demo', 'sample', 'synthetic']);

/**
 * Is this row fictional demo data?
 *
 * Precedence, most authoritative first:
 *   1. explicit sample provenance (source/confidence in the sample sets) -> true
 *   2. explicit live provenance (source in the live set)              -> false
 *   3. a verified vendor with no live source                          -> false
 *   4. anything else, including a missing/unknown row                 -> true
 *
 * Sample provenance deliberately outranks isVerified: a row that says it came
 * from the seed is a seed row even if some future script flipped isVerified,
 * because claiming a fictional GSTIN is verified would be the actual lie.
 *
 * @param {object|null|undefined} row provenance fields (source, confidence, isVerified)
 * @returns {boolean}
 */
export function isSampleRow(row) {
  if (!row) return true;

  // Read defensively: mongoose documents expose schema paths as prototype
  // getters, so own-property access alone would miss them.
  const source = String(row.source ?? '').trim().toLowerCase();
  const confidence = String(row.confidence ?? '').trim().toLowerCase();
  const isVerified = row.isVerified === true;

  if (SAMPLE_SOURCES.has(source) || SAMPLE_CONFIDENCE.has(confidence)) return true;
  if (LIVE_SOURCES.has(source)) return false;
  if (isVerified) return false;
  return true;
}

/**
 * Short human-readable badge text for a row.
 * @param {object} row
 * @returns {string}
 */
export function sampleLabel(row) {
  if (!isSampleRow(row)) return 'Live data';
  const source = String(row?.source ?? '').trim().toLowerCase();
  if (source === 'seed' || source === 'demo') return 'Demo data (fictional vendor)';
  return 'Demo data (synthetic)';
}

/**
 * Spread the sample fields onto a projected row. Returns a NEW object so
 * callers cannot accidentally mutate a cached lean document.
 * @param {object} row
 * @returns {object} row + { isSample, sampleLabel }
 */
export function withSampleLabel(row) {
  return { ...row, isSample: isSampleRow(row), sampleLabel: sampleLabel(row) };
}
