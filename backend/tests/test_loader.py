import csv
from pathlib import Path

from app.loader import load_collars, load_intercepts


def _write_csv(rows: list[dict], path: Path) -> None:
    if not rows:
        path.write_text("")
        return
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def _valid_collar_row(**overrides) -> dict:
    defaults = {
        "hole_code": "TEST001",
        "prospect": "TestProspect",
        "hole_type": "RC",
        "sampling_type": "drilling",
        "drilling_purpose": "exploration",
        "latitude": "-30.0",
        "longitude": "121.0",
        "east": "318000",
        "north": "6685000",
        "rl": "370",
        "dip": "-60",
        "azimuth": "20",
        "total_depth": "100",
        "epsg": "28351",
        "grid_name": "",
        "axis_units": "metres",
        "grid_confidence": "inferred",
        "drilling_start_date": "",
        "drilling_end_date": "",
        "collar_page": "8",
    }
    defaults.update(overrides)
    return defaults


def _valid_intercept_row(**overrides) -> dict:
    defaults = {
        "hole_code": "TEST001",
        "depth_from": "10",
        "depth_to": "15",
        "interval_m": "5",
        "grade": "2.5",
        "grade_unit": "g/t",
        "commodity_symbol": "Au",
        "cutoff_grade": "0.5",
        "cutoff_unit": "g/t",
        "true_width": "",
        "true_width_estimated": "",
        "depth_reference": "downhole",
        "assay_method": "",
        "is_includes_subinterval": "False",
        "is_significant": "",
        "parent_intercept_id": "",
        "intercept_page": "8",
    }
    defaults.update(overrides)
    return defaults


class TestLoadCollars:
    def test_valid_csv(self, tmp_path):
        csv_path = tmp_path / "collars.csv"
        _write_csv([_valid_collar_row()], csv_path)
        collars = load_collars(csv_path)
        assert len(collars) == 1
        assert collars[0].hole_code == "TEST001"
        assert collars[0].east == 318000.0

    def test_multiple_rows(self, tmp_path):
        csv_path = tmp_path / "collars.csv"
        rows = [
            _valid_collar_row(hole_code="A"),
            _valid_collar_row(hole_code="B"),
            _valid_collar_row(hole_code="C"),
        ]
        _write_csv(rows, csv_path)
        collars = load_collars(csv_path)
        assert len(collars) == 3

    def test_invalid_dip_skipped(self, tmp_path):
        csv_path = tmp_path / "collars.csv"
        rows = [
            _valid_collar_row(hole_code="GOOD"),
            _valid_collar_row(hole_code="BAD", dip="10"),
        ]
        _write_csv(rows, csv_path)
        collars = load_collars(csv_path)
        assert len(collars) == 1
        assert collars[0].hole_code == "GOOD"

    def test_invalid_depth_skipped(self, tmp_path):
        csv_path = tmp_path / "collars.csv"
        rows = [
            _valid_collar_row(hole_code="GOOD"),
            _valid_collar_row(hole_code="BAD", total_depth="-10"),
        ]
        _write_csv(rows, csv_path)
        collars = load_collars(csv_path)
        assert len(collars) == 1

    def test_empty_optional_fields(self, tmp_path):
        csv_path = tmp_path / "collars.csv"
        row = _valid_collar_row(
            grid_name="",
            drilling_start_date="",
            drilling_end_date="",
            collar_page="",
        )
        _write_csv([row], csv_path)
        collars = load_collars(csv_path)
        assert len(collars) == 1
        assert collars[0].collar_page is None

    def test_whitespace_in_hole_code(self, tmp_path):
        csv_path = tmp_path / "collars.csv"
        _write_csv([_valid_collar_row(hole_code=" TEST001 ")], csv_path)
        collars = load_collars(csv_path)
        assert collars[0].hole_code == "TEST001"

    def test_real_data_loads(self):
        from app.config import COLLARS_PATH

        collars = load_collars(COLLARS_PATH)
        assert len(collars) == 31


class TestLoadIntercepts:
    def test_valid_csv(self, tmp_path):
        csv_path = tmp_path / "intercepts.csv"
        _write_csv([_valid_intercept_row()], csv_path)
        intercepts = load_intercepts(csv_path, {"TEST001"})
        assert len(intercepts) == 1
        assert intercepts[0].grade == 2.5

    def test_orphan_intercept_skipped(self, tmp_path):
        csv_path = tmp_path / "intercepts.csv"
        _write_csv([_valid_intercept_row(hole_code="UNKNOWN")], csv_path)
        intercepts = load_intercepts(csv_path, {"TEST001"})
        assert len(intercepts) == 0

    def test_invalid_grade_skipped(self, tmp_path):
        csv_path = tmp_path / "intercepts.csv"
        rows = [
            _valid_intercept_row(hole_code="A", grade="2.5"),
            _valid_intercept_row(hole_code="B", grade="-1.0"),
        ]
        _write_csv(rows, csv_path)
        intercepts = load_intercepts(csv_path, {"A", "B"})
        assert len(intercepts) == 1

    def test_depth_order_validation(self, tmp_path):
        csv_path = tmp_path / "intercepts.csv"
        rows = [
            _valid_intercept_row(depth_from="20", depth_to="10", interval_m="-10"),
        ]
        _write_csv(rows, csv_path)
        intercepts = load_intercepts(csv_path, {"TEST001"})
        assert len(intercepts) == 0

    def test_real_data_loads(self):
        from app.config import COLLARS_PATH, INTERCEPTS_PATH
        from app.loader import load_collars as lc

        collars = lc(COLLARS_PATH)
        codes = {c.hole_code for c in collars}
        intercepts = load_intercepts(INTERCEPTS_PATH, codes)
        assert len(intercepts) == 14

    def test_empty_optional_fields(self, tmp_path):
        csv_path = tmp_path / "intercepts.csv"
        row = _valid_intercept_row(
            true_width="",
            assay_method="",
            intercept_page="",
        )
        _write_csv([row], csv_path)
        intercepts = load_intercepts(csv_path, {"TEST001"})
        assert len(intercepts) == 1
        assert intercepts[0].true_width is None
        assert intercepts[0].intercept_page is None
