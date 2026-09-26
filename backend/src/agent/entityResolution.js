const EXACT_SKU_CODE = 1.0;
const STARTS_WITH = 0.8;
const CONTAINS = 0.5;
const AMBIGUITY_DELTA = 0.05;
const MAX_CANDIDATES = 3;

/** Weigh how well a single field value matches the query. */
function scoreField(query, field, value) {
  if (value === undefined || value === null) return 0;
  const q = query.toLowerCase();
  const v = String(value).toLowerCase();
  if (v === q) {
    // Full equality on sku/code is the strongest signal.
    return field === 'sku' || field === 'code' ? EXACT_SKU_CODE : STARTS_WITH;
  }
  if (v.startsWith(q)) return STARTS_WITH;
  if (v.includes(q)) return CONTAINS;
  return 0;
}

/**
 * Score a single catalog item against the query by taking the best match
 * across its name, sku, and code fields.
 */
function scoreItem(query, item) {
  let best = 0;
  for (const field of ['name', 'sku', 'code']) {
    best = Math.max(best, scoreField(query, field, item[field]));
  }
  return best;
}

/**
 * Resolve a free-text reference to a catalog item.
 *
 * @param {{queryText: string, catalog: Array, key?: string}} params
 *   catalog items are { id, name, sku?, code? }.
 * @returns {{resolved: object|null, candidates: Array, ambiguous: boolean}}
 */
export function resolveEntity({ queryText, catalog, key }) {
  const query = String(queryText ?? '');
  void key;

  if (query.trim() === '') {
    return { resolved: null, candidates: [], ambiguous: true };
  }

  const scored = catalog
    .map((item) => ({ item, score: scoreItem(query, item) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { resolved: null, candidates: [], ambiguous: true };
  }

  const best = scored[0].score;
  const tied = scored.filter((s) => s.score >= best - AMBIGUITY_DELTA);
  const candidates = scored.slice(0, MAX_CANDIDATES).map((s) => s.item);

  const ambiguous = tied.length >= 2;
  return {
    resolved: ambiguous ? null : candidates[0],
    candidates,
    ambiguous,
  };
}

/**
 * Build a human-readable disambiguation question from candidate items.
 *
 * @param {Array<{name?: string, sku?: string, code?: string, id?: string}|string>} candidates
 * @returns {string}
 */
export function promptForDisambiguation(candidates) {
  if (!candidates || candidates.length === 0) {
    return 'Did you mean...? No clear match found.';
  }
  const labels = candidates.map((c) =>
    typeof c === 'string'
      ? c
      : (c.name ?? c.sku ?? c.code ?? String(c.id))
  );
  return `Did you mean: ${labels.join(', ')}?`;
}