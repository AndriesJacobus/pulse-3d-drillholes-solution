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
| `estimation.py` | Grade estimation using Gaussian Process Regression. Extracts sample points from intercepts (midpoints) and barren holes (zero-grade at intervals). Builds a 3D voxel grid, fits GPR with RBF kernel, filters by distance and cutoff. |
| `clustering.py` | DBSCAN spatial clustering on collar 2D positions (east, north). eps=100m, min_samples=2. Produces 4 clusters from 30 holes (CVEX028 excluded as noise). Noise points are excluded, not promoted to singletons. |
| `config.py` | Application settings. Data paths, CORS origins (env-configurable, includes ports 5173-5175), project name, sample interval. |
| `run.py` | Backend launcher with auto port selection. Scans from port 8000 upward, writes the chosen port to stdout for frontend consumption. |
| `main.py` | FastAPI app with lifespan startup. Seven endpoints. All data loaded, desurveyed, clustered, and interpolated once at startup, cached on `app.state`. |

### Startup flow

Data is loaded once during the FastAPI lifespan context, not per-request. For 31 holes the entire pipeline (parse, validate, desurvey, quality report) completes in under 1ms.

```
Startup
  load_collars(csv)              -> list[CollarRecord]  (Pydantic validates each row)
  load_intercepts(csv)           -> list[InterceptRecord] (cross-validates against collars)
  compute_centroid()             -> (east, north, rl) mean of all collars
  build_drillhole_responses()    -> pre-computed 3D traces + intercept positions
  build_metadata()               -> grade range, prospects, centroid
  run_quality_report()           -> findings by severity
  compute_grade_estimation()     -> GPR interpolation, voxel grid (~2600 voxels)
  compute_clusters()             -> DBSCAN collar grouping (4 clusters, noise excluded)
```

### API endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/metadata` | Project info, prospects, grade range, geographic centroid, commodities |
| `GET /api/drillholes` | All 31 holes with collar position, 3D trace, intercepts (with pre-computed 3D positions) |
| `GET /api/source-pdf` | Binary PDF (the original ASX announcement) |
| `GET /api/grade-estimation` | GPR-interpolated grade voxels with uncertainty, cell size, method, disclaimer |
| `GET /api/clusters` | 4 spatial clusters with centroids, radii, hole membership, lat/lon (30 holes, noise excluded) |
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

133 tests across 10 suites, with 98% code coverage enforced via `pytest-cov` (threshold: 90%):

| Suite | Count | Coverage |
|-------|-------|----------|
| `test_models.py` | 19 | Pydantic validator boundaries: dip, azimuth, total_depth, grade, depth ordering |
| `test_desurvey.py` | 20 | Vertical, horizontal, angled holes; centroid; scene coords; intercept positions |
| `test_loader.py` | 13 | Valid/invalid CSV; orphan intercepts; empty fields; whitespace; real data |
| `test_quality.py` | 12 | Each quality check; specific findings (CVEX028, STEX014); full report |
| `test_api.py` | 25 | All endpoints including grade estimation and clusters; response shapes; error paths; CORS |
| `test_estimation.py` | 20 | Sample extraction, grid building, distance filtering, fade function, GPR output validation |
| `test_clustering.py` | 13 | DBSCAN clustering: empty/single input, cluster formation, noise exclusion, labels, centroid, radius, lat/lon averaging, hole accounting |
| `test_performance.py` | 5 | Response times; payload size; startup load. Budgets enforced from `metrics/budgets.json` |
| `test_analyse_script.py` | 6 | Script runs; detects outliers; grade/spatial stats; error handling |
| `conftest.py` | 1 | MetricsCollector fixture with version-controlled budgets |

Performance metrics are version-controlled in `metrics/`. Each test run writes measured values against hard budgets defined in `metrics/budgets.json`. Coverage is enforced at 90% minimum via `pytest-cov` in `pyproject.toml`.

### Docker

`python:3.12-slim` base, `uv` for dependency management, non-root user. The image includes only production code and data (tests, scripts, and metrics excluded via `.dockerignore`).

## Frontend (Phase 2)

### Stack

React 19 + TypeScript + Vite. Three.js via React Three Fiber (R3F) and drei. Zustand for scene state, TanStack Query for server data. Tailwind CSS v4 with custom design tokens. Vitest + React Testing Library for tests.

### Component hierarchy

