from __future__ import annotations

import numpy as np
import pytest

from app.estimation import (
    GRADE_CUTOFF,
    _build_grid,
    _distance_fade,
    _extract_sample_points,
    _filter_by_distance,
    compute_grade_estimation,
)
from app.models import CollarRecord, InterceptRecord


def _make_collar(
    hole_code: str = "TEST001",
    east: float = 1000.0,
    north: float = 5000.0,
    rl: float = 300.0,
    dip: float = -60.0,
    azimuth: float = 180.0,
    total_depth: float = 100.0,
    prospect: str = "TestProspect",
) -> CollarRecord:
    return CollarRecord(
        hole_code=hole_code,
        prospect=prospect,
        east=east,
        north=north,
        rl=rl,
        dip=dip,
        azimuth=azimuth,
        total_depth=total_depth,
    )


def _make_intercept(
    hole_code: str = "TEST001",
    depth_from: float = 20.0,
    depth_to: float = 25.0,
    grade: float = 5.0,
) -> InterceptRecord:
    return InterceptRecord(
        hole_code=hole_code,
        depth_from=depth_from,
        depth_to=depth_to,
        interval_m=depth_to - depth_from,
        grade=grade,
    )


class TestExtractSamplePoints:
    def test_intercept_midpoint_produces_sample(self):
        collar = _make_collar()
        intercept = _make_intercept()
        centroid = (1000.0, 5000.0, 300.0)

        coords, grades = _extract_sample_points([collar], [intercept], centroid)

        assert len(coords) == 1
        assert grades[0] == 5.0

    def test_barren_hole_produces_zero_grade_samples(self):
        collar = _make_collar(total_depth=100.0)
        centroid = (1000.0, 5000.0, 300.0)

        coords, grades = _extract_sample_points([collar], [], centroid)

        assert len(coords) >= 3
        assert all(g == 0.0 for g in grades)

    def test_mixed_holes(self):
        mineralised = _make_collar(hole_code="MIN001")
        barren = _make_collar(hole_code="BAR001", total_depth=60.0)
        intercept = _make_intercept(hole_code="MIN001", grade=3.0)
        centroid = (1000.0, 5000.0, 300.0)

        coords, grades = _extract_sample_points([mineralised, barren], [intercept], centroid)

        mineralised_samples = sum(1 for g in grades if g > 0)
        barren_samples = sum(1 for g in grades if g == 0.0)
        assert mineralised_samples == 1
        assert barren_samples > 0

    def test_empty_input(self):
        coords, grades = _extract_sample_points([], [], (0, 0, 0))
        assert len(coords) == 0
        assert len(grades) == 0


class TestBuildGrid:
    def test_grid_covers_data_extent(self):
        coords = np.array([[0, 0, 0], [100, 100, 100]], dtype=float)
        grid = _build_grid(coords, cell_size=10.0, padding=0.0)

        assert grid.min(axis=0)[0] == pytest.approx(0.0)
        assert grid.max(axis=0)[0] >= 90.0

    def test_grid_respects_cell_size(self):
        coords = np.array([[0, 0, 0], [50, 50, 50]], dtype=float)
        grid = _build_grid(coords, cell_size=25.0, padding=0.0)

        xs = sorted(set(grid[:, 0]))
        if len(xs) >= 2:
            assert xs[1] - xs[0] == pytest.approx(25.0)

    def test_padding_extends_grid(self):
        coords = np.array([[0, 0, 0], [100, 100, 100]], dtype=float)
        grid_no_pad = _build_grid(coords, cell_size=10.0, padding=0.0)
        grid_padded = _build_grid(coords, cell_size=10.0, padding=20.0)

        assert len(grid_padded) > len(grid_no_pad)


class TestFilterByDistance:
    def test_removes_distant_points(self):
        grid = np.array([[0, 0, 0], [100, 100, 100], [200, 200, 200]], dtype=float)
        samples = np.array([[0, 0, 0]], dtype=float)

        filtered, distances = _filter_by_distance(grid, samples, max_distance=50.0)

        assert len(filtered) == 1
        assert distances[0] == pytest.approx(0.0)

    def test_keeps_nearby_points(self):
        grid = np.array([[0, 0, 0], [5, 0, 0], [10, 0, 0]], dtype=float)
        samples = np.array([[0, 0, 0]], dtype=float)

        filtered, distances = _filter_by_distance(grid, samples, max_distance=100.0)

        assert len(filtered) == 3


