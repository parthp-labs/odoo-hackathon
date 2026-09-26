# StockSense Replenishment — Demand Forecasting + Vendor Sourcing

This feature adds a combined **replenishment flow** to the StockSense backend:

1. **Forecast** per-SKU weekly demand from the `StockMove` ledger
2. Compute a **reorder quantity** = forecast-over-lead-time + safety stock − (on-hand − reserved)
3. List the **available vendors + prices** to source that quantity (Indian seed demo dataset)

It builds on the existing inventory module (`Product`, `StockMove`, `StockQuant`, `Warehouse`, `Location`) and the existing auth (`protect`).

---

## Architecture

Everything sits behind **service boundaries** (ports), so implementations can be swapped without touching routes:

| Port | File | Provides |
|---|---|---|
| `ForecastPort` | `src/services/forecast/forecastPort.js` | `getForecast(sku, horizon)`, `refitAll()`, `aggregateWeeklyDemand(productId)` |
| `ReplenishPort` | `src/services/replenishment/replenishPort.js` | `recommendReorder(sku)`, `recommendAll()`, `listSourceableVendors(sku, productId)` |
| `MarketPort` | `src/services/vendors/marketPort.js` | `searchProducts()`, `getBestPricesForProduct()`, `searchVendors()` |

```
Express routes (protected)
      │
      ▼
 ForecastPort ──► pure JS methods (seasonalNaive / SES / HoltWinters / Croston)
      │            + rolling-origin backtest (WAPE / bias / MASE gate vs seasonal-naive)
      │            + Forecast snapshot persisted in Mongo
      ▼
 ReplenishPort ──► recommendReorder = forecastOverLead + safetyStock − (onHand − reserved)
      │            + top vendors by price
      ▼
 MarketPort ────► vendors + vendorPrices collections (seed)
```

## Forecasting approach (why it's Node-only, and why that's right)

The research (`.hermes/plans/research-stock-forecasting.md`, 2026-09-26) concluded that on the
per-SKU weekly series a small/mid inventory app holds, **simple statistical methods beat ML/DL**,
and deep learning needs data volumes a small app does not have. So:

- **Every SKU** builds a weekly demand series from OUT `StockMove` records over ~60 weeks.
- The builder (`src/services/forecast/builder.js`) picks a method per SKU by profile:
  - intermittent (high zero-rate) → **Croston** (SBA-debiased)
  - cold-start / short history → trailing **SMA**
  - otherwise → **Holt-Winters** weekly seasonality, else **SES**
- **The gate:** a method is only shipped if it **beats the seasonal-naive baseline on a rolling
  backtest (MASE < 1)**; otherwise that SKU falls back to seasonal-naive. Every SKU reports
  WAPE, bias, and MASE. Refits are cached in the `forecasts` collection and read on subsequent calls.

## Reorder formula

```
qtyToOrder = max(0, ceil(forecastOverLeadTime + safetyStock − (onHand − reserved)))

safetyStock = z · sqrt( leadWeeks·σ_D² + meanD²·σ_L² )     (King's formula)
  - σ_D derived from forecast quantile spread (p90 − p50)/1.28
  - z by service level: 90%→1.28, 95%→1.65, 98%→2.05, 99%→2.33
```

The recommendation also lists the cheapest vendors (2–5) that can source the product, so the
operator can place the order immediately.

## Vendor sourcing + honest provenance

Live Indian B2B marketplace vendor-price data (IndiaMART/TradeIndia) is **paywalled / ToS-locked** —
research confirmed there is no legitimate public API for it. So:

- **Curated seed** (`vendors` + `vendorPrices` collections, `confidence:'demo'`, `source:'seed'`) provides
  realistic Indian vendors + ₹ price tiers for the demo — clearly labeled sample data.

All vendor/price rows are fictional-but-plausible demo data (confidence:'demo', source:'seed').
No live price APIs are used; this is a self-contained demo dataset.

## Data seeding

- `npm run seed:history` → `node src/scripts/generateHistory.js` writes ~14 months of synthetic
  weekly OUT `StockMove` history with demand profiles (stable / seasonal / intermittent / cold-start).
- `npm run seed:vendors` → `node src/scripts/seedVendors.js` seeds the Indian vendor + price data.
- Both are deterministic and idempotent.

## HTTP API (all behind `protect`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/replenishment/recommendations?sku=X` | reorder recommendation for a SKU |
| GET | `/api/replenishment/recommendations` | recommendations for all forecasted SKUs |
| GET | `/api/replenishment/forecast/:sku?horizon=8` | cached forecast + quantiles + method |
| POST | `/api/replenishment/run` | refit all forecasts (batch) |
| GET | `/api/product/:sku/vendors` | vendors + prices for a product |
| GET | `/api/vendors/search?q=term` | search vendors by name/city |

## Tests

`npm test` — the replenishment suites are `tests/forecast.test.js` (pure math, hermetic),
`tests/forecastService.test.js`, `tests/reorder.test.js`, `tests/vendorService.test.js`,
and `tests/replenish.api.test.js` (protected routes).
DB-backed tests are **self-contained**: each creates and cleans up its own records so parallel
test files sharing the live Mongo never collide.