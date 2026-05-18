import json
import subprocess
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SCRIPT_PATH = Path(__file__).resolve().parent.parent / "scripts" / "analyse_data.py"


class TestAnalysisScript:
    def test_runs_successfully(self, tmp_path):
        output_path = tmp_path / "report.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--collars",
                str(DATA_DIR / "drillhole_collars.csv"),
                "--intercepts",
                str(DATA_DIR / "drill_intercepts.csv"),
                "--output",
                str(output_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        report = json.loads(output_path.read_text())
        assert report["summary"]["total_collars"] == 31
        assert report["summary"]["total_intercepts"] == 14

    def test_detects_cvex028_outlier(self, tmp_path):
        output_path = tmp_path / "report.json"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--collars",
                str(DATA_DIR / "drillhole_collars.csv"),
                "--intercepts",
                str(DATA_DIR / "drill_intercepts.csv"),
                "--output",
                str(output_path),
            ],
            capture_output=True,
            text=True,
        )
        report = json.loads(output_path.read_text())
        spatial_findings = [f for f in report["findings"] if f["code"] == "SPATIAL_OUTLIER"]
        assert any("CVEX028" in f["affected_rows"] for f in spatial_findings)

    def test_grade_statistics_present(self, tmp_path):
        output_path = tmp_path / "report.json"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--collars",
                str(DATA_DIR / "drillhole_collars.csv"),
                "--intercepts",
                str(DATA_DIR / "drill_intercepts.csv"),
                "--output",
                str(output_path),
            ],
            capture_output=True,
            text=True,
        )
        report = json.loads(output_path.read_text())
        stats = report["grade_statistics"]
        assert stats["min"] == 0.6
        assert stats["max"] == 10.8
        assert stats["count"] == 14

    def test_spatial_statistics_present(self, tmp_path):
        output_path = tmp_path / "report.json"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--collars",
                str(DATA_DIR / "drillhole_collars.csv"),
                "--intercepts",
                str(DATA_DIR / "drill_intercepts.csv"),
                "--output",
                str(output_path),
            ],
            capture_output=True,
            text=True,
        )
        report = json.loads(output_path.read_text())
        spatial = report["spatial_statistics"]
        assert spatial["east_range"]["span"] > 1000
        assert "Cheer" in spatial["prospect_counts"]
        assert "Sovereign" in spatial["prospect_counts"]

    def test_missing_file_exits_nonzero(self):
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--collars",
                "/nonexistent/file.csv",
                "--intercepts",
                "/nonexistent/file.csv",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0

    def test_prints_readable_report(self):
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--collars",
                str(DATA_DIR / "drillhole_collars.csv"),
                "--intercepts",
                str(DATA_DIR / "drill_intercepts.csv"),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "DRILLHOLE DATA QUALITY REPORT" in result.stdout
        assert "SPATIAL_OUTLIER" in result.stdout