```
App
├── Header                    (project name, hole/intercept counts)
├── Scene                     (CSS gradient bg, R3F Canvas, overlay controls)
│   ├── Canvas
│   │   ├── Lights            (ambient 0.6 + directional 0.4)
│   │   ├── CameraController  (fly-to on selection + cluster zoom, lerp orbit target)
│   │   ├── Bounds            (auto-frames camera to geometry)
│   │   │   └── DrillholeGroup
│   │   │       └── DrillholeTrace[]  (one per hole, hover feedback, distance-adaptive hit areas)
│   │   │           ├── Line          (full trace, colour by state)
│   │   │           ├── mesh          (invisible cylinder, scales with camera distance)
│   │   │           ├── InterceptSegment[]  (coloured by grade, YlOrRd, adaptive hit areas)
│   │   │           ├── mesh          (collar sphere)
│   │   │           └── Html          (collar label, clickable: selects hole + zooms camera)
│   │   ├── ClusterLayer      (ring markers at DBSCAN cluster centroids)
│   │   │   └── ClusterMarker[]  (click to zoom, amber ring + label visible >600 units)
│   │   ├── MapLayer          (ground context)
│   │   │   └── MapPlane      (multi-tile satellite imagery + 20km brown ground plane)
│   │   └── GradeCloud        (InstancedMesh voxels, togglable)
│   ├── Tooltip-wrapped buttons (Fit all, Show grades, Google Maps)
│   └── Disclaimer            (shown when grade cloud active)
├── GradeLegend               (colour bar overlay, log-spaced stops)
├── InfoPanel                 (always shown: details, intercepts, PDF source buttons, Google Maps link)
└── PdfViewer                 (iframe PDF, stacks below InfoPanel when active, page-anchored)
    └── PixelOverlay          (canvas-based pixelation transition on page change, nearest-neighbour upscale)
```

### Data flow

1. `useMetadata()` and `useDrillholes()` hooks fetch from `/api/*` via TanStack Query (staleTime: Infinity, data never changes)
2. `DrillholeGroup` creates a log-scaled d3 colour scale from the metadata grade range
3. Each `DrillholeTrace` renders the pre-computed trace as a drei `Line`, overlays coloured `InterceptSegment` lines at the correct 3D positions
4. Click events propagate through R3F's raycaster, updating Zustand store (`selectedHole`, `selectedIntercept`)
5. `InfoPanel` subscribes to the store and shows hole details, intercept list with grade swatches, and PDF source links

### State management

Two stores, no mixing:

- **Zustand** for UI state: `selectedHole`, `selectedIntercept`, `showGradeCloud`, `pdfPage`, `focusTarget` (with optional `onArrive` callback). Scene components, InfoPanel, and PdfViewer subscribe via selectors. The `onArrive` callback on FocusTarget allows click handlers to defer side effects (e.g. PDF updates) until the camera animation completes.
- **TanStack Query** for server state: drillholes, metadata, grade estimation, and clusters. Fetched once, cached indefinitely.

### Colour mapping

Gold grades are mapped to the YlOrRd (yellow-orange-red) sequential colour ramp from d3-scale-chromatic. The scale uses a **log domain** because the grade distribution is heavily skewed: 12 of 14 intercepts fall below 5.0 g/t, but the range extends to 10.8. A linear scale compresses the visual range. Log scaling spreads differentiation across where the data actually sits.

### E2E tests (Playwright)

4 browser tests using Playwright (Chromium):

| Test | What |
|------|------|
| Scene renders | Page loads, loading indicator clears, Canvas is visible |
| Collar click | Click a collar label, info panel opens |
| API health proxy | `/api/health` returns 200 through the preview server |
| Drillholes count | `/api/drillholes` returns 31 holes |

Playwright's `webServer` config starts both backend (uvicorn) and frontend (vite preview) automatically, polls ports, and tears down after tests. Run with `npm run test:e2e`.

### Unit tests (Vitest)

42 tests across 7 suites:

| Suite | Count | What |
|-------|-------|------|
| `colourScale.test.ts` | 8 | Log-scaled YlOrRd mapping, low/high ends, differentiation, parsing |
| `client.test.ts` | 7 | API success, error, network failure, PDF URL construction |
| `useStore.test.ts` | 10 | Selection state transitions, intercept clearing, grade cloud toggle, PDF state, deselection |
| `InfoPanel.test.tsx` | 7 | Empty state, hole details, intercepts, barren message, PDF links |
| `GradeLegend.test.tsx` | 4 | Min/max labels, colour stops count, commodity label, background colours |
| `Header.test.tsx` | 3 | Project name from metadata, hole/intercept counts, fallback title |
| `Interaction.test.tsx` | 3 | Click-to-select, deselect on miss, camera fly-to on selection |

## Interaction and Grade Estimation (Phase 3)

### Camera controls

OrbitControls with fly-to animation. Selecting a hole animates the camera to the collar position over 1 second using smoothstep easing (HOLE_ZOOM_DISTANCE=350 units). Clicking a cluster zooms to fit the cluster (radius * 4). Background click deselects via `onPointerMissed` on the Canvas. "Fit all" button calls `Bounds.refresh()` to re-frame all geometry.

### Hover feedback

Hover state tracked per `DrillholeTrace` via `onPointerEnter`/`onPointerLeave` on the invisible cylinder hit mesh. Hovered traces brighten to #cccccc and thicken to 2px. Cursor changes to pointer on hover.

