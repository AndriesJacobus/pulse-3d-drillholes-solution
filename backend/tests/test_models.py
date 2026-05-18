import pytest
from pydantic import ValidationError

from app.models import CollarRecord, InterceptRecord


def _collar(**overrides) -> dict:
    defaults = {
        "hole_code": "TEST001",
        "prospect": "Test",
        "east": 318000.0,
        "north": 6685000.0,
        "rl": 370.0,
        "dip": -60.0,
        "azimuth": 20.0,
        "total_depth": 100.0,
    }
    defaults.update(overrides)
    return defaults


def _intercept(**overrides) -> dict:
    defaults = {
        "hole_code": "TEST001",
        "depth_from": 10.0,
        "depth_to": 20.0,
        "interval_m": 10.0,
        "grade": 3.5,
    }
    defaults.update(overrides)
    return defaults


class TestCollarDipValidator:
    def test_dip_zero_passes(self):
        CollarRecord(**_collar(dip=0))

    def test_dip_minus_90_passes(self):
        CollarRecord(**_collar(dip=-90))

    def test_dip_minus_45_passes(self):
        CollarRecord(**_collar(dip=-45))

    def test_dip_positive_rejected(self):
        with pytest.raises(ValidationError, match="Dip must be between -90 and 0"):
            CollarRecord(**_collar(dip=1))

    def test_dip_below_minus_90_rejected(self):
        with pytest.raises(ValidationError, match="Dip must be between -90 and 0"):
            CollarRecord(**_collar(dip=-91))


class TestCollarAzimuthValidator:
    def test_azimuth_zero_passes(self):
        CollarRecord(**_collar(azimuth=0))

    def test_azimuth_359_passes(self):
        CollarRecord(**_collar(azimuth=359.99))

    def test_azimuth_360_rejected(self):
        with pytest.raises(ValidationError, match="Azimuth must be between 0 and 360"):
            CollarRecord(**_collar(azimuth=360))

    def test_azimuth_negative_rejected(self):
        with pytest.raises(ValidationError, match="Azimuth must be between 0 and 360"):
            CollarRecord(**_collar(azimuth=-1))


class TestCollarTotalDepthValidator:
    def test_positive_depth_passes(self):
        CollarRecord(**_collar(total_depth=0.1))

    def test_zero_depth_rejected(self):
        with pytest.raises(ValidationError, match="Total depth must be positive"):
            CollarRecord(**_collar(total_depth=0))

    def test_negative_depth_rejected(self):
        with pytest.raises(ValidationError, match="Total depth must be positive"):
            CollarRecord(**_collar(total_depth=-10))


class TestInterceptGradeValidator:
    def test_positive_grade_passes(self):
        InterceptRecord(**_intercept(grade=0.1))

    def test_zero_grade_rejected(self):
        with pytest.raises(ValidationError, match="Grade must be positive"):
            InterceptRecord(**_intercept(grade=0))

    def test_negative_grade_rejected(self):
        with pytest.raises(ValidationError, match="Grade must be positive"):
            InterceptRecord(**_intercept(grade=-1))


class TestInterceptDepthOrderValidator:
    def test_valid_depth_order_passes(self):
        InterceptRecord(**_intercept(depth_from=10, depth_to=20))

    def test_equal_depths_rejected(self):
        with pytest.raises(ValidationError, match="depth_from.*must be less than depth_to"):
            InterceptRecord(**_intercept(depth_from=10, depth_to=10))

    def test_reversed_depths_rejected(self):
        with pytest.raises(ValidationError, match="depth_from.*must be less than depth_to"):
            InterceptRecord(**_intercept(depth_from=20, depth_to=10))

    def test_tiny_interval_passes(self):
        InterceptRecord(**_intercept(depth_from=10, depth_to=10.01))
