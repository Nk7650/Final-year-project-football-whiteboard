"""Team-shape metrics, plan-vs-actual comparison and key-moment flags.

These are the rule-based "Layer 1" suggestions from the specification: the
standard is the coach's own plan, so every flag is traceable to a number the
user can verify against the video.

The metric definitions mirror web/index.html exactly (same drop-the-goalkeeper
rule, same back-line definition) so the board and the reports agree.
"""
from __future__ import annotations

import json
from bisect import bisect_left
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from tactics.geometry import PITCH_W

METRICS = ("width", "depth", "back_line")


@dataclass(frozen=True)
class TeamShape:
    width: float        # spread across the pitch (m), outfield players
    depth: float        # distance between deepest and highest outfield player (m)
    back_line: float    # mean distance from own goal of the four deepest outfield players (m)


@dataclass(frozen=True)
class Deviation:
    t: float
    width: float        # actual - plan (m)
    depth: float
    back_line: float


@dataclass(frozen=True)
class Moment:
    start: float
    end: float
    metric: str
    mean_delta: float   # signed, actual - plan
    peak_delta: float


# ---------- loading and validation ----------

def validate_tracking(data: dict) -> dict:
    """Raise ValueError with a readable message if data breaks the contract."""
    if not isinstance(data, dict) or not isinstance(data.get("fps"), (int, float)) or data["fps"] <= 0:
        raise ValueError("tracking data needs a positive 'fps'")
    frames = data.get("frames")
    if not isinstance(frames, list) or not frames:
        raise ValueError("tracking data needs a non-empty 'frames' list")
    last_t = float("-inf")
    for n, f in enumerate(frames):
        if not isinstance(f.get("t"), (int, float)) or not isinstance(f.get("players"), list):
            raise ValueError(f"frame {n} needs numeric 't' and a 'players' list")
        if f["t"] < last_t:
            raise ValueError(f"frame {n} goes back in time")
        last_t = f["t"]
        for p in f["players"]:
            if p.get("team") not in (0, 1) or not all(isinstance(p.get(k), (int, float)) for k in ("x", "y")):
                raise ValueError(f"frame {n} has a player without team 0/1 and numeric x, y")
    return data


def load_tracking(path: str | Path) -> dict:
    return validate_tracking(json.loads(Path(path).read_text(encoding="utf8")))


def nearest_frame(frames: Sequence[dict], t: float) -> dict:
    times = [f["t"] for f in frames]
    i = bisect_left(times, t)
    if i == 0:
        return frames[0]
    if i == len(times):
        return frames[-1]
    return frames[i] if times[i] - t < t - times[i - 1] else frames[i - 1]


# ---------- shape metrics ----------

def team_shape(players: Sequence[dict], team: int, pitch_w: float = PITCH_W) -> TeamShape | None:
    """Shape of one team in one frame, or None if fewer than four outfield players.

    Team 0 defends the left goal (x = 0); team 1 defends the right (x = pitch_w).
    The deepest player is treated as the goalkeeper and excluded.
    """
    own = sorted(((pitch_w - p["x"]) if team else p["x"], p["y"]) for p in players if p["team"] == team)[1:]
    if len(own) < 4:
        return None
    ds = [d for d, _ in own]
    ys = [y for _, y in own]
    return TeamShape(max(ys) - min(ys), max(ds) - min(ds), sum(ds[:4]) / 4)


def shape_series(data: dict, team: int) -> list[tuple[float, TeamShape]]:
    out = []
    for f in data["frames"]:
        s = team_shape(f["players"], team)
        if s is not None:
            out.append((f["t"], s))
    return out


# ---------- plan vs actual ----------

def plan_vs_actual(plan: dict, actual: dict, team: int, offset: float = 0.0,
                   tolerance: float | None = None) -> list[Deviation]:
    """Compare a planned movement with tracked play.

    offset is the match time (s) at which the plan starts. A tracked frame at
    time t is compared with the plan frame nearest to t - offset, provided it
    lies within the plan's time range (plus tolerance, default half a plan frame).
    """
    pf = plan["frames"]
    tol = 0.5 / plan["fps"] if tolerance is None else tolerance
    lo, hi = pf[0]["t"] - tol, pf[-1]["t"] + tol
    out = []
    for f in actual["frames"]:
        tp = f["t"] - offset
        if not lo <= tp <= hi:
            continue
        a = team_shape(f["players"], team)
        p = team_shape(nearest_frame(pf, tp)["players"], team)
        if a and p:
            out.append(Deviation(f["t"], a.width - p.width, a.depth - p.depth, a.back_line - p.back_line))
    return out


def key_moments(devs: Sequence[Deviation], metric: str = "back_line",
                threshold: float = 5.0, min_duration: float = 2.0) -> list[Moment]:
    """Intervals where |actual - plan| stays at or above threshold metres.

    A run must last at least min_duration seconds to be reported, so a single
    noisy frame never becomes a "key moment".
    """
    if metric not in METRICS:
        raise ValueError(f"metric must be one of {METRICS}")
    moments: list[Moment] = []
    run: list[Deviation] = []

    def close() -> None:
        if run and run[-1].t - run[0].t >= min_duration:
            vals = [getattr(d, metric) for d in run]
            peak = max(vals, key=abs)
            moments.append(Moment(run[0].t, run[-1].t, metric, sum(vals) / len(vals), peak))
        run.clear()

    for d in devs:
        if abs(getattr(d, metric)) >= threshold:
            run.append(d)
        else:
            close()
    close()
    return moments


def describe(m: Moment) -> str:
    """One human-readable sentence with the evidence for a flagged moment."""
    label = {"width": "width", "depth": "depth", "back_line": "back line height"}[m.metric]
    direction = "more" if m.mean_delta > 0 else "less"
    return (f"{label.capitalize()} was on average {abs(m.mean_delta):.1f} m {direction} than planned "
            f"between {m.start:.1f} s and {m.end:.1f} s (peak {abs(m.peak_delta):.1f} m).")
