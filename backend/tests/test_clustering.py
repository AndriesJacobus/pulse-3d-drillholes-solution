from __future__ import annotations

import pytest

from app.clustering import CLUSTER_EPS_M, CLUSTER_MIN_SAMPLES, compute_clusters
from app.models import CollarRecord


def _make_collar(
    hole_code: str = "TEST001",
    east: float = 1000.0,
    north: float = 5000.0,
    rl: float = 300.0,
    dip: float = -60.0,
    azimuth: float = 180.0,
    total_depth: float = 100.0,
    prospect: str = "Alpha",
    latitude: float = -30.0,
    longitude: float = 121.0,
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
        latitude=latitude,
        longitude=longitude,
    )


CENTROID = (1000.0, 5000.0, 300.0)


class TestComputeClusters:
    def test_empty_input(self) -> None:
        assert compute_clusters([], CENTROID) == []

    def test_single_collar_returns_empty(self) -> None:
        assert compute_clusters([_make_collar()], CENTROID) == []

    def test_two_close_collars_form_one_cluster(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000),
            _make_collar(hole_code="A2", east=1020, north=5010),
        ]
        result = compute_clusters(collars, CENTROID)
        assert len(result) == 1
        assert set(result[0].hole_codes) == {"A1", "A2"}

    def test_two_distant_collars_are_both_noise(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000),
            _make_collar(hole_code="B1", east=2000, north=6000),
        ]
        result = compute_clusters(collars, CENTROID)
        assert len(result) == 0

    def test_noise_points_are_excluded(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000),
            _make_collar(hole_code="A2", east=1010, north=5005),
            _make_collar(hole_code="OUTLIER", east=5000, north=9000),
        ]
        result = compute_clusters(collars, CENTROID)
        all_codes = []
        for c in result:
            all_codes.extend(c.hole_codes)
        assert "OUTLIER" not in all_codes
        assert len(result) == 1

    def test_cluster_label_is_sequential(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000, prospect="Cheer"),
            _make_collar(hole_code="A2", east=1020, north=5010, prospect="Cheer"),
            _make_collar(hole_code="A3", east=1030, north=5015, prospect="Cheer"),
        ]
        result = compute_clusters(collars, CENTROID)
        assert result[0].label == "Cluster 1"

    def test_dominant_prospect(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000, prospect="Cheer"),
            _make_collar(hole_code="A2", east=1020, north=5010, prospect="Cheer"),
            _make_collar(hole_code="A3", east=1030, north=5015, prospect="Sovereign"),
        ]
        result = compute_clusters(collars, CENTROID)
        cluster = result[0]
        assert cluster.prospect == "Cheer"

    def test_cluster_centroid_is_average_scene_position(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000, rl=300),
            _make_collar(hole_code="A2", east=1020, north=5000, rl=300),
        ]
        result = compute_clusters(collars, CENTROID)
        cluster = result[0]
        assert cluster.centroid.x == pytest.approx(10.0, abs=0.1)
        assert cluster.centroid.y == pytest.approx(0.0, abs=0.1)

    def test_cluster_radius_at_least_30(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000),
            _make_collar(hole_code="A2", east=1005, north=5005),
        ]
        result = compute_clusters(collars, CENTROID)
        assert result[0].radius >= 30.0

    def test_average_lat_lon(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000, latitude=-30.0, longitude=121.0),
            _make_collar(hole_code="A2", east=1020, north=5010, latitude=-30.1, longitude=121.2),
        ]
        result = compute_clusters(collars, CENTROID)
        assert result[0].latitude == pytest.approx(-30.05)
        assert result[0].longitude == pytest.approx(121.1)

    def test_cluster_ids_are_sequential(self) -> None:
        collars = [
            _make_collar(hole_code="A1", east=1000, north=5000),
            _make_collar(hole_code="A2", east=1020, north=5010),
            _make_collar(hole_code="B1", east=1200, north=5000),
            _make_collar(hole_code="B2", east=1220, north=5010),
        ]
        result = compute_clusters(collars, CENTROID)
        ids = [c.id for c in result]
        assert ids == list(range(len(result)))

    def test_constants_are_expected_values(self) -> None:
        assert CLUSTER_EPS_M == 100.0
        assert CLUSTER_MIN_SAMPLES == 2

    def test_real_data_produces_expected_cluster_count(self) -> None:
        from app.config import COLLARS_PATH
        from app.loader import load_collars

        collars = load_collars(COLLARS_PATH)
        centroid = (
            sum(c.east for c in collars) / len(collars),
            sum(c.north for c in collars) / len(collars),
            sum(c.rl for c in collars) / len(collars),
        )
        result = compute_clusters(collars, centroid)
        assert 3 <= len(result) <= 6
        total_holes = sum(len(c.hole_codes) for c in result)
        assert total_holes == 30
