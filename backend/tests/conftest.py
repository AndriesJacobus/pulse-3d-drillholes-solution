import json
import subprocess
import time
from pathlib import Path

import pytest

METRICS_DIR = Path(__file__).resolve().parent.parent.parent / "metrics"
BUDGETS_PATH = METRICS_DIR / "budgets.json"


class MetricsCollector:
    def __init__(self, suite: str):
        self.suite = suite
        self.metrics: dict[str, float] = {}
        self._budgets = self._load_budgets()

    def _load_budgets(self) -> dict[str, float]:
        if BUDGETS_PATH.exists():
            all_budgets = json.loads(BUDGETS_PATH.read_text())
            return all_budgets.get(self.suite, {})
        return {}

    @property
    def budgets(self) -> dict[str, float]:
        return self._budgets

    def __setitem__(self, key: str, value: float):
        self.metrics[key] = value

    def write(self):
        git_sha = "unknown"
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                capture_output=True,
                text=True,
                check=True,
            )
            git_sha = result.stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        report = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "git_sha": git_sha,
            "suite": self.suite,
            "pass": True,
            "metrics": {},
        }

        for key, value in self.metrics.items():
            budget = self._budgets.get(key)
            entry = {"value": round(value, 2)}
            if budget is not None:
                entry["budget"] = budget
                entry["pass"] = value <= budget
                if not entry["pass"]:
                    report["pass"] = False
            report["metrics"][key] = entry

        METRICS_DIR.mkdir(parents=True, exist_ok=True)
        output_path = METRICS_DIR / f"{self.suite}.json"
        output_path.write_text(json.dumps(report, indent=2))


@pytest.fixture(scope="session")
def metrics_collector():
    collector = MetricsCollector("backend")
    yield collector
    collector.write()
