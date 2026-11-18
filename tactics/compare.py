"""Compare a board plan with tracked play and list the key moments.

Usage:
    python -m tactics.compare plan-tracking.json tracking.json --team 0 --offset 3.0 \\
        --metric back_line --threshold 5 --min-duration 2 --out report.md

plan-tracking.json comes from the board's "Export plan as tracking" button;
tracking.json comes from tactics.pipeline. --offset is the match time (s)
at which the planned movement starts.
"""
from __future__ import annotations

import argparse
from statistics import mean

from tactics.metrics import METRICS, describe, key_moments, load_tracking, plan_vs_actual


def build_report(plan: dict, actual: dict, team: int, offset: float, metric: str,
                 threshold: float, min_duration: float) -> str:
    devs = plan_vs_actual(plan, actual, team, offset)
    lines = [f"# Plan vs actual report (team {team})", "",
             f"Plan starts at {offset:.1f} s. Frames compared: {len(devs)}.", ""]
    if not devs:
        lines.append("No overlap between the plan and the tracked play. Check --offset.")
        return "\n".join(lines) + "\n"
    lines += ["| Metric | Mean abs deviation (m) | Largest deviation (m) |", "|---|---|---|"]
    for m in METRICS:
        vals = [getattr(d, m) for d in devs]
        lines.append(f"| {m} | {mean(abs(v) for v in vals):.1f} | {max(vals, key=abs):+.1f} |")
    moments = key_moments(devs, metric, threshold, min_duration)
    lines += ["", f"## Key moments ({metric}, threshold {threshold:g} m, at least {min_duration:g} s)", ""]
    lines += [f"- {describe(m)}" for m in moments] or ["- None: the team stayed within the threshold of the plan."]
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("tracking")
    ap.add_argument("--team", type=int, choices=[0, 1], default=0)
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--metric", choices=METRICS, default="back_line")
    ap.add_argument("--threshold", type=float, default=5.0)
    ap.add_argument("--min-duration", type=float, default=2.0)
    ap.add_argument("--out", help="write the report to this markdown file")
    a = ap.parse_args()
    report = build_report(load_tracking(a.plan), load_tracking(a.tracking), a.team, a.offset,
                          a.metric, a.threshold, a.min_duration)
    if a.out:
        with open(a.out, "w", encoding="utf8") as fh:
            fh.write(report)
        print(f"Wrote {a.out}")
    print(report)


if __name__ == "__main__":
    main()