class TestDistanceFade:
    def test_zero_distance_returns_one(self):
        assert _distance_fade(0.0, 50.0) == pytest.approx(1.0)

    def test_max_distance_returns_zero(self):
        assert _distance_fade(50.0, 50.0) == pytest.approx(0.0)

    def test_beyond_max_returns_zero(self):
        assert _distance_fade(60.0, 50.0) == pytest.approx(0.0)

    def test_half_distance_is_intermediate(self):
        result = _distance_fade(25.0, 50.0)
        assert 0.0 < result < 1.0


class TestComputeGradeEstimation:
    def test_empty_data_returns_empty(self):
        result = compute_grade_estimation([], [], (0, 0, 0))
        assert result == []

    def test_produces_voxels_for_mineralised_data(self):
        collars = [
            _make_collar(hole_code="H1", east=1000, north=5000),
            _make_collar(hole_code="H2", east=1020, north=5000),
        ]
        intercepts = [
            _make_intercept(hole_code="H1", grade=5.0),
            _make_intercept(hole_code="H2", grade=3.0),
        ]
        centroid = (1010.0, 5000.0, 300.0)

        voxels = compute_grade_estimation(collars, intercepts, centroid)

        assert len(voxels) > 0

    def test_all_voxels_above_cutoff(self):
        collars = [_make_collar(hole_code="H1")]
        intercepts = [_make_intercept(hole_code="H1", grade=8.0)]
        centroid = (1000.0, 5000.0, 300.0)

        voxels = compute_grade_estimation(collars, intercepts, centroid)

        for v in voxels:
            assert v.grade >= GRADE_CUTOFF

    def test_voxel_grades_are_clamped(self):
        collars = [
            _make_collar(hole_code="H1", east=1000, north=5000),
            _make_collar(hole_code="H2", east=1020, north=5000),
        ]
        intercepts = [
            _make_intercept(hole_code="H1", grade=10.0),
            _make_intercept(hole_code="H2", grade=8.0),
        ]
        centroid = (1010.0, 5000.0, 300.0)

        voxels = compute_grade_estimation(collars, intercepts, centroid)

        max_grade = max(v.grade for v in voxels) if voxels else 0
        assert max_grade <= 10.0 * 1.5

    def test_voxels_have_valid_opacity(self):
        collars = [_make_collar(hole_code="H1")]
        intercepts = [_make_intercept(hole_code="H1", grade=5.0)]
        centroid = (1000.0, 5000.0, 300.0)

        voxels = compute_grade_estimation(collars, intercepts, centroid)

        for v in voxels:
            assert 0.0 < v.opacity <= 1.0

    def test_voxels_have_valid_uncertainty(self):
        collars = [_make_collar(hole_code="H1")]
        intercepts = [_make_intercept(hole_code="H1", grade=5.0)]
        centroid = (1000.0, 5000.0, 300.0)

        voxels = compute_grade_estimation(collars, intercepts, centroid)

        for v in voxels:
            assert 0.0 <= v.uncertainty <= 1.0

    def test_barren_holes_constrain_estimation(self):
        mineralised = _make_collar(hole_code="H1", east=1000, north=5000)
        barren = _make_collar(hole_code="H2", east=1020, north=5000)
        intercept = _make_intercept(hole_code="H1", grade=5.0)
        centroid = (1010.0, 5000.0, 300.0)

        voxels_with_barren = compute_grade_estimation([mineralised, barren], [intercept], centroid)
        voxels_without_barren = compute_grade_estimation([mineralised], [intercept], centroid)

        avg_with = sum(v.grade for v in voxels_with_barren) / max(len(voxels_with_barren), 1)
        avg_without = sum(v.grade for v in voxels_without_barren) / max(
            len(voxels_without_barren), 1
        )
        assert avg_with <= avg_without
