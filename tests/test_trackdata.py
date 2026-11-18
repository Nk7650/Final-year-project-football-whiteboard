import numpy as np
import pytest

from tactics.trackdata import build_tracking, cluster_teams


def _samples(centre, n=5, seed=0):
    rng = np.random.default_rng(seed)
    return [list(np.array(centre) + rng.normal(0, 5, 3)) for _ in range(n)]


def test_cluster_teams_separates_two_kit_colours():
    colours = {i: _samples((30, 30, 200), seed=i) for i in range(1, 6)}          # red-ish
    colours.update({i: _samples((200, 60, 30), seed=i) for i in range(6, 11)})   # blue-ish (BGR)
    teams = cluster_teams(colours)
    assert len(set(teams[i] for i in range(1, 6))) == 1
    assert len(set(teams[i] for i in range(6, 11))) == 1
    assert teams[1] != teams[6]


def test_cluster_teams_is_stable_lowest_id_is_team_zero():
    colours = {i: _samples((30, 30, 200), seed=i) for i in (3, 4)}
    colours.update({i: _samples((200, 60, 30), seed=i) for i in (7, 8)})
    assert cluster_teams(colours)[3] == 0
    # same clip with the colour groups swapped still gives lowest id -> team 0
    swapped = {3: colours[7], 4: colours[8], 7: colours[3], 8: colours[4]}
    assert cluster_teams(swapped)[3] == 0


def test_cluster_teams_ignores_short_tracks_and_needs_two_tracks():
    colours = {1: _samples((10, 10, 10)), 2: _samples((10, 10, 10), n=1)}
    with pytest.raises(ValueError):
        cluster_teams(colours)


def test_build_tracking_groups_by_time_and_drops_unassigned_tracks():
    raw = [(0.0, 1, 10.123, 20.456), (0.0, 2, 30.0, 40.0), (0.2, 1, 11.0, 21.0), (0.2, 99, 5.0, 5.0)]
    data = build_tracking(raw, {1: 0, 2: 1}, fps=5)
    assert data["fps"] == 5.0
    assert [f["t"] for f in data["frames"]] == [0.0, 0.2]
    assert data["frames"][0]["players"][0] == {"id": 1, "team": 0, "x": 10.12, "y": 20.46}
    assert all(p["id"] != 99 for f in data["frames"] for p in f["players"])
