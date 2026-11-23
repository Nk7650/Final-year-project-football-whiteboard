"""Browser smoke test for web/index.html.

Skipped automatically when Playwright or a Chrome binary is not available
(for example in CI). To run locally:

    pip install playwright pytest
    set CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe   (Windows, if needed)
    python -m pytest tests/test_web_smoke.py

Set SAVE_SCREENSHOTS=1 to write evidence images to docs/img/.
"""
import os
import shutil
from pathlib import Path

import pytest

sync_api = pytest.importorskip("playwright.sync_api")

ROOT = Path(__file__).resolve().parent.parent
PAGE = (ROOT / "web" / "index.html").as_uri()
TRACK = ROOT / "data" / "sample-tracking.json"
PLAN = ROOT / "data" / "sample-plan.json"
IMG = ROOT / "docs" / "img"


def _chrome():
    path = os.environ.get("CHROME_PATH") or shutil.which("google-chrome") or shutil.which("chrome") or shutil.which("chromium")
    if not path:
        pytest.skip("no Chrome/Chromium binary found (set CHROME_PATH)")
    return path


@pytest.fixture
def page():
    with sync_api.sync_playwright() as p:
        browser = p.chromium.launch(executable_path=_chrome(), headless=True, args=["--no-sandbox"])
        pg = browser.new_page(viewport={"width": 1400, "height": 900})
        pg.errors = []
        pg.on("pageerror", lambda e: pg.errors.append(str(e)))
        pg.goto(PAGE)
        pg.evaluate("clearBoard(); setView('top', true)")   # blank board, top-down camera, so pointer maths is simple
        yield pg
        browser.close()


def _load(pg, button, path):
    with pg.expect_file_chooser() as fc:
        pg.click(button)
    fc.value.set_files(str(path))


def _shot(pg, name):
    if os.environ.get("SAVE_SCREENSHOTS"):
        IMG.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(IMG / name))


def test_board_loads_with_default_formations_and_metrics(page):
    assert page.inner_text("#mw0") == "48.0" and page.inner_text("#md0") == "53.0" and page.inner_text("#ml0") == "25.0"
    _shot(page, "01-board.png")
    assert not page.errors


def test_keyframe_animation_actually_moves_players(page):
    page.click("#addKf")
    initial = float(page.inner_text("#ml0"))                # 25.0: default back line
    x0, y0 = page.evaluate("toPage(25, 58)")              # home right-back start position
    page.mouse.move(x0, y0)
    page.mouse.down()
    page.mouse.move(x0 + 200, y0 - 60, steps=5)
    page.mouse.up()
    page.click("#addKf")
    final = float(page.inner_text("#ml0"))                  # board shows the dragged state
    assert final > initial
    page.click("#play")
    page.wait_for_timeout(900)
    mid_u = page.evaluate("u")
    mid_line = float(page.inner_text("#ml0"))
    assert 0 < mid_u < 1 and not page.errors                # animation advanced between the keyframes
    assert initial < mid_line < final                       # players are part-way between the two keyframes


def test_tracking_replay_plays_and_updates_metrics(page):
    _load(page, "#loadTrack", TRACK)
    page.wait_for_function("document.querySelector('#back').hidden === false")
    start = page.inner_text("#ml0")
    page.evaluate("document.querySelector('#scrub').value = 900; document.querySelector('#scrub').dispatchEvent(new Event('input'))")
    assert page.inner_text("#ml0") != start                # home line stepped up by 90% of the replay
    assert not page.errors


def test_plan_overlay_shows_deviation_panel_and_signed_numbers(page):
    _load(page, "#loadTrack", TRACK)
    page.wait_for_function("document.querySelector('#back').hidden === false")
    _load(page, "#loadPlan", PLAN)
    page.wait_for_function("document.querySelector('#pvaBox').hidden === false")
    page.evaluate("document.querySelector('#scrub').value = 900; document.querySelector('#scrub').dispatchEvent(new Event('input'))")
    line = page.inner_text("#pl0")
    assert line.startswith(("+", "-")) and line != "-"     # signed number, not the empty placeholder
    _shot(page, "02-plan-vs-actual.png")
    assert not page.errors


def test_wrong_plan_offset_is_explained_not_blank(page):
    _load(page, "#loadTrack", TRACK)
    page.wait_for_function("document.querySelector('#back').hidden === false")
    _load(page, "#loadPlan", PLAN)
    page.fill("#planOff", "50")
    assert "no frame at this time" in page.inner_text("#pvaNote")


def test_key_moment_is_flagged_and_clicking_it_seeks(page):
    _load(page, "#loadTrack", TRACK)
    page.wait_for_function("document.querySelector('#back').hidden === false")
    _load(page, "#loadPlan", PLAN)
    page.wait_for_function("document.querySelector('#momCard').hidden === false")
    text = page.inner_text("#moments")
    assert "back line" in text and "than planned" in text
    page.click("#moments button")
    assert page.evaluate("u") > 0 and not page.errors


def test_drawing_tools_add_and_undo_annotations(page):
    x0, y0 = page.evaluate("toPage(30, 20)")
    page.click("[data-tool=pass]")
    page.mouse.move(x0, y0)
    page.mouse.down()
    page.mouse.move(x0 + 300, y0 + 100, steps=4)
    page.mouse.up()
    assert page.evaluate("ann.length") == 1
    page.click("#undo")
    assert page.evaluate("ann.length") == 0 and not page.errors


def test_demo_move_loads_and_plays_on_a_fresh_page():
    with sync_api.sync_playwright() as p:
        browser = p.chromium.launch(executable_path=_chrome(), headless=True, args=["--no-sandbox"])
        pg = browser.new_page(viewport={"width": 1400, "height": 900})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(PAGE)
        assert pg.evaluate("frames.length") == 4          # the demo move is ready before the user does anything
        pg.click("#play")
        pg.wait_for_timeout(900)
        assert 0 < pg.evaluate("u") < 3 and not errors
        _shot(pg, "05-broadcast-view.png")
        browser.close()


def test_all_formations_have_eleven_players_on_pitch_and_info(page):
    bad = page.evaluate("""() => Object.entries(FORM).filter(([k, v]) =>
        v.length !== 11 || v.some(([d, y]) => d < 0 || d > 100 || y < 0 || y > 68)).map(([k]) => k)""")
    assert bad == []
    n = page.evaluate("Object.keys(FORM).length")
    assert n == 15
    missing = page.evaluate("Object.keys(FORM).filter(k => !FORM_INFO[k])")
    assert missing == []
    page.select_option("#fh", "3-2-4-1")
    assert "3-2-4-1" in page.inner_text("#fi")
