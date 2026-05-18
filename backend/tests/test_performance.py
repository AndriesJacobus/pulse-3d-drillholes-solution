import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import COLLARS_PATH, INTERCEPTS_PATH
from app.loader import load_collars, load_intercepts
from app.main import app, lifespan
from app.quality import run_quality_report


@pytest.fixture(scope="module")
async def client():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


class TestApiPerformance:
    async def test_drillholes_response_time(self, client, metrics_collector):
        start = time.perf_counter()
        response = await client.get("/api/drillholes")
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert response.status_code == 200
        metrics_collector["api_drillholes_response_ms"] = elapsed_ms
        budget = metrics_collector.budgets.get("api_drillholes_response_ms", 500)
        assert elapsed_ms < budget, (
            f"GET /api/drillholes took {elapsed_ms:.0f}ms (budget: {budget}ms)"
        )

    async def test_metadata_response_time(self, client, metrics_collector):
        start = time.perf_counter()
        response = await client.get("/api/metadata")
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert response.status_code == 200
        metrics_collector["api_metadata_response_ms"] = elapsed_ms
        budget = metrics_collector.budgets.get("api_metadata_response_ms", 200)
        assert elapsed_ms < budget

    async def test_drillholes_payload_size(self, client, metrics_collector):
        response = await client.get("/api/drillholes")
        size_bytes = len(response.content)

        metrics_collector["api_drillholes_payload_bytes"] = size_bytes
        budget = metrics_collector.budgets.get("api_drillholes_payload_bytes", 200000)
        assert size_bytes < budget, f"Payload is {size_bytes} bytes (budget: {budget})"


class TestQualityReportPerformance:
    def test_quality_report_generation_time(self, metrics_collector):
        collars = load_collars(COLLARS_PATH)
        intercepts = load_intercepts(INTERCEPTS_PATH, {c.hole_code for c in collars})

        start = time.perf_counter()
        run_quality_report(collars, intercepts)
        elapsed_ms = (time.perf_counter() - start) * 1000

        metrics_collector["quality_report_ms"] = elapsed_ms
        budget = metrics_collector.budgets.get("quality_report_ms", 200)
        assert elapsed_ms < budget


class TestStartupPerformance:
    def test_data_loading_time(self, metrics_collector):
        start = time.perf_counter()
        collars = load_collars(COLLARS_PATH)
        intercepts = load_intercepts(INTERCEPTS_PATH, {c.hole_code for c in collars})
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(collars) == 31
        assert len(intercepts) == 14

        metrics_collector["startup_load_ms"] = elapsed_ms
        budget = metrics_collector.budgets.get("startup_load_ms", 1000)
        assert elapsed_ms < budget
