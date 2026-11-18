import numpy as np
import pytest

from tactics.geometry import (PITCH_H, PITCH_W, apply_homography, flip_180, homography_dlt,
                              landmarks, on_pitch, reprojection_error)


def _camera(pts):
    """A fixed, known perspective transform used as ground truth."""
    h = np.array([[8.0, 1.5, 120.0], [0.4, 6.0, 80.0], [0.0004, 0.0021, 1.0]])
    return apply_homography(h, pts)


def test_landmarks_left_and_right_are_mirror_images():
    left, right = landmarks("left"), landmarks("right")
    assert left.shape == (4, 2)
    np.testing.assert_allclose(right[:, 0], PITCH_W - left[:, 0])
    np.testing.assert_allclose(right[:, 1], left[:, 1])


def test_landmarks_rejects_bad_side():
    with pytest.raises(ValueError):
        landmarks("middle")


def test_dlt_recovers_known_mapping_from_four_points():
    pitch = landmarks("left")
    pixels = _camera(pitch)
    h = homography_dlt(pixels, pitch)
    np.testing.assert_allclose(reprojection_error(h, pixels, pitch), 0, atol=1e-6)
    # a point that was NOT used for calibration lands where it should
    inside = np.array([[30.0, 25.0], [50.0, 40.0]])
    np.testing.assert_allclose(apply_homography(h, _camera(inside)), inside, atol=1e-6)


def test_dlt_least_squares_with_extra_points_tolerates_click_noise():
    rng = np.random.default_rng(0)
    pitch = np.array([[0, 13.84], [16.5, 13.84], [16.5, 54.16], [0, 54.16], [52.5, 0], [52.5, 68]])
    pixels = _camera(pitch) + rng.normal(0, 1.0, (6, 2))        # about 1 px click error
    h = homography_dlt(pixels, pitch)
    assert reprojection_error(h, pixels, pitch).max() < 1.0      # sub-metre


def test_dlt_needs_four_matching_points():
    with pytest.raises(ValueError):
        homography_dlt(np.zeros((3, 2)), np.zeros((3, 2)))
    with pytest.raises(ValueError):
        homography_dlt(np.zeros((4, 2)), np.zeros((5, 2)))


def test_flip_180_is_an_involution_and_maps_centre_to_centre():
    assert flip_180(PITCH_W / 2, PITCH_H / 2) == (PITCH_W / 2, PITCH_H / 2)
    x, y = flip_180(*flip_180(10.0, 20.0))
    assert (x, y) == pytest.approx((10.0, 20.0))


def test_on_pitch_margin():
    assert on_pitch(0, 0) and on_pitch(-2.9, 70.9)
    assert not on_pitch(-4, 10) and not on_pitch(50, 72)
