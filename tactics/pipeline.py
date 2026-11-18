"""Football video -> 2D pitch coordinates.

Steps: detect + track people (YOLO + ByteTrack) -> click four penalty-area
corners to calibrate (homography) -> project each player's feet onto the
pitch (metres) -> split into two teams by shirt colour -> write tracking.json.

Usage (from the repository root, with the virtual environment active):

    python -m tactics.pipeline clip.mp4 --box left --every 5 --out tracking.json

Calibration: a window shows the first frame. Click the four corners of the
penalty box at the end given by --box, in this order:
    1) goal-line end of the top side     (pitch y = 13.84)
    2) front corner on that same side    (x = 16.5 or 88.5, y = 13.84)
    3) front corner on the bottom side   (x = 16.5 or 88.5, y = 54.16)
    4) goal-line end of the bottom side  (y = 54.16)
"top" is the touchline at pitch y = 0. Press any key after the fourth click.

Only use footage you have permission to process (open datasets, or filmed
footage covered by ethics approval and consent).
"""
from __future__ import annotations

import argparse

import cv2
import numpy as np
from ultralytics import YOLO

from tactics.geometry import apply_homography, homography_dlt, landmarks, on_pitch
from tactics.trackdata import build_tracking, cluster_teams, save_tracking


def calibrate(frame: np.ndarray, box: str) -> np.ndarray:
    """Interactive calibration: returns the pixel -> pitch homography."""
    pts: list[list[int]] = []
    img = frame.copy()

    def on_click(event, x, y, *_):
        if event == cv2.EVENT_LBUTTONDOWN and len(pts) < 4:
            pts.append([x, y])
            cv2.circle(img, (x, y), 6, (0, 255, 255), -1)
            cv2.putText(img, str(len(pts)), (x + 8, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            cv2.imshow("Calibrate", img)

    cv2.imshow("Calibrate", img)
    cv2.setMouseCallback("Calibrate", on_click)
    while len(pts) < 4:
        cv2.waitKey(50)
    cv2.waitKey(0)
    cv2.destroyAllWindows()
    return homography_dlt(np.asarray(pts, dtype=float), landmarks(box))


def shirt_colour(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int):
    """Median colour of the upper-body area (top half of the box, central strip)."""
    h, w = y2 - y1, x2 - x1
    crop = frame[y1 + int(.15 * h): y1 + int(.5 * h), x1 + int(.25 * w): x2 - int(.25 * w)]
    if crop.size == 0:
        return None
    return np.median(crop.reshape(-1, 3), axis=0)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--box", choices=["left", "right"], default="left")
    ap.add_argument("--every", type=int, default=5, help="process every Nth frame")
    ap.add_argument("--model", default="yolov8n.pt")
    ap.add_argument("--out", default="tracking.json")
    a = ap.parse_args()

    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    ok, first = cap.read()
    if not ok:
        raise SystemExit("Could not read the video.")
    h = calibrate(first, a.box)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    model = YOLO(a.model)
    raw: list[tuple[float, int, float, float]] = []
    colours: dict[int, list] = {}
    i = -1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        i += 1
        if i % a.every:
            continue
        res = model.track(frame, persist=True, classes=[0], tracker="bytetrack.yaml", verbose=False)[0]
        if res.boxes.id is None:
            continue
        boxes = res.boxes.xyxy.int().tolist()
        ids = res.boxes.id.int().tolist()
        feet = apply_homography(h, [[(x1 + x2) / 2, y2] for x1, _, x2, y2 in boxes])   # one call per frame
        for (x1, y1, x2, y2), tid, (px, py) in zip(boxes, ids, feet):
            if not on_pitch(px, py):
                continue                                         # off the pitch: staff, crowd
            c = shirt_colour(frame, x1, y1, x2, y2)
            if c is not None:
                colours.setdefault(tid, []).append(c)
            raw.append((i / fps, tid, float(px), float(py)))

    try:
        team_of = cluster_teams(colours)
    except ValueError:
        raise SystemExit("Too few tracks found. Try a clearer clip or a different --model.")
    data = build_tracking(raw, team_of, fps / a.every)
    save_tracking(data, a.out)
    print(f"Wrote {a.out}: {len(data['frames'])} frames, {len(team_of)} tracks.")


if __name__ == "__main__":
    main()
