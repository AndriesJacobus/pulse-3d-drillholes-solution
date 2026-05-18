# Architecture

## System overview

An interactive 3D viewer for mining drillhole data extracted from an ASX announcement. Two services: a Python API that owns the data and domain logic, and a React frontend that handles rendering and interaction.

```
Browser
  React + Three.js (R3F)
  3D scene, info panel, legend
        |
        | HTTP (JSON)
        v
FastAPI Backend
  CSV parsing, validation
  Desurveying engine
  Coordinate centering
  Quality report
  data/ (CSV + PDF)
```

## Backend (Phase 1)

### Modules

| Module | Responsibility |
|--------|---------------|
| `loader.py` | CSV parsing with Pydantic validation. Returns typed model lists. No other module touches CSV. |
| `models.py` | Pydantic models for input records (CollarRecord, InterceptRecord) and API responses (DrillholeResponse, MetadataResponse). Validators enforce domain rules at parse time. |
| `desurvey.py` | Converts collar position + dip + azimuth + depth into 3D coordinates. Handles coordinate centering and axis mapping for Three.js. |
| `quality.py` | Dataset-level quality checks run at startup. Spatial outliers, grade outliers, completeness, consistency, domain rules, near-duplicate detection. |
| `config.py` | Application settings. Data paths, CORS origins (env-configurable), project name, sample interval. |
| `main.py` | FastAPI app with lifespan startup. Five endpoints. All data loaded and desurveyed once at startup, cached on `app.state`. |

### Startup flow

Data is loaded once during the FastAPI lifespan context, not per-request. For 31 holes the entire pipeline (parse, validate, desurvey, quality report) completes in under 1ms.

```
Startup
  load_collars(csv)       -> list[CollarRecord]  (Pydantic validates each row)
  load_intercepts(csv)    -> list[InterceptRecord] (cross-validates against collars)
  compute_centroid()      -> (east, north, rl) mean of all collars
  build_drillhole_responses()  -> pre-computed 3D traces + intercept positions
  build_metadata()        -> grade range, prospects, centroid
  run_quality_report()    -> findings by severity
```

### API endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/metadata` | Project info, prospects, grade range, geographic centroid, commodities |
| `GET /api/drillholes` | All 31 holes with collar position, 3D trace, intercepts (with pre-computed 3D positions) |
| `GET /api/source-pdf` | Binary PDF (the original ASX announcement) |
| `GET /api/data-quality` | Quality findings by severity with affected rows |

Interactive API docs available at `/docs` (Swagger UI) and `/redoc`.

### Coordinate system

Raw MGA Zone 51 coordinates (easting ~318,000, northing ~6,685,000) would lose sub-metre precision in WebGL's 32-bit floats. The backend subtracts the dataset centroid, producing scene-relative coordinates near zero.

**Axis mapping to Three.js (Y-up, right-handed):**

| Geographic | Scene | Direction |
|-----------|-------|-----------|
| East | X | Right |
| RL (elevation) | Y | Up |
| North | -Z | Into screen (negated because Three.js Z points toward the viewer) |

The negation of north is deliberate. Three.js uses a right-handed coordinate system where the camera looks down -Z by default. Mapping north to -Z means "further north" is "further into the scene", which matches the spatial intuition of looking at a map from above.

All geometry in the API response is already in this scene coordinate system. The frontend does zero geometry maths.

### Validation rules

**Collars:** dip in [-90, 0], azimuth in [0, 360), total_depth > 0. Invalid rows are skipped with a warning log, not a hard failure.

**Intercepts:** grade > 0, depth_from < depth_to, hole_code must exist in collars. Orphan intercepts (referencing unknown holes) are skipped.

**Grade > 0 rationale:** Intercepts represent mineralised intervals. A zero-grade interval is by definition not an intercept. The validator rejects zero because the dataset only contains positive-grade intercepts, and accepting zero would create ambiguity between "unmineralised" and "measured at zero".

### Data quality checks

The quality module runs six checks at startup:

| Check | What it catches | Severity |
|-------|----------------|----------|
| Spatial outliers | CVEX028 is 2.6km from Cheer centroid (z-score 4.3) | warning |
| Completeness | 58% of holes have no intercepts; 3 columns entirely empty | info |
| Derived consistency | interval_m != depth_to - depth_from | error |
| Domain rules | Vertical hole with non-zero azimuth; RL variation within prospect | info |
| Grade outliers | STEX014 at 10.8 g/t is 2.5 std above mean | info |
| Near duplicates | 5 twin-hole pairs within 5m (shared collar pad) | info |

A standalone CLI script (`scripts/analyse_data.py`) provides deeper statistical profiling independently of the app.

### Testing

93 tests across 8 suites, with 98% code coverage enforced via `pytest-cov` (threshold: 90%):

| Suite | Count | Coverage |
|-------|-------|----------|
| `test_models.py` | 19 | Pydantic validator boundaries: dip, azimuth, total_depth, grade, depth ordering |
| `test_desurvey.py` | 20 | Vertical, horizontal, angled holes; centroid; scene coords; intercept positions |
| `test_loader.py` | 13 | Valid/invalid CSV; orphan intercepts; empty fields; whitespace; real data |
| `test_quality.py` | 12 | Each quality check; specific findings (CVEX028, STEX014); full report |
| `test_api.py` | 17 | All endpoints; response shapes; error paths (404); CORS allowed/disallowed/preflight |
| `test_performance.py` | 5 | Response times; payload size; startup load. Budgets enforced from `metrics/budgets.json` |
| `test_analyse_script.py` | 6 | Script runs; detects outliers; grade/spatial stats; error handling |
| `conftest.py` | 1 | MetricsCollector fixture with version-controlled budgets |

Performance metrics are version-controlled in `metrics/`. Each test run writes measured values against hard budgets defined in `metrics/budgets.json`. Coverage is enforced at 90% minimum via `pytest-cov` in `pyproject.toml`.

### Docker

`python:3.12-slim` base, `uv` for dependency management, non-root user. The image includes only production code and data (tests, scripts, and metrics excluded via `.dockerignore`).
