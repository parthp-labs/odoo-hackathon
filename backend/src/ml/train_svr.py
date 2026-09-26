#!/usr/bin/env python3
"""Train per-SKU demand forecasters (SVR + Croston + baseline) with cold-start
guard, evaluate with time split, and FREEZE the chosen models to a portable
JSON artifact (svm_model.json) a pure-Node server can load and run.

Local-only, no commits/pushes.

Frozen artifact is per-SKU and carries raw sklearn parameters (no pickle) so JS
can reconstruct inference:
  - svr:      scaler mean/scale + SVR supportVectors/dualCoef/intercept/gamma
  - croston:  logistic coef/intercept (P nonzero) + size SVR (or constant)
  - baseline / guard_base: trailing-mean recipe (no weights)
Served inference also needs the recent demand history at serve-time (lags +
rolling stats + trend + cold-start ratio derive from it), so the artifact
carries model weights + feature recipe, not the series.
"""
import json, os, math, functools
import numpy as np
from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "artifacts", "synthetic_series.json")
OUT = os.path.join(HERE, "artifacts", "svm_model.json")
NUM_HOLDOUT_WEEKS = 12
PROFILES = {"A", "B", "C", "D"}
MIN_TRAIN_HISTORY_WEEKS = 16
MIN_NONZERO_HISTORY = 6
FEATURE_NAMES = [
    "lag1", "lag2", "lag3", "lag4",
    "sum4", "mean4", "zero_count4",
    "woy_sin", "woy_cos", "trend",
    "history_length", "nonzero_ratio",
    "profile_A", "profile_B", "profile_C", "profile_D",
    "base",
]


def load():
    with open(DATA) as f:
        return json.load(f)


def series_by_sku(ds):
    out = {}
    for row in ds["rows"]:
        out.setdefault(row["sku"], []).append(row["qty"])
    return out, ds["skuMeta"]


def build_features(series, profile, base, weeks=60):
    X, y, w = [], [], []
    for t in range(4, len(series) - 1):
        lag1, lag2, lag3, lag4 = series[t - 3], series[t - 2], series[t - 1], series[t]
        sum4 = sum(series[t - 3 : t + 1])
        mean4 = sum4 / 4.0
        zero_count4 = sum(1 for q in series[t - 3 : t + 1] if q == 0)
        woy_sin = math.sin(2 * math.pi * t / 52.0)
        woy_cos = math.cos(2 * math.pi * t / 52.0)
        trend = t / 60.0
        hist = series[: t + 1]
        history_length = sum(1 for q in hist if q > 0) / max(1, len(hist))
        nonzero_ratio = history_length
        pdummy = [1.0 if profile == p else 0.0 for p in sorted(PROFILES)]
        X.append([lag1, lag2, lag3, lag4, sum4, mean4, zero_count4,
                  woy_sin, woy_cos, trend, history_length, nonzero_ratio] + pdummy + [float(base)])
        y.append(float(series[t + 1]))
        w.append(t + 1)
    return np.array(X), np.array(y), w


def trailing_mean_pred(series, t_window=8):
    return float(np.mean(series[-t_window:])) if series else 0.0


def eval_metrics(y, pred):
    pred = np.asarray(pred, dtype=float).ravel()
    y = np.asarray(y, dtype=float).ravel()
    mae = float(np.mean(np.abs(y - pred)))
    wape = float(np.sum(np.abs(y - pred)) / np.sum(np.abs(y))) if np.sum(np.abs(y)) > 0 else float("inf")
    bias = float(np.mean(pred - y))
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    return {"mae": mae, "wape": wape, "bias": bias, "r2": r2}


