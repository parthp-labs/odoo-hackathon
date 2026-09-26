// Mirrors the shape returned by GET /replenishment/recommendations,
// GET /replenishment/forecast/:sku and GET /replenishment/model-info.

export const mockReplenishment = [
  {
    sku: 'STL-ROD-12',
    productName: 'Steel Rods 12mm',
    onHand: 1950,
    reserved: 200,
    qtyToOrder: 620,
    trigger: 'reorder',
    forecastOverLeadTime: 1400,
    safetyStock: 380,
    method: 'svr',
    vendors: [
      { name: 'Bharat Steel Traders', price: 62.5, currency: 'INR', uom: 'kg', leadDays: 5, moq: 100 },
      { name: 'Konkan Metal Supply', price: 64.2, currency: 'INR', uom: 'kg', leadDays: 7, moq: 250 },
    ],
  },
  {
    sku: 'STL-ROD-16',
    productName: 'Steel Rods 16mm',
    onHand: 210,
    reserved: 0,
    qtyToOrder: 1100,
    trigger: 'reorder',
    forecastOverLeadTime: 1250,
    safetyStock: 300,
    method: 'svr',
    vendors: [{ name: 'Bharat Steel Traders', price: 68.0, currency: 'INR', uom: 'kg', leadDays: 5, moq: 100 }],
  },
  {
    sku: 'STL-SHT-02',
    productName: 'Steel Sheets 2mm',
    onHand: 580,
    reserved: 40,
    qtyToOrder: 0,
    trigger: 'none',
    forecastOverLeadTime: 320,
    safetyStock: 120,
    method: 'seasonalNaive',
    vendors: [{ name: 'Konkan Metal Supply', price: 1450, currency: 'INR', uom: 'units', leadDays: 6, moq: 20 }],
  },
]

function seededSeries(seed, weeks, base, amplitude) {
  const out = []
  let x = seed
  for (let i = 0; i < weeks; i++) {
    x = (x * 9301 + 49297) % 233280
    const noise = (x / 233280 - 0.5) * amplitude
    out.push(Math.max(0, Math.round(base + Math.sin(i / 3) * amplitude * 0.6 + noise)))
  }
  return out
}

export function mockForecastFor(sku, { horizon = 8, engine = 'svm' } = {}) {
  const row = mockReplenishment.find((r) => r.sku === sku)
  const base = row ? row.forecastOverLeadTime / 4 : 40
  const series = seededSeries(sku?.length || 7, 26, base, base * 0.4)
  const weekly = seededSeries((sku?.length || 7) + 3, horizon, base, base * 0.2)
  const pointForecast = weekly.reduce((a, b) => a + b, 0)
  return {
    sku,
    horizonWeeks: horizon,
    forecastedDemand: pointForecast,
    quantiles: {
      p10: Math.round(pointForecast * 0.75),
      p50: pointForecast,
      p90: Math.round(pointForecast * 1.3),
    },
    modelType: engine === 'svm' ? row?.method || 'svr' : 'seasonalNaive',
    generatedAt: new Date().toISOString(),
    series,
    weekly,
  }
}

export const mockModelInfo = {
  model: 'per-sku-svr-forecast',
  version: '1.0.0-demo',
  horizon: 8,
  nFeatures: 17,
  metrics: { wape: 0.277, mae: 4.1 },
  trainedAt: new Date().toISOString(),
}
