"""Tracking accuracy against hand-annotated ground truth.

Ground truth uses the same JSON format as tracking.json, but only for the
frames you annotated (for example 20-30 frames chosen across the clip). For
each annotated frame the nearest predicted frame is matched to it, players
are paired one-to-one by minimum total distance (Hungarian assignment), and a
pair counts as a true positive only if the two points are within --gate metres.

Reported: precision, recall, F1, position error of matched players (mean,
median, RMSE, in metres) and team-assignment accuracy.

Not yet implemented: identity switches (needs consistent ids in the ground
truth), so MOTA and IDF1 cannot be reported yet.

Usage:
    python -m tactics.evaluate tracking.json ground_truth.json --gate 2.0 --json results.json
"""
from __future__ import annotations

import argparse
import json
import math

import numpy as np
from scipy.optimize import linear_sum_assignment

from tactics.metrics import load_tracking, nearest_frame


def evaluate(pred: dict, gt: dict, gate: float = 2.0, time_tolerance: float | None = None) -> dict:
    tol = 0.5 / pred["fps"] + 1e-6 if time_tolerance is None else time_tolerance
    tp = fp = fn = 0
    errors: list[float] = []
    agree = swapped = 0
    missing_frames = 0

    for g in gt["frames"]:
        gp = g["players"]
        p = nearest_frame(pred["frames"], g["t"])
        if abs(p["t"] - g["t"]) > tol:
            missing_frames += 1
            fn += len(gp)
            continue
        pp = p["players"]
        if not gp or not pp:
            fn += len(gp)
            fp += len(pp)
            continue
        cost = np.linalg.norm(np.array([[q["x"], q["y"]] for q in gp])[:, None, :]
                              - np.array([[q["x"], q["y"]] for q in pp])[None, :, :], axis=2)
        rows, cols = linear_sum_assignment(cost)
        matched = 0
        for r, c in zip(rows, cols):
            if cost[r, c] <= gate:
                matched += 1
                errors.append(float(cost[r, c]))
                agree += gp[r]["team"] == pp[c]["team"]
                swapped += gp[r]["team"] != pp[c]["team"]
        tp += matched
        fn += len(gp) - matched
        fp += len(pp) - matched

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "frames_evaluated": len(gt["frames"]) - missing_frames,
        "frames_without_prediction": missing_frames,
        "gate_m": gate,
        "true_positives": tp, "false_positives": fp, "false_negatives": fn,
        "precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4),
        "mean_error_m": round(float(np.mean(errors)), 3) if errors else None,
        "median_error_m": round(float(np.median(errors)), 3) if errors else None,
        "rmse_m": round(math.sqrt(float(np.mean(np.square(errors)))), 3) if errors else None,
        # team colours are arbitrary, so score the better of "as is" and "swapped"
        "team_accuracy": round(max(agree, swapped) / tp, 4) if tp else None,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tracking")
    ap.add_argument("ground_truth")
    ap.add_argument("--gate", type=float, default=2.0, help="max distance (m) for a match")
    ap.add_argument("--json", help="also write the results to this file")
    a = ap.parse_args()
    res = evaluate(load_tracking(a.tracking), load_tracking(a.ground_truth), a.gate)
    for k, v in res.items():
        print(f"{k:28s} {v}")
    if a.json:
        with open(a.json, "w", encoding="utf8") as fh:
            json.dump(res, fh, indent=2)


if __name__ == "__main__":
    main()