def serialize_svr(pipe):
    scaler = pipe.named_steps["scale"]
    svr = pipe.named_steps["svr"]
    gamma = 0.05  # we always pass an explicit float gamma at fit time
    return {
        "kind": "svr",
        "scaler": {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
        "svr": {
            "gamma": float(svr.gamma if isinstance(svr.gamma, (int, float)) else gamma),
            "support_vectors": svr.support_vectors_.tolist(),
            "dual_coef": [float(c) for c in svr.dual_coef_[0].tolist()],
            "intercept": float(svr.intercept_[0]),
        },
    }


def serialize_logistic(clf):
    return {"coef": [float(c) for c in clf.coef_[0].tolist()], "intercept": float(clf.intercept_[0])}


def fit_selector(series, profile, base):
    """Per-SKU: fit candidates, pick best by in-SKU walk-forward, freeze chosen."""
    X, y, w = build_features(series, profile, base)
    boundary = len(series) - NUM_HOLDOUT_WEEKS
    tr_idx = [i for i, wi in enumerate(w) if wi < boundary]

    base_preds = np.array([trailing_mean_pred(series[: int(w[i])]) for i in tr_idx])
    base_mae = float(np.mean(np.abs(y[tr_idx] - base_preds)))

    nonzero_tr = sum(1 for i in tr_idx if y[i] > 0)
    if len(tr_idx) < MIN_TRAIN_HISTORY_WEEKS or nonzero_tr < MIN_NONZERO_HISTORY:
        return {"kind": "guard_base", "baseline_mae": base_mae}

    Xtr, ytr = X[tr_idx], y[tr_idx]
    models = {}

    try:
        pipe = Pipeline([("scale", StandardScaler()), ("svr", SVR(C=100, epsilon=0.05, gamma=0.05))])
        pipe.fit(Xtr, ytr)
        models["svr"] = {"fn": lambda xt: np.asarray(pipe.predict(xt)).ravel(),
                         "frozen": serialize_svr(pipe)}
    except Exception:
        pass

    nz = ytr > 0
    if 0 < nz.sum() < len(ytr):
        try:
            prob = LogisticRegression(max_iter=1000)
            prob.fit(Xtr, (ytr > 0).astype(int))
            Xnz, ynz = Xtr[nz], ytr[nz]
            if len(np.unique(ynz)) > 1:
                sizer = Pipeline([("scale", StandardScaler()), ("svr", SVR(C=10, epsilon=0.05))])
                sizer.fit(Xnz, ynz)
                size_fn = lambda xt: np.asarray(sizer.predict(xt)).ravel()
                size_frozen = serialize_svr(sizer)
            else:
                mean_size = float(np.mean(ynz))
                size_fn = lambda xt: np.full(len(xt), mean_size)
                size_frozen = {"kind": "const", "value": mean_size}

            def croston(xt):
                p = prob.predict_proba(xt)[:, 1]
                size = np.asarray(size_fn(xt)).ravel()
                return p * size

            models["croston"] = {
                "fn": croston,
                "frozen": {"kind": "croston", "logistic": serialize_logistic(prob), "size": size_frozen},
            }
        except Exception:
            pass

    best_name, best_fn, best_mae, best_frozen = "baseline", None, base_mae, None
    neval = max(2, len(tr_idx) // 5)
    sub = tr_idx[-neval:]
    for name, m in models.items():
        pred = m["fn"](X[sub])
        mae = float(np.mean(np.abs(y[sub] - pred)))
        if mae < best_mae:
            best_mae, best_name, best_fn, best_frozen = mae, name, m["fn"], m["frozen"]
    if best_fn is None:
        return {"kind": "baseline", "baseline_mae": base_mae}
    return {"kind": best_name, "frozen": best_frozen, "baseline_mae": base_mae, "chosen_mae": best_mae}


def svr_predict_raw(m, x):
    """Reconstruct SVR prediction from raw params (mirror of sklearn), 2-D x."""
    x = np.asarray(x, dtype=float)
    x = x.reshape(1, -1) if x.ndim == 1 else x
    sv = np.array(m["svr"]["support_vectors"])
    dc = np.array(m["svr"]["dual_coef"])          # flat (n_sv,)
    if sv.shape[0] == 0:
        return np.full((x.shape[0],), float(m["svr"]["intercept"]))
    g = float(m["svr"]["gamma"])
    mean = np.array(m["scaler"]["mean"]); scale = np.array(m["scaler"]["scale"])
    sx = (x - mean) / scale
    diff = sx[:, None, :] - sv[None, :, :]          # (n_x, n_sv, d)
    k = np.exp(-g * np.sum(diff ** 2, axis=2))       # (n_x, n_sv)
    return (k * dc[None, :]).sum(axis=1) + float(m["svr"]["intercept"])


def croston_predict_raw(m, x):
    x = np.asarray(x, dtype=float)
    x = x.reshape(1, -1) if x.ndim == 1 else x
    z = x @ np.array(m["logistic"]["coef"]) + m["logistic"]["intercept"]
    p = 1.0 / (1.0 + np.exp(-z))
    if m["size"]["kind"] == "const":
        size = np.full_like(p, m["size"]["value"], dtype=float)
    else:
        size = svr_predict_raw(m["size"], x)
    return p * size


def predict_frozen(m, x):
    if m["kind"] == "croston":
        return croston_predict_raw(m, x)
    return svr_predict_raw(m, x)


def main():
    ds = load()
    series_map, meta = series_by_sku(ds)

    frozen = {}
    all_y, all_pred, all_sku, all_wk = [], [], [], []

    for sku in meta:
        series = series_map[sku]
        profile = meta[sku]["profile"]
        base = meta[sku]["baseWeeklyDemand"]
        X, y, w = build_features(series, profile, base)
        boundary = len(series) - NUM_HOLDOUT_WEEKS
        te_idx = [i for i, wi in enumerate(w) if wi >= boundary]

        sel = fit_selector(series, profile, base)
        kind = sel["kind"]

        for i in te_idx:
            label_week = int(w[i])
            if kind in ("svr", "croston"):
                pred = predict_frozen(sel["frozen"], X[i])[0]
            else:
                pred = trailing_mean_pred(series[: label_week])
            all_y.append(float(y[i]))
            all_pred.append(float(pred))
            all_sku.append(sku)
            all_wk.append(label_week)

        if kind in ("svr", "croston"):
            frozen[sku] = sel["frozen"]
        else:
            frozen[sku] = {"kind": kind, "window": 8, "baseline_mae": sel.get("baseline_mae")}

    all_y = np.array(all_y); all_pred = np.array(all_pred)
    om = eval_metrics(all_y, all_pred)

    print(f"per-SKU frozen kind: {frozenandkind(frozen)}")
    print(f"\ntotal test rows={len(all_y)}")
    print(f"=== FINAL (per-SKU selector + cold-start guard) ===")
    print(f"  MAE={om['mae']:.3f}  WAPE={om['wape']*100:.1f}%  bias={om['bias']:.3f}  R2={om['r2']:.3f}")
    print("\n  per-profile:")
    sku_arr = np.array(all_sku)
    for p in sorted(PROFILES):
        mask = np.array([meta[s]["profile"] == p for s in sku_arr])
        if mask.sum() == 0:
            print(f"    {p}: (no test rows)"); continue
        m = eval_metrics(all_y[mask], all_pred[mask])
        print(f"    {p}: n={mask.sum():3d} MAE={m['mae']:6.2f} WAPE={m['wape']*100:5.1f}% bias={m['bias']:6.2f} R2={m['r2']:.3f}")

    bp = np.array([trailing_mean_pred(series_map[s][: int(wk)]) for s, wk in zip(all_sku, all_wk)])
    bm = eval_metrics(all_y, bp)
    print("\n=== reference: trailing-mean baseline (no-leak) ===")
    print(f"  MAE={bm['mae']:.3f}  WAPE={bm['wape']*100:.1f}%  bias={bm['bias']:.3f}  R2={bm['r2']:.3f}")

    artifact = {
        "model": "per-sku-svr-forecast",
        "version": "v1",
        "featureNames": FEATURE_NAMES,
        "nFeatures": len(FEATURE_NAMES),
        "horizon": 1,
        "trainedAt": "2026-09-26",
        "data": "synthetic (7 sku x 60 wk; profiles A/B/C/D)",
        "split": {"trainRows": int((np.array(all_wk) < 48).sum()), "testRows": len(all_y),
                  "holdoutWeeks": NUM_HOLDOUT_WEEKS},
        "metrics": om,
        "skuMeta": {s: {"profile": meta[s]["profile"], "baseWeeklyDemand": meta[s]["baseWeeklyDemand"]} for s in meta},
        "skus": frozen,
    }
    with open(OUT, "w") as f:
        json.dump(artifact, f, indent=2)
    print(f"\nFROZEN artifact written: {OUT}  ({os.path.getsize(OUT)} bytes)")
    print("per-SKU kinds:", frozenandkind(frozen))


def frozenandkind(frozen):
    return {k: (v.get("kind") if v.get("kind") else "svr") for k, v in frozen.items()}


if __name__ == "__main__":
    main()