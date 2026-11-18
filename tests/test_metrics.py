import pytest

from tactics.compare import build_report
from tactics.metrics import (describe, key_moments, nearest_frame, plan_vs_actual, shape_series,
                             team_shape, validate_tracking)
from tests.conftest import make_players, make_track


def test_team_shape_matches_the_board_screenshot_numbers():
    # 4-3-3 for the home team: width 48, depth 53, back line 25 (as shown in the web UI)
    s = team_shape(make_players(), 0)
    assert (s.width, s.depth, s.back_line) == pytest.approx((48.0, 53.0, 25.0))


def test_team_shape_away_team_defends_the_right_goal():
    s = team_shape(make_players(), 1)          # 4-4-2: ys 8..60, d 25..78
    assert (s.width, s.depth, s.back_line) == pytest.approx((52.0, 53.0, 25.0))


def test_team_shape_excludes_the_goalkeeper_and_needs_four_outfield_players():
    few = [p for p in make_players() if p["team"] == 0][:4]      # keeper + 3 outfield
    assert team_shape(few, 0) is None


def test_back_line_rises_when_the_team_steps_up():
    base = team_shape(make_players(), 0).back_line
    stepped = team_shape(make_players(home_shift=10), 0).back_line
    assert stepped - base == pytest.approx(10.0)


def test_nearest_frame_picks_closest_and_clamps():
    frames = [{"t": 0.0}, {"t": 1.0}, {"t": 2.0}]
    assert nearest_frame(frames, 0.4)["t"] == 0.0
    assert nearest_frame(frames, 0.6)["t"] == 1.0
    assert nearest_frame(frames, -5)["t"] == 0.0 and nearest_frame(frames, 9)["t"] == 2.0


def test_identical_plan_and_actual_have_zero_deviation():
    track = make_track([0, 2, 4, 6])
    devs = plan_vs_actual(track, track, team=0)
    assert devs and all(abs(d.back_line) < 1e-9 and abs(d.width) < 1e-9 for d in devs)


def test_known_deviation_is_reported_with_the_right_sign():
    plan = make_track([0] * 6)
    actual = make_track([0, 0, 8, 8, 8, 8])                      # steps up 8 m from frame 2
    devs = plan_vs_actual(plan, actual, team=0)
    assert [round(d.back_line, 6) for d in devs] == [0, 0, 8, 8, 8, 8]


def test_offset_aligns_a_short_plan_inside_a_longer_match():
    plan = make_track([0, 5, 10], fps=5)                          # t = 0.0, 0.2, 0.4
    actual = make_track([0] * 5 + [0, 5, 10] + [10] * 4, fps=5)   # plan starts at 1.0 s
    devs = plan_vs_actual(plan, actual, team=0, offset=1.0)
    assert [d.t for d in devs] == [1.0, 1.2, 1.4]
    assert all(abs(d.back_line) < 1e-9 for d in devs)


def test_key_moments_need_a_sustained_deviation():
    shifts = [0, 0, 6, 0, 0, 7, 7, 7, 7, 7, 7, 0]               # one noisy blip, then a real 1.0 s run
    plan = make_track([0] * len(shifts))
    devs = plan_vs_actual(plan, make_track(shifts), team=0)
    found = key_moments(devs, "back_line", threshold=5, min_duration=0.8)
    assert len(found) == 1
    m = found[0]
    assert (m.start, m.end) == (1.0, 2.0) and m.mean_delta == pytest.approx(7.0)
    assert "7.0 m more than planned" in describe(m)


def test_key_moments_rejects_unknown_metric():
    with pytest.raises(ValueError):
        key_moments([], "speed")


def test_shape_series_skips_frames_without_enough_players():
    data = make_track([0, 1])
    data["frames"][1]["players"] = data["frames"][1]["players"][:4]    # keeper + 3 outfield: too few
    assert len(shape_series(data, 0)) == 1


@pytest.mark.parametrize("bad", [
    {}, {"fps": 5}, {"fps": 0, "frames": [{"t": 0, "players": []}]},
    {"fps": 5, "frames": [{"t": 1, "players": []}, {"t": 0, "players": []}]},
    {"fps": 5, "frames": [{"t": 0, "players": [{"team": 2, "x": 1, "y": 1}]}]},
])
def test_validate_tracking_rejects_broken_files(bad):
    with pytest.raises(ValueError):
        validate_tracking(bad)


def test_report_lists_the_flagged_moment_and_the_summary_table():
    plan = make_track([0] * 12)
    actual = make_track([0] * 4 + [9] * 6 + [0] * 2)
    text = build_report(plan, actual, team=0, offset=0.0, metric="back_line", threshold=5, min_duration=1.0)
    assert "| back_line |" in text and "9.0 m more than planned" in text
