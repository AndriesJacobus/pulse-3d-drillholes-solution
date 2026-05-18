import pytest

from app.config import COLLARS_PATH, INTERCEPTS_PATH
from app.loader import load_collars, load_intercepts
from app.quality import (
    check_completeness,
    check_derived_consistency,
    check_domain_rules,
    check_grade_outliers,
    check_near_duplicates,
    check_spatial_outliers,
    run_quality_report,
)


@pytest.fixture(scope="module")
def collars():
    return load_collars(COLLARS_PATH)


@pytest.fixture(scope="module")
def intercepts(collars):
    codes = {c.hole_code for c in collars}
    return load_intercepts(INTERCEPTS_PATH, codes)


class TestSpatialOutliers:
    def test_cvex028_detected(self, collars):
        findings = check_spatial_outliers(collars)
        outlier_codes = [
            code for f in findings if f.code == "SPATIAL_OUTLIER" for code in f.affected_rows
        ]
        assert "CVEX028" in outlier_codes

    def test_no_false_positive_on_normal_holes(self, collars):
        findings = check_spatial_outliers(collars)
        outlier_codes = {
            code for f in findings if f.code == "SPATIAL_OUTLIER" for code in f.affected_rows
        }
        assert "CVEX005" not in outlier_codes
        assert "STEX001" not in outlier_codes


class TestCompleteness:
    def test_barren_holes_reported(self, collars, intercepts):
        findings = check_completeness(collars, intercepts)
        barren = [f for f in findings if f.code == "BARREN_HOLES"]
        assert len(barren) == 1
        assert "18" in barren[0].message

    def test_empty_columns_reported(self, collars, intercepts):
        findings = check_completeness(collars, intercepts)
        empty = [f for f in findings if f.code == "EMPTY_COLUMNS"]
        assert len(empty) == 1
        assert "grid_name" in empty[0].message


class TestDerivedConsistency:
    def test_all_consistent(self, intercepts):
        findings = check_derived_consistency(intercepts)
        errors = [f for f in findings if f.severity == "error"]
        assert len(errors) == 0


class TestDomainRules:
    def test_vertical_azimuth_flagged(self, collars):
        findings = check_domain_rules(collars)
        flagged = [f for f in findings if f.code == "VERTICAL_AZIMUTH"]
        assert any("STEX006" in f.affected_rows for f in flagged)

    def test_rl_variation_flagged(self, collars):
        findings = check_domain_rules(collars)
        rl_findings = [f for f in findings if f.code == "RL_VARIATION"]
        assert any("Cheer" in f.message for f in rl_findings)


class TestGradeOutliers:
    def test_stex014_flagged(self, intercepts):
        findings = check_grade_outliers(intercepts)
        assert any("STEX014" in f.affected_rows for f in findings)


class TestNearDuplicates:
    def test_twin_holes_detected(self, collars):
        findings = check_near_duplicates(collars)
        pairs = [f for f in findings if f.code == "NEAR_DUPLICATE"]
        assert len(pairs) >= 4

    def test_cvex025_cvex036_pair(self, collars):
        findings = check_near_duplicates(collars)
        found = any("CVEX025" in f.affected_rows and "CVEX036" in f.affected_rows for f in findings)
        assert found


class TestFullReport:
    def test_report_has_all_categories(self, collars, intercepts):
        report = run_quality_report(collars, intercepts)
        categories = {f.category for f in report.findings}
        assert "spatial" in categories
        assert "completeness" in categories
        assert "geometric" in categories

    def test_report_summary_counts(self, collars, intercepts):
        report = run_quality_report(collars, intercepts)
        assert report.summary["error"] == 0
        assert report.summary["warning"] >= 1
        assert report.summary["info"] >= 5
