#!/usr/bin/env python3
"""Export Python-parity fixtures for the pure-Node SVR predictor (Plan Task 2).

Loads the frozen artifact (svm_model.json) and the on-disk generated series
(artifacts/synthetic_series.json — produced by the real generator, so parity is
guaranteed by construction), runs Python's own build_features + svr_predict_raw
on 3 (sku, labelWeek) tuples in the TEST region (labelWeek >= 48 and < 59), and
writes backend/tests/fixtures/svm_parity.json.

The JS predictor (src/services/svm/svrPredictor.js) must reproduce every
expectedPred within tolerance; that is the honest parity fixture.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from train_svr import load, series_by_sku, build_features, svr_predict_raw  # noqa: E402

OUT_PATH = os.path.normpath(os.path.join(HERE, "..", "..", "tests", "fixtures", "svm_parity.json"))

# (sku, labelWeek) — all SKUs have kind 'svr' in the frozen artifact; labelWeeks
# are in the TEST region: >= 48 (60 - 12 holdout) and < 59 (feature row exists).
TARGETS = [
    ("BOLT-HEX-M8-P50", 50),
    ("ALUM-25X25-BAR", 52),
    ("CHAIR-ERGO-MESH", 55),
]


def main():
    ds = load()
    series_map, meta = series_by_sku(ds)
    with open(os.path.join(HERE, "artifacts", "svm_model.json")) as f:
        artifact = json.load(f)

    rows = []
    for sku, label_week in TARGETS:
        entry = artifact["skus"][sku]
        assert entry.get("kind") == "svr", f"{sku} is not an svr entry in the frozen artifact"
        profile = meta[sku]["profile"]
        base = meta[sku]["baseWeeklyDemand"]
        series = series_map[sku]

        X, _y, w = build_features(series, profile, base)
        idx = w.index(label_week)  # build_features: w[i] = t + 1 = label week
        expected_pred = float(svr_predict_raw(entry, X[idx])[0])

        rows.append({
            "sku": sku,
            "profile": profile,
            "base": base,
            "series": [int(q) for q in series],
            "labelWeek": label_week,
            "expectedPred": expected_pred,
        })

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump({"model": artifact["model"], "version": artifact["version"], "rows": rows}, f, indent=2)

    for r in rows:
        print(f"wrote {r['sku']} labelWeek={r['labelWeek']} expectedPred={r['expectedPred']!r}")
    print(f"fixture rows: {len(rows)} -> {OUT_PATH}")


if __name__ == "__main__":
    main()
