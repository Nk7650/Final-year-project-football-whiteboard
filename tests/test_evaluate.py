import copy

import pytest

from tactics.evaluate import evaluate
from tests.conftest import make_track


def _gt(frames=(0, 2, 4)):
    full = make_track([0] * 6)
    return {"fps": full["fps"], "frames": [full["frames"][i] for i in frames]}


def test_perfect_tracking_scores_one_and_zero_error():
    pred = make_track([0] * 6)
    r = evaluate(pred, _gt())
    assert (r["precision"], r["recall"], r["f1"]) == (1.0, 1.0, 1.0)
    assert r["rmse_m"] == 0 and r["team_accuracy"] == 1.0
    assert r["true_positives"] == 66 and r["frames_without_prediction"] == 0


def test_constant_offset_is_reported_as_position_error():
    pred = make_track([0] * 6)
    for f in pred["frames"]:
        for p in f["players"]:
            p["x"] += 0.5
    r = evaluate(pred, _gt())
    assert r["mean_error_m"] == pytest.approx(0.5) and r["rmse_m"] == pytest.approx(0.5)


def test_missed_and_spurious_players_reduce_recall_and_precision():
    pred = make_track([0] * 6)
    for f in pred["frames"]:
        f["players"] = f["players"][:-2]                       # two players never detected
        f["players"].append({"id": 99, "team": 0, "x": 5.0, "y": 5.0})   # one phantom far from anyone
    r = evaluate(pred, _gt(), gate=2.0)
    assert r["recall"] == pytest.approx(20 / 22, abs=1e-4)
    assert r["precision"] == pytest.approx(20 / 21, abs=1e-4)
    assert r["false_negatives"] == 6 and r["false_positives"] == 3


def test_detections_beyond_the_gate_do_not_count():
    pred = make_track([0] * 6)
    for p in pred["frames"][0]["players"]:
        p["y"] += 5
    r = evaluate(pred, _gt(frames=(0,)), gate=2.0)
    assert r["true_positives"] == 0 and r["recall"] == 0 and r["mean_error_m"] is None


def test_team_colours_may_be_swapped_without_penalty():
    pred = make_track([0] * 6)
    for f in pred["frames"]:
        for p in f["players"]:
            p["team"] = 1 - p["team"]
    assert evaluate(pred, _gt())["team_accuracy"] == 1.0


def test_annotated_frames_with_no_nearby_prediction_are_counted_as_misses():
    pred = make_track([0] * 3)                                  # only 0.0-0.4 s
    gt = copy.deepcopy(_gt(frames=(0, 4)))                      # second frame is at 0.8 s
    r = evaluate(pred, gt)
    assert r["frames_without_prediction"] == 1 and r["false_negatives"] == 22
