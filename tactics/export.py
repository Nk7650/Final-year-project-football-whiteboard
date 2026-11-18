"""Turn tracking.json into text files for the report.

Usage:   python -m tactics.export tracking.json
Creates: tracking.txt (readable summary) and tracking.csv (one row per player per frame)
"""
from __future__ import annotations

import csv
import json
import statistics
import sys
from pathlib import Path


def export(src: Path) -> tuple[Path, Path]:
    data = json.loads(src.read_text(encoding="utf8"))
    frames = data["frames"]
    ids = {p["id"] for f in frames for p in f["players"]}
    counts = [len(f["players"]) for f in frames]

    csv_path, txt_path = src.with_suffix(".csv"), src.with_suffix(".txt")
    with open(csv_path, "w", newline="", encoding="utf8") as fh:
        w = csv.writer(fh)
        w.writerow(["time_s", "id", "team", "x_m", "y_m"])
        for f in frames:
            for p in f["players"]:
                w.writerow([f["t"], p["id"], p["team"], p["x"], p["y"]])

    with open(txt_path, "w", encoding="utf8") as fh:
        fh.write(f"Tracking summary for {src.name}\n")
        fh.write(f"Frames: {len(frames)} at {data['fps']:.2f} per second\n")
        fh.write(f"Duration: {frames[-1]['t'] - frames[0]['t']:.1f} s\n")
        fh.write(f"Unique tracks: {len(ids)}\n")
        fh.write(f"Players per frame: average {statistics.mean(counts):.1f}, min {min(counts)}, max {max(counts)}\n")
        fh.write("Pitch coordinates are metres on a 105 x 68 pitch.\n\n")
        for f in frames:
            fh.write(f"t = {f['t']} s\n")
            for team in (0, 1):
                row = ", ".join(f"#{p['id']} ({p['x']}, {p['y']})" for p in f["players"] if p["team"] == team)
                fh.write(f"  Team {team}: {row}\n")
    return txt_path, csv_path


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "tracking.json")
    txt, csv_ = export(src)
    print(f"Wrote {txt} and {csv_}")


if __name__ == "__main__":
    main()
