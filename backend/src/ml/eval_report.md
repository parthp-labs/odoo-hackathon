# SVM Demand-Forecast — Evaluation Report (local, uncommitted)

**Date:** 2026-09-26 · **Data:** synthetic (7 SKUs × 60 weeks, profiles A stable / B seasonal+trend / C intermittent / D cold-start), emitted by `export_synthetic_dataset.mjs` from the same pure JS generators used to seed Mongo. **Split:** time-based (train rows 301, test 84 = last 12 weeks/SKU), never shuffled.

## Headline result — the fix that mattered is per-SKU + cold-start guard

| Model | MAE | WAPE | R² |
|---|---|---|---|
| Original global SVR (one model for all SKUs) | 13.26 | 42.6% | 0.33 |
| **Final: per-SKU selector + cold-start guard** | **8.63** | **27.7%** | **0.61** |
| No-leak trailing-mean baseline (reference) | 9.26 | 29.8% | 0.60 |

**WAPE ratio (final / no-leak baseline) = 0.93 → the SVM now beats the trivial baseline honestly.** It also beats the original naive seasonal-naive reference (31.1%).

## Per-profile (test window) — where the win and the wall are

| Profile | SKUs | n | MAE | WAPE | R² | Verdict |
|---|---|---|---|---|---|---|
| A stable | 2 | 36 | 0.87 | **6.2%** | 0.98 | SVR nails it |
| B seasonal+trend | 2 | 24 | 3.84 | **8.8%** | 0.98 | SVR nails it |
| C intermittent | 1 | 12 | 1.00 | 199.6% | −1.3 | MAE fine; WAPE is a metric trap (near-zero actuals) |
| D cold-start | 1 | 12 | 49.15 | 56.0% | −0.21 | inherent: entire launch is in the holdout |

## The real learnings (not tuning folklore)

1. **One global SVR over all profiles was the biggest defect.** Per-SKU model selection (fit on each SKU's own train, walk-forward-chosen) took A from 10.5%→6.2% and B from 17.1%→8.8% WAPE, both to R²≈0.98.
2. **Cold-start (D) is not fixable by feature engineering.** The D SKU (STEEL-12MM-ROD, base 140) has its entire ~8-week demand ramp *inside* the 12-week holdout, so every train row is zeros. No model can infer a launch it never saw. The honest bound is to **guard**: hand cold-start SKUs to the trailing-mean baseline (which adapts once in-test demand appears) rather than let SVR extrapolate flat. Its residual error is the price of the rule, not a modeling failure.
3. **Intermittent (C) must be judged by MAE/bias, not WAPE.** WAPE explodes because near-zero actuals are in the denominator; MAE 1.00 units with bias near 0 is actually good behavior. The Croston-style split is present but the SVR already keeps MAE ~1.0.
4. **A baseline that "looks better" was leaking** — the original reference used `series[:wk+1]`, i.e., included the label week's own demand in the trailing mean (peek). Made no-leak (`series[:wk]`) for a fair comparison; model still beats it.

## What was NOT done (honesty)
- No random shuffle, no peeking, no SKU cherry-picking, no test re-using train. Split is purely time.
- The model is trained locally; **nothing is committed or pushed**.
- Serving as a Node artifact (JS SVR inference, Python parity test) is NOT yet built — this run focused on getting defensible accuracy first, per plan P1–P3. P4 (quantiles/safety stock) is the cleanup gate that would follow.

## Suggested next step if you want to ship it
Freeze these weights → export as `svm_model.json` (support vectors + dual coefs + intercept + scale params + per-SKU selector metadata) → build `svrPredictor.js` pure-JS inference + parity test → wire `SvmForecastPort` as the served forecast (statistical engine stays as baseline). That's the plan's M2–M3, still uncommitted.