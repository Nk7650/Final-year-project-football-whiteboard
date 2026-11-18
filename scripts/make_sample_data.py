"""Generate the synthetic demo files in data/.

    python scripts/make_sample_data.py

sample-plan.json     a coach's plan: home team presses up 12 m from t = 2 s
sample-tracking.json made-up "tracked" play: the home team presses later (t = 3 s)
                     and further (18 m), with small movement noise

Both are SYNTHETIC. They exist to demo and test the tools; they are not real
tracking results and must never be reported as such.
"""
import json
import math
from pathlib import Path

FORM = {
    "4-3-3": [[5, 34], [25, 10], [25, 26], [25, 42], [25, 58], [50, 14], [50, 34], [50, 54], [78, 12], [78, 34], [78, 56]],
    "4-4-2": [[5, 34], [25, 10], [25, 26], [25, 42], [25, 58], [52, 8], [52, 26], [52, 42], [52, 60], [78, 26], [78, 42]],
}
FPS = 5
SECONDS = 12
OUT = Path(__file__).resolve().parent.parent / "data"


def frame(t, home_shift, noise):
    players = []
    for team, name in ((0, "4-3-3"), (1, "4-4-2")):
        for i, (d, y) in enumerate(FORM[name]):
            if noise:
                dx = 0 if i == 0 else (home_shift if team == 0 else -2 * math.sin(t))
                x = d + dx + 1.2 * math.sin(t * 1.3 + i)
                yy = y + 1.5 * math.cos(t * 0.9 + i)
            else:
                x = d + (home_shift if (team == 0 and i > 0) else 0)
                yy = y
            x = x if team == 0 else 105 - x
            players.append({"id": team * 11 + i + 1, "team": team,
                            "x": round(max(0, min(105, x)), 2), "y": round(max(0, min(68, yy)), 2)})
    return {"t": round(t, 3), "players": players}


def main():
    OUT.mkdir(exist_ok=True)
    ticks = [n / FPS for n in range(SECONDS * FPS)]
    plan = {"fps": FPS, "frames": [frame(t, min(12, max(0, (t - 2) * 6)), noise=False) for t in ticks]}
    track = {"fps": FPS, "frames": [frame(t, min(18, max(0, (t - 3) * 4)), noise=True) for t in ticks]}
    (OUT / "sample-plan.json").write_text(json.dumps(plan), encoding="utf8")
    (OUT / "sample-tracking.json").write_text(json.dumps(track), encoding="utf8")
    print(f"Wrote {OUT / 'sample-plan.json'} and {OUT / 'sample-tracking.json'}")


if __name__ == "__main__":
    main()
