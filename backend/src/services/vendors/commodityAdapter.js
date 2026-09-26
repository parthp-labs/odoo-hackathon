// Live commodity price adapter — a real, legal, clearly-labeled price signal.
// PRIMARY: CEDA Agri Market API (api.ceda.ashoka.edu.in) — free self-serve key,
//   OpenAPI-published, 2000→present mandi min/max/modal ₹, stable from any IP.
//   Researched 2026-09-26 (research-good-price-api.md): spec extracted live from
//   /documentation/swagger-ui-init.js; POST /agmarknet/prices; Bearer JWT auth.
// SECONDARY: data.gov.in AGMARKNET resource — the official GoI co-source. NOTE: NIC's
//   WAF TCP-resets cloud-datacenter egress IPs (reproduced 3× today), so it's only
//   reliable from residential/dev IPs; kept as a fallback adapter, never the primary.
// On any failure returns { live:false } so the caller uses the seed and tags it
// 'seed'. The demo NEVER blocks on the network: short timeout, every path resolves.

const CEDA_BASE = 'https://api.ceda.ashoka.edu.in/v1';
const TIMEOUT_MS = 4000;

/**
 * Fetch a commodity's wholesale/market price. Returns a normalized record or
 * { live:false } on any failure.
 * @param {string} commodity Free-text commodity (e.g. 'rice', 'wheat').
 * @param {object} opts { cedaKey, agmarknetKey, commodityId, stateId }
 * @returns {Promise<{live:boolean, source:string, commodity:string, market?:string, minPrice?:number, maxPrice?:number, modalPrice?:number, unit?:string, date?:string} | {live:false, source:'seed'}>}
 */
export async function fetchCommodityPrice(commodity, opts = {}) {
  const cedaKey = opts.cedaKey || process.env.CEDA_API_KEY;
  if (cedaKey) {
    try {
      const rec = await fetchCedaPrice(commodity, cedaKey, opts);
      if (rec) return rec;
    } catch (_) {
      // fall through to AGMARKNET secondary
    }
  }

  const agmarknetKey = opts.agmarknetKey || process.env.AGMARKNET_API_KEY;
  if (agmarknetKey) {
    try {
      const rec = await fetchAgmarknetPrice(commodity, agmarknetKey);
      if (rec) return rec;
    } catch (_) {
      // fall to seed
    }
  }

  return { live: false, source: 'seed', commodity };
}

/** CEDA: resolve commodity_id, then POST /agmarknet/prices with Bearer JWT. */
async function fetchCedaPrice(commodity, key, opts = {}) {
  let commodityId = opts.commodityId;
  if (commodityId == null) {
    const listRes = await fetchWithTimeout(`${CEDA_BASE}/agmarknet/commodities`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!listRes.ok) return null;
    const listData = await listRes.json();
    commodityId = findCommodityId(listData, commodity);
    if (commodityId == null) return null;
  }

  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - 90 * 864e5).toISOString().slice(0, 10);

  const res = await fetchWithTimeout(`${CEDA_BASE}/agmarknet/prices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      commodity_id: Number(commodityId),
      state_id: Number(opts.stateId || 0), // 0 = national
      from_date: from,
      to_date: to,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return normalizeCeda(data, commodity);
}

/** AGMARKNET (data.gov.in): GET resource with api-key query (secondary). */
async function fetchAgmarknetPrice(commodity, key) {
  const res = await fetchWithTimeout(
    `https://api.data.gov.in/resource/${process.env.AGMARKNET_RESOURCE_ID || '9ef84268-d588-465a-a308-a864a43d0070'}` +
      `?api-key=${encodeURIComponent(key)}&format=json&filters[commodity]=${encodeURIComponent(commodity)}&limit=5`,
    { method: 'GET' }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return normalizeAgmarknet(data, commodity);
}

/** Heuristic commodity->id match against CEDA's [{id,name}] list. */
function findCommodityId(listData, commodity) {
  const arr = Array.isArray(listData) ? listData : listData?.data || listData?.records || [];
  const q = commodity.toLowerCase();
  let hit = arr.find((c) => String(c.name || c.commodity || '').toLowerCase() === q);
  if (hit) return hit.id ?? hit.commodity_id;
  hit = arr.find((c) => String(c.name || c.commodity || '').toLowerCase().includes(q));
  return hit ? (hit.id ?? hit.commodity_id) : null;
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

/** map a CEDA /agmarknet/prices response to the normalized shape */
export function normalizeCeda(data, commodity) {
  const rows = data?.data || data?.results || data?.records;
  const arr = Array.isArray(rows) ? rows : [];
  const first = arr.find((r) => r && Object.keys(r).length) || arr[0];
  if (!first) return null;
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    live: true,
    source: 'ceda',
    commodity,
    market: first.market_name || first.market || null,
    minPrice: num(first.min_price ?? first.minPrice),
    maxPrice: num(first.max_price ?? first.maxPrice),
    modalPrice: num(first.modal_price ?? first.modalPrice),
    unit: first.unit || 'quintal',
    date: first.date || first.arrival_date || null,
  };
}

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}