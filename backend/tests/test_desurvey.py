import math

import pytest

from app.desurvey import (
    compute_centroid,
    compute_intercept_positions,
    compute_point_at_depth,
    desurvey_hole,
    to_scene_coords,
)
from app.models import CollarRecord, Point3D


def _collar(**overrides) -> CollarRecord:
    defaults = {
        "hole_code": "TEST001",
        "prospect": "Test",
        "east": 0.0,
        "north": 0.0,
        "rl": 100.0,
        "dip": -60.0,
        "azimuth": 20.0,
        "total_depth": 100.0,
    }
    defaults.update(overrides)
    return CollarRecord(**defaults)


class TestComputePointAtDepth:
    def test_vertical_hole(self):
        east, north, rl = compute_point_at_depth(0, 0, 100, dip=-90, azimuth=0, depth=50)
        assert east == pytest.approx(0, abs=0.01)
        assert north == pytest.approx(0, abs=0.01)
        assert rl == pytest.approx(50, abs=0.01)

    def test_vertical_hole_azimuth_irrelevant(self):
        r1 = compute_point_at_depth(0, 0, 100, dip=-90, azimuth=0, depth=50)
        r2 = compute_point_at_depth(0, 0, 100, dip=-90, azimuth=60, depth=50)
        r3 = compute_point_at_depth(0, 0, 100, dip=-90, azimuth=180, depth=50)
        assert r1[0] == pytest.approx(r2[0], abs=0.01)
        assert r1[1] == pytest.approx(r2[1], abs=0.01)
        assert r1[2] == pytest.approx(r2[2], abs=0.01)
        assert r1[0] == pytest.approx(r3[0], abs=0.01)

    def test_horizontal_north(self):
        east, north, rl = compute_point_at_depth(0, 0, 100, dip=0, azimuth=0, depth=50)
        assert east == pytest.approx(0, abs=0.01)
        assert north == pytest.approx(50, abs=0.01)
        assert rl == pytest.approx(100, abs=0.01)

    def test_horizontal_east(self):
        east, north, rl = compute_point_at_depth(0, 0, 100, dip=0, azimuth=90, depth=50)
        assert east == pytest.approx(50, abs=0.01)
        assert north == pytest.approx(0, abs=0.01)
        assert rl == pytest.approx(100, abs=0.01)

    def test_45_degree_east(self):
        east, north, rl = compute_point_at_depth(0, 0, 100, dip=-45, azimuth=90, depth=50)
        expected_east = 50 * math.cos(math.radians(-45)) * math.sin(math.radians(90))
        expected_north = 50 * math.cos(math.radians(-45)) * math.cos(math.radians(90))
        expected_rl = 100 + 50 * math.sin(math.radians(-45))
        assert east == pytest.approx(expected_east, abs=0.01)
        assert north == pytest.approx(expected_north, abs=0.01)
        assert rl == pytest.approx(expected_rl, abs=0.01)

    def test_known_hole_cvex005(self):
        collar_east, collar_north, collar_rl = 318142, 6685724, 370
        dip, azimuth, depth = -60, 20, 120

        east, north, rl = compute_point_at_depth(
            collar_east,
            collar_north,
            collar_rl,
            dip,
            azimuth,
            depth,
        )

        expected_east = collar_east + 120 * math.cos(math.radians(-60)) * math.sin(math.radians(20))
        expected_north = collar_north + 120 * math.cos(math.radians(-60)) * math.cos(
            math.radians(20)
        )
        expected_rl = collar_rl + 120 * math.sin(math.radians(-60))

        assert east == pytest.approx(expected_east, abs=0.01)
        assert north == pytest.approx(expected_north, abs=0.01)
        assert rl == pytest.approx(expected_rl, abs=0.01)

    def test_zero_depth(self):
        east, north, rl = compute_point_at_depth(100, 200, 300, dip=-60, azimuth=45, depth=0)
        assert east == pytest.approx(100, abs=0.01)
        assert north == pytest.approx(200, abs=0.01)
        assert rl == pytest.approx(300, abs=0.01)


