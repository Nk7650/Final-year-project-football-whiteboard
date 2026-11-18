"""Turn raw per-frame detections into the tracking.json data contract.

Contract (also described in docs/ARCHITECTURE.md):

    {"fps": 5.0,
     "frames": [{"t": 0.0, "players": [{"id": 3, "team": 0, "x": 12.3, "y": 40.1}, ...]}, ...]}

x, y are pitch metres (see geometry.py); team is 0 or 1; id is a track id.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import numpy as np


def _kmeans2(x: np.ndarray, iterations: int = 50) -> np.ndarray:
    """Deterministic 2-means. Initialised with the two most distant points."""
    i = int(np.argmax(np.linalg.norm(x - x[0], axis=1)))
    j = int(np.argmax(np.linalg.norm(x - x[i], axis=1)))
    centres = np.array([x[i], x[j]], dtype=float)
    labels = np.zeros(len(x), dtype=int)
    for _ in range(iterations):
        dist = np.linalg.norm(x[:, None, :] - centres[None, :, :], axis=2)
        new = dist.argmin(axis=1)
        for k in (0, 1):
            if np.any(new == k):
                centres[k] = x[new == k].mean(axis=0)
        if np.array_equal(new, labels):
            break
        labels = new
    return labels


def cluster_teams(colours: Mapping[int, Sequence[Sequence[float]]], min_samples: int = 3) -> dict[int, int]:
    """Split tracks into two teams by shirt colour.

    colours maps track id -> list of colour samples (e.g. BGR triples).
    The label is stable: the lowest track id is always team 0, so reruns on
    the same clip give the same colours on the board.
    """
    ids = sorted(t for t, c in colours.items() if len(c) >= min_samples)
    if len(ids) < 2:
        raise ValueError("need at least two tracks with enough colour samples")
    feats = np.array([np.median(np.asarray(colours[t], dtype=float), axis=0) for t in ids])
    labels = _kmeans2(feats)
    if labels[0] != 0:
        labels = 1 - labels
    return dict(zip(ids, labels.tolist()))


def build_tracking(raw: Iterable[tuple[float, int, float, float]], team_of: Mapping[int, int], fps: float) -> dict:
    """raw: (time_s, track_id, x_m, y_m) tuples. Tracks without a team are dropped."""
    frames: dict[float, list[dict]] = {}
    for t, tid, x, y in raw:
        if tid in team_of:
            frames.setdefault(round(float(t), 3), []).append(
                {"id": int(tid), "team": int(team_of[tid]), "x": round(float(x), 2), "y": round(float(y), 2)})
    return {"fps": float(fps), "frames": [{"t": t, "players": p} for t, p in sorted(frames.items())]}


def save_tracking(data: dict, path: str | Path) -> None:
    Path(path).write_text(json.dumps(data), encoding="utf8")
