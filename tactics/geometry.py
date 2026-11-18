"""Pitch geometry helpers.

Pure numpy (no OpenCV) so the maths can be unit-tested anywhere.

Pitch coordinate system (metres), shared by the pipeline, the analysis code
and the web board:

    x: 0 (left goal line) -> 105 (right goal line)
    y: 0 (top touchline)  -> 68  (bottom touchline)
"""
from __future__ import annotations

import numpy as np

PITCH_W = 105.0
PITCH_H = 68.0
BOX_DEPTH = 16.5                       # penalty area depth
BOX_Y0 = (PITCH_H - 40.32) / 2         # 13.84, top edge of the penalty area
BOX_Y1 = PITCH_H - BOX_Y0              # 54.16, bottom edge


def landmarks(box: str) -> np.ndarray:
    """Pitch coordinates of the four penalty-area corners the user clicks.

    Click order: goal-line/top, front/top, front/bottom, goal-line/bottom.
    """
    if box == "left":
        pts = [[0, BOX_Y0], [BOX_DEPTH, BOX_Y0], [BOX_DEPTH, BOX_Y1], [0, BOX_Y1]]
    elif box == "right":
        pts = [[PITCH_W, BOX_Y0], [PITCH_W - BOX_DEPTH, BOX_Y0],
               [PITCH_W - BOX_DEPTH, BOX_Y1], [PITCH_W, BOX_Y1]]
    else:
        raise ValueError("box must be 'left' or 'right'")
    return np.asarray(pts, dtype=float)


def _normaliser(pts: np.ndarray) -> np.ndarray:
    """Hartley normalisation: centre at origin, mean distance sqrt(2)."""
    c = pts.mean(axis=0)
    mean_dist = np.mean(np.linalg.norm(pts - c, axis=1))
    s = np.sqrt(2) / mean_dist if mean_dist > 0 else 1.0
    return np.array([[s, 0, -s * c[0]], [0, s, -s * c[1]], [0, 0, 1.0]])


def apply_homography(h: np.ndarray, pts) -> np.ndarray:
    """Map an (N, 2) array of points through a 3x3 homography."""
    pts = np.atleast_2d(np.asarray(pts, dtype=float))
    hom = np.c_[pts, np.ones(len(pts))] @ h.T
    return hom[:, :2] / hom[:, 2:3]


def homography_dlt(src, dst) -> np.ndarray:
    """Estimate the homography mapping src -> dst (>= 4 point pairs).

    Normalised direct linear transform. With exactly four non-collinear
    pairs the fit is exact; with more it is a least-squares fit.
    """
    src = np.asarray(src, dtype=float)
    dst = np.asarray(dst, dtype=float)
    if src.shape != dst.shape or src.ndim != 2 or src.shape[1] != 2 or len(src) < 4:
        raise ValueError("need matching (N, 2) point arrays with N >= 4")
    ts, td = _normaliser(src), _normaliser(dst)
    s, d = apply_homography(ts, src), apply_homography(td, dst)
    rows = []
    for (x, y), (u, v) in zip(s, d):
        rows.append([-x, -y, -1, 0, 0, 0, u * x, u * y, u])
        rows.append([0, 0, 0, -x, -y, -1, v * x, v * y, v])
    _, _, vt = np.linalg.svd(np.asarray(rows))
    hn = vt[-1].reshape(3, 3)
    h = np.linalg.inv(td) @ hn @ ts
    return h / h[2, 2]


def reprojection_error(h: np.ndarray, src, dst) -> np.ndarray:
    """Per-point distance (in dst units, i.e. metres) after mapping src."""
    return np.linalg.norm(apply_homography(h, src) - np.asarray(dst, dtype=float), axis=1)


def flip_180(x: float, y: float) -> tuple[float, float]:
    """Rotate a pitch position by 180 degrees (fixes a wrong-end calibration)."""
    return PITCH_W - x, PITCH_H - y


def on_pitch(x: float, y: float, margin: float = 3.0) -> bool:
    """True if a projected point lies on (or just beside) the pitch."""
    return -margin <= x <= PITCH_W + margin and -margin <= y <= PITCH_H + margin
