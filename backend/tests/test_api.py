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

    async def test_centroid_is_geographic(self, client):
        response = await client.get("/api/metadata")
        data = response.json()
        centroid = data["centroid"]
        assert "east" in centroid
        assert "north" in centroid
        assert "rl" in centroid
        assert centroid["east"] > 300000
        assert centroid["north"] > 6000000


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


class TestGradeEstimationEndpoint:
    async def test_returns_estimation(self, client):
        response = await client.get("/api/grade-estimation")
        assert response.status_code == 200
        data = response.json()
        assert "voxels" in data
        assert "cell_size" in data
        assert "method" in data
        assert "disclaimer" in data
        assert data["sample_count"] == 14

    async def test_voxels_have_required_fields(self, client):
        response = await client.get("/api/grade-estimation")
        data = response.json()
        assert len(data["voxels"]) > 0
        voxel = data["voxels"][0]
        for field in ["x", "y", "z", "grade", "uncertainty", "opacity"]:
            assert field in voxel

    async def test_grades_above_cutoff(self, client):
        response = await client.get("/api/grade-estimation")
        data = response.json()
        for voxel in data["voxels"]:
            assert voxel["grade"] >= 0.3

    async def test_method_is_gpr(self, client):
        response = await client.get("/api/grade-estimation")
        data = response.json()
        assert "Gaussian Process" in data["method"]


class TestClustersEndpoint:
    async def test_returns_clusters(self, client):
        response = await client.get("/api/clusters")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    async def test_cluster_shape(self, client):
        response = await client.get("/api/clusters")
        cluster = response.json()[0]
        assert "id" in cluster
        assert "label" in cluster
        assert "prospect" in cluster
        assert "centroid" in cluster
        assert "radius" in cluster
        assert "hole_codes" in cluster
        assert "latitude" in cluster
        assert "longitude" in cluster

    async def test_clustered_holes_are_subset_of_all(self, client):
        clusters = (await client.get("/api/clusters")).json()
        drillholes = (await client.get("/api/drillholes")).json()
        cluster_codes = set()
        for c in clusters:
            cluster_codes.update(c["hole_codes"])
        all_codes = {d["hole_code"] for d in drillholes}
        assert cluster_codes <= all_codes
        assert len(cluster_codes) == 30
        assert "CVEX028" not in cluster_codes


class TestErrorPaths:
    async def test_missing_pdf_returns_404(self, client, tmp_path, monkeypatch):
        monkeypatch.setattr("app.main.PDF_PATH", tmp_path / "nonexistent.pdf")
        response = await client.get("/api/source-pdf")
        assert response.status_code == 404

    async def test_unknown_endpoint_returns_404(self, client):
        response = await client.get("/api/nonexistent")
        assert response.status_code == 404


class TestCorsHeaders:
    async def test_cors_allowed_origin(self, client):
        response = await client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

    async def test_cors_disallowed_origin(self, client):
        response = await client.get(
            "/api/health",
            headers={"Origin": "http://evil.example.com"},
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" not in response.headers

    async def test_cors_preflight(self, client):
        response = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert "GET" in response.headers.get("access-control-allow-methods", "")