class TestComputeCentroid:
    def test_single_collar(self):
        collars = [_collar(east=100, north=200, rl=300)]
        centroid = compute_centroid(collars)
        assert centroid == (100, 200, 300)

    def test_two_collars(self):
        collars = [
            _collar(hole_code="A", east=100, north=200, rl=300),
            _collar(hole_code="B", east=200, north=400, rl=400),
        ]
        centroid = compute_centroid(collars)
        assert centroid == (150, 300, 350)

    def test_empty_list(self):
        assert compute_centroid([]) == (0.0, 0.0, 0.0)


class TestToSceneCoords:
    def test_at_centroid(self):
        result = to_scene_coords(100, 200, 300, (100, 200, 300))
        assert result.x == pytest.approx(0)
        assert result.y == pytest.approx(0)
        assert result.z == pytest.approx(0)

    def test_offset_from_centroid(self):
        result = to_scene_coords(110, 220, 310, (100, 200, 300))
        assert result.x == pytest.approx(10)
        assert result.y == pytest.approx(10)
        assert result.z == pytest.approx(-20)

    def test_north_maps_to_negative_z(self):
        result = to_scene_coords(100, 250, 300, (100, 200, 300))
        assert result.z == pytest.approx(-50)


class TestDesurveyHole:
    def test_produces_trace_points(self):
        collar = _collar(total_depth=100)
        centroid = (0, 0, 100)
        trace = desurvey_hole(collar, [], centroid, sample_interval=10.0)
        assert len(trace) == 11
        assert isinstance(trace[0], Point3D)

    def test_includes_intercept_depths(self):
        collar = _collar(total_depth=100)
        centroid = (0, 0, 100)
        trace = desurvey_hole(collar, [33.0, 47.0], centroid, sample_interval=10.0)
        assert len(trace) > 11

    def test_first_point_is_collar(self):
        collar = _collar(east=100, north=200, rl=300, total_depth=50)
        centroid = (100, 200, 300)
        trace = desurvey_hole(collar, [], centroid, sample_interval=10.0)
        assert trace[0].x == pytest.approx(0)
        assert trace[0].y == pytest.approx(0)
        assert trace[0].z == pytest.approx(0)


class TestComputeInterceptPositions:
    def test_returns_two_points(self):
        collar = _collar(east=0, north=0, rl=100, dip=-90, azimuth=0, total_depth=100)
        centroid = (0, 0, 100)
        start, end = compute_intercept_positions(collar, 20, 30, centroid)
        assert isinstance(start, Point3D)
        assert isinstance(end, Point3D)

    def test_vertical_intercept_depth(self):
        collar = _collar(east=0, north=0, rl=100, dip=-90, azimuth=0, total_depth=100)
        centroid = (0, 0, 100)
        start, end = compute_intercept_positions(collar, 20, 30, centroid)
        assert start.y == pytest.approx(-20, abs=0.01)
        assert end.y == pytest.approx(-30, abs=0.01)

    def test_horizontal_east_intercept(self):
        collar = _collar(east=0, north=0, rl=100, dip=0, azimuth=90, total_depth=100)
        centroid = (0, 0, 100)
        start, end = compute_intercept_positions(collar, 10, 20, centroid)
        assert start.x == pytest.approx(10, abs=0.01)
        assert end.x == pytest.approx(20, abs=0.01)
        assert start.y == pytest.approx(0, abs=0.01)
        assert end.y == pytest.approx(0, abs=0.01)

    def test_angled_intercept_positions(self):
        collar = _collar(east=0, north=0, rl=100, dip=-60, azimuth=90, total_depth=100)
        centroid = (0, 0, 100)
        start, end = compute_intercept_positions(collar, 40, 50, centroid)
        assert start.x < end.x
        assert start.y > end.y
        assert abs(start.y) > abs(start.x)
