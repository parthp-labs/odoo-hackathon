// Live commodity price adapter — a real, legal, clearly-labeled price signal.
// Tries AGMARKNET (data.gov.in free API) first, falls back to CEDA AGRI, and on
// any failure returns { live:false } so the caller uses the seed and tags it
// 'seed'. The demo NEVER blocks on the network: timeout is short and every path
// returns a resolved object.

const TIMEOUT_MS = 3000;

/**
 * Fetch a commodity's wholesale/market price. Returns a normalized record or
 * { live:false } on any failure.
 * @param {string} commodity Free-text commodity (e.g. 'rice', 'wheat').
 * @param {object} opts { agmarknetKey, cedaKey }
 * @returns {Promise<{live:boolean, source:string, commodity:string, market?:string, minPrice?:number, maxPrice?:number, modalPrice?:number, unit?:string, date?:string} | {live:false, source:'seed'}>}
 */
export async function fetchCommodityPrice(commodity, opts = {}) {
  const agmarknetKey = opts.agmarknetKey || process.env.AGMARKNET_API_KEY;
  if (agmarknetKey) {
    try {
      const r = await fetchWithTimeout(
        `https://api.data.gov.in/resource/${process.env.AGMARKNET_RESOURCE_ID || '9ef84268-d588-465a-a308-a864a43d0070'}` +
          `?api-key=${encodeURIComponent(agmarknetKey)}&format=json&filters[commodity]=${encodeURIComponent(commodity)}`,
        { method: 'GET' }
      );
      if (r.ok) {
        const data = await r.json();
        const rec = normalizeAgmarknet(data, commodity);
        if (rec) return rec;
      }
    } catch (_) {
      // fall through to CEDA
    }
  }

  if (opts.cedaKey || process.env.CEDA_API_KEY) {
    try {
      const r = await fetchWithTimeout(
        `https://ceda.ashoka.edu.in/api/v1/price?commodity=${encodeURIComponent(commodity)}&limit=1`,
        {
          method: 'GET',
          headers: { Authorization: `Api-Key ${opts.cedaKey || process.env.CEDA_API_KEY}` },
        }
      );
      if (r.ok) {
        const data = await r.json();
        const rec = normalizeCeda(data, commodity);
        if (rec) return rec;
      }
    } catch (_) {
      // fall to seed
    }
  }

  return { live: false, source: 'seed', commodity };
}

/** map an AGMARKNET data.gov.in response to the normalized shape */
export function normalizeAgmarknet(data, commodity) {
  const records = data?.records || data?.data || [];
  const first = Array.isArray(records) ? records[0] : records;
  if (!first) return null;
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    live: true,
    source: 'agmarknet',
    commodity,
    market: first.market || first.market_name || first.marketName || null,
    minPrice: num(first.min_price ?? first.minPrice),
    maxPrice: num(first.max_price ?? first.maxPrice),
    modalPrice: num(first.modal_price ?? first.modalPrice),
    unit: first.unit || 'quintal',
    date: first.arrival_date || first.arrivalDate || first.date || null,
  };
}

/** map a CEDA API response to the normalized shape */
export function normalizeCeda(data, commodity) {
  const rows = data?.data || data?.results || data?.records;
  const first = Array.isArray(rows) ? rows[0] : (rows ? Object.values(rows)[0] : null);
  if (!first) return null;
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    live: true,
    source: 'ceda',
    commodity,
    market: first.market || first.market_name || null,
    minPrice: num(first.min_price ?? first.minimum_price),
    maxPrice: num(first.max_price ?? first.maximum_price),
    modalPrice: num(first.modal_price ?? first.average_price ?? first.modal),
    unit: first.unit || 'quintal',
    date: first.date || first.arrival_date || null,
  };
}

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}