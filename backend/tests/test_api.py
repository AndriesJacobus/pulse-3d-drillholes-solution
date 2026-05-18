import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app, lifespan


@pytest.fixture(scope="module")
async def client():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


class TestHealthEndpoint:
    async def test_returns_ok(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestMetadataEndpoint:
    async def test_returns_metadata(self, client):
        response = await client.get("/api/metadata")
        assert response.status_code == 200
        data = response.json()
        assert data["total_holes"] == 31
        assert data["total_intercepts"] == 14

    async def test_grade_range(self, client):
        response = await client.get("/api/metadata")
        data = response.json()
        assert data["grade_range"]["min"] == pytest.approx(0.6)
        assert data["grade_range"]["max"] == pytest.approx(10.8)

    async def test_prospects(self, client):
        response = await client.get("/api/metadata")
        data = response.json()
        assert "Cheer" in data["prospects"]
        assert "Sovereign" in data["prospects"]

    async def test_centroid_present(self, client):
        response = await client.get("/api/metadata")
        data = response.json()
        assert "x" in data["centroid"]
        assert "y" in data["centroid"]
        assert "z" in data["centroid"]


class TestDrillholesEndpoint:
    async def test_returns_all_holes(self, client):
        response = await client.get("/api/drillholes")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 31

    async def test_hole_has_trace(self, client):
        response = await client.get("/api/drillholes")
        data = response.json()
        hole = data[0]
        assert "trace" in hole
        assert len(hole["trace"]) > 2

    async def test_hole_has_collar(self, client):
        response = await client.get("/api/drillholes")
        data = response.json()
        hole = data[0]
        assert "collar" in hole
        assert "x" in hole["collar"]
        assert "y" in hole["collar"]
        assert "z" in hole["collar"]

    async def test_hole_with_intercepts(self, client):
        response = await client.get("/api/drillholes")
        data = response.json()
        holes_with_intercepts = [h for h in data if h["intercepts"]]
        assert len(holes_with_intercepts) > 0
        intercept = holes_with_intercepts[0]["intercepts"][0]
        assert "grade" in intercept
        assert "start_pos" in intercept
        assert "end_pos" in intercept

    async def test_intercept_has_3d_positions(self, client):
        response = await client.get("/api/drillholes")
        data = response.json()
        holes_with_intercepts = [h for h in data if h["intercepts"]]
        intercept = holes_with_intercepts[0]["intercepts"][0]
        for field in ["start_pos", "end_pos"]:
            pos = intercept[field]
            assert "x" in pos
            assert "y" in pos
            assert "z" in pos


class TestSourcePdfEndpoint:
    async def test_returns_pdf(self, client):
        response = await client.get("/api/source-pdf")
        assert response.status_code == 200
        assert "application/pdf" in response.headers["content-type"]


class TestDataQualityEndpoint:
    async def test_returns_report(self, client):
        response = await client.get("/api/data-quality")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "findings" in data

    async def test_has_spatial_outlier(self, client):
        response = await client.get("/api/data-quality")
        data = response.json()
        findings = data["findings"]
        spatial = [f for f in findings if f["code"] == "SPATIAL_OUTLIER"]
        assert len(spatial) >= 1
        assert "CVEX028" in spatial[0]["affected_rows"]
