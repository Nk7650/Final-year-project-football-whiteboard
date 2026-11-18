"""Shared fixtures: synthetic tracking data built from known formations."""
import pytest

FORM = {
    "4-3-3": [[5, 34], [25, 10], [25, 26], [25, 42], [25, 58], [50, 14], [50, 34], [50, 54], [78, 12], [78, 34], [78, 56]],
    "4-4-2": [[5, 34], [25, 10], [25, 26], [25, 42], [25, 58], [52, 8], [52, 26], [52, 42], [52, 60], [78, 26], [78, 42]],
}


def make_players(home="4-3-3", away="4-4-2", home_shift=0.0):
    """22 players. Team 0 defends x = 0, team 1 defends x = 105. home_shift moves
    every home outfield player up the pitch (the goalkeeper stays)."""
    players = []
    for team, name in ((0, home), (1, away)):
        for i, (d, y) in enumerate(FORM[name]):
            shift = home_shift if (team == 0 and i > 0) else 0.0
            x = d + shift if team == 0 else 105 - d
            players.append({"id": team * 11 + i + 1, "team": team, "x": x, "y": y})
    return players


def make_track(shifts, fps=5.0, **kw):
    """One frame per entry of shifts (home line moves by that many metres)."""
    return {"fps": fps, "frames": [{"t": round(i / fps, 3), "players": make_players(home_shift=s, **kw)}
                                    for i, s in enumerate(shifts)]}


@pytest.fixture
def players():
    return make_players()
