import csv
import logging
from pathlib import Path

from pydantic import ValidationError

from app.models import CollarRecord, InterceptRecord

logger = logging.getLogger(__name__)


def _parse_optional_int(value: str) -> int | None:
    value = value.strip()
    if not value:
        return None
    return int(float(value))


def _parse_optional_float(value: str) -> float | None:
    value = value.strip()
    if not value:
        return None
    return float(value)


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in ("true", "1", "yes")


def load_collars(csv_path: Path) -> list[CollarRecord]:
    collars: list[CollarRecord] = []
    with csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            try:
                cleaned = {
                    "hole_code": row["hole_code"].strip(),
                    "prospect": row["prospect"].strip(),
                    "hole_type": row.get("hole_type", "").strip(),
                    "sampling_type": row.get("sampling_type", "").strip(),
                    "drilling_purpose": row.get("drilling_purpose", "").strip(),
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "east": float(row["east"]),
                    "north": float(row["north"]),
                    "rl": float(row["rl"]),
                    "dip": float(row["dip"]),
                    "azimuth": float(row["azimuth"]),
                    "total_depth": float(row["total_depth"]),
                    "epsg": int(row.get("epsg", "28351") or "28351"),
                    "grid_name": row.get("grid_name", "").strip(),
                    "axis_units": row.get("axis_units", "metres").strip() or "metres",
                    "grid_confidence": row.get("grid_confidence", "").strip(),
                    "drilling_start_date": row.get("drilling_start_date", "").strip(),
                    "drilling_end_date": row.get("drilling_end_date", "").strip(),
                    "collar_page": _parse_optional_int(row.get("collar_page", "")),
                }
                collars.append(CollarRecord(**cleaned))
            except (ValidationError, ValueError, KeyError) as exc:
                logger.warning("Row %d skipped: %s", row_num, exc)
    return collars


def load_intercepts(csv_path: Path, valid_hole_codes: set[str]) -> list[InterceptRecord]:
    intercepts: list[InterceptRecord] = []
    with csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            hole_code = row["hole_code"].strip()
            if hole_code not in valid_hole_codes:
                logger.warning(
                    "Row %d skipped: hole_code '%s' not found in collars", row_num, hole_code
                )
                continue
            try:
                cleaned = {
                    "hole_code": hole_code,
                    "depth_from": float(row["depth_from"]),
                    "depth_to": float(row["depth_to"]),
                    "interval_m": float(row["interval_m"]),
                    "grade": float(row["grade"]),
                    "grade_unit": row.get("grade_unit", "g/t").strip() or "g/t",
                    "commodity_symbol": row.get("commodity_symbol", "Au").strip() or "Au",
                    "cutoff_grade": _parse_optional_float(row.get("cutoff_grade", "")),
                    "cutoff_unit": row.get("cutoff_unit", "").strip(),
                    "true_width": _parse_optional_float(row.get("true_width", "")),
                    "true_width_estimated": row.get("true_width_estimated", "").strip(),
                    "depth_reference": row.get("depth_reference", "").strip(),
                    "assay_method": row.get("assay_method", "").strip(),
                    "is_includes_subinterval": _parse_bool(row.get("is_includes_subinterval", "")),
                    "is_significant": _parse_bool(row.get("is_significant", "")),
                    "parent_intercept_id": row.get("parent_intercept_id", "").strip(),
                    "intercept_page": _parse_optional_int(row.get("intercept_page", "")),
                }
                intercepts.append(InterceptRecord(**cleaned))
            except (ValidationError, ValueError, KeyError) as exc:
                logger.warning("Row %d skipped: %s", row_num, exc)
    return intercepts