### Grade estimation

**Backend (`estimation.py`):**

1. Extract sample points: intercept midpoints (with grade) and barren hole positions (grade=0 at 20m intervals)
2. Log-transform grades for numerical stability
3. Fit `GaussianProcessRegressor` with `ConstantKernel * RBF + WhiteKernel`
4. Build 10m regular grid, filter to within 50m of nearest sample
5. Predict mean and std, back-transform, clamp negatives and cap at 1.5x observed max
6. Opacity combines GPR uncertainty with cosine distance fade

**Frontend (`GradeCloud.tsx`):**

`THREE.InstancedMesh` with per-instance colour (grade mapped to YlOrRd) and per-instance position. Material is transparent with `depthWrite: false` and `renderOrder: -1` to avoid occluding drillhole traces. Togglable via Zustand store.

**Honesty:** The feature is off by default. When active, a disclaimer states "Estimated from 14 intercepts using GPR interpolation. This is a visual aid for exploration, not a resource estimate." Voxel opacity fades with distance from data and with increasing uncertainty.

### Spatial clustering

**Backend (`clustering.py`):** DBSCAN on 2D collar coordinates (east, north), eps=100m, min_samples=2. Produces 4 clusters from 30 holes. CVEX028 is excluded as noise (2.6km spatial outlier). Noise points are dropped rather than promoted to singletons, keeping the cluster view focused on meaningful groupings. Cluster labels follow the format "Cluster N".

**Frontend (`ClusterMarker.tsx`):** Ring geometry at each cluster centroid with an Html label. Labels are visible when zoomed out (camera distance >600 units) and hidden when close, avoiding clutter during detailed inspection. Clicking a cluster triggers `setFocusTarget` in Zustand, which causes `CameraController` to animate the camera to frame the cluster (position at radius * 4 offset).

### Distance-adaptive click areas

`DrillholeTrace` and `InterceptSegment` scale their invisible hit cylinders based on camera distance. At 50m (close), the radius stays at 1x. At 1000m+, it reaches 6x. This makes far-away holes clickable without affecting precision when zoomed in. Implemented via `useFrame` per component.

### PDF viewer

Clicking a "Source" button on an intercept or collar sets `pdfPage` in Zustand. The App layout responds: PdfViewer (an iframe pointing to `/api/source-pdf#page=N`) stacks below the InfoPanel rather than replacing it, so hole details remain visible while cross-referencing the source document. A close button resets `pdfPage` to null, collapsing the PDF section.

### Satellite map and ground plane

Multi-tile ESRI World Imagery with auto-zoom selection (max 12 tiles) covering the full extent of the drillhole data. A 20km brown ground plane extends behind the tiles for continuous ground reference. All materials use `DoubleSide` rendering so they remain visible when orbiting below the surface. Y position is near surface level (`bounds.max_y - 15`).

### Google Maps integration

Per-hole links in the InfoPanel use the `/maps/place/` format, which drops a pin at the hole's lat/lon. The scene toolbar button uses the `/maps/dir/` format with cluster centroids as waypoints, showing pins A through D for the four clusters. Both open in satellite mode.

### Visual orientation

A CSS gradient behind the transparent Canvas (dark blue at top, earthy brown at bottom) provides sky/ground orientation with zero GPU cost. Button tooltips (custom component, 300ms delay) give discoverability to the scene controls.

## Deploy and Polish (Phase 4)

### Infrastructure

Firebase Hosting serves the frontend static build and rewrites `/api/**` to Cloud Run (`australia-southeast1`). This means the frontend uses the same relative API paths (`/api/health`, `/api/drillholes`) in both development (Vite proxy) and production (Firebase rewrite). Zero environment-specific code paths.

### Error boundary

A class component (`SceneErrorBoundary`) wraps the R3F Canvas. WebGL failures (lost context, shader compilation errors) are caught and render a recovery message instead of blanking the page. React error boundaries require `getDerivedStateFromError`, which is class-only.

### Help popup

First-visit help popup shows controls reference (orbit, zoom, pan) and interaction guide (select, deselect, cluster zoom). Dismissed state persists via localStorage. Closes on Escape key or click outside. Uses `useCallback` for a stable dismiss reference in the effect cleanup.

### Scripts

`scripts/setup.sh` validates prerequisites (Python 3.12+, uv, Node 18+), installs dependencies, runs lint and tests, builds the frontend. Flags: `--skip-tests`, `--backend-only`, `--frontend-only`.

`scripts/deploy.sh` runs pre-flight gates (lint, tests, build, git status), deploys backend to Cloud Run, deploys frontend to Firebase Hosting, runs smoke tests (health check, drillhole count). Targets: `backend`, `frontend`, `all`.

Both source `scripts/helpers.sh` for coloured terminal output, section numbering, and confirmation prompts.
