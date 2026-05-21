# NOTES

## Time spent

| Phase | Time | Focus |
|-------|------|-------|
| Backend | ~1h | FastAPI, data models, desurveying engine, data quality, tests |
| Frontend + 3D | ~1.5h | React + R3F, grade colouring, 3D scene, info panel, 20 tests |
| Interaction + UX | ~2h | Camera controls, grade estimation (GPR), hover, animation-deferred PDF, pixelation transitions, 39 FE + 25 BE tests |
| Deploy + polish | - | |

Pre-work (research, planning, architecture docs): ~3h, tracked separately. This covered company research, data audit, architecture decisions, and implementation planning before writing code.

## Approach and key decisions

### Architecture

Full-stack with a Python backend and React frontend. The brief is a "full-stack challenge" and Pulse Intelligence's production stack is Python, so shipping without a backend would skip half the point.

The backend owns all domain logic: CSV parsing, Pydantic validation, desurveying, coordinate centering, and data quality checks. The frontend receives pre-computed 3D geometry and does zero maths. This separation means the geometry is testable in isolation and the API contract is the boundary between concerns.

### Desurveying

All 31 holes have a single survey point at the collar (no downhole deviation data). With one station, tangential projection and minimum curvature produce identical results. Tangential is simpler and correct for this dataset.

For each point at downhole depth `d`: east/north displacements use `cos(dip) * sin/cos(azimuth)`, vertical displacement uses `sin(dip)`. Negative dip means downward. The function accepts intercept boundary depths alongside regular sample points, so grade colour transitions are exact.

### Coordinate handling

MGA Zone 51 easting values around 318,000 would lose sub-metre precision in WebGL's 32-bit floats. The backend subtracts the dataset centroid from all coordinates, producing values near zero. Axis mapping follows Three.js convention: east to X, elevation to Y (up), north to -Z (into screen).

### Data quality

After auditing the challenge data, seven findings stood out (CVEX028 spatial outlier, twin-hole pairs, RL jumps, vertical hole with non-zero azimuth, grade outlier, empty columns, 58% barren holes). Rather than noting these in a doc, I built quality checks into the system. Six checks run at startup and results are served via `/api/data-quality`.

Pulse Intelligence's product is extracting structured data from mining documents. Data quality is the core value proposition, so demonstrating awareness of quality issues in the challenge data felt directly relevant.

A standalone CLI script (`scripts/analyse_data.py`) provides deeper statistical profiling for investigating new datasets independently of the app.

### Camera controls and interaction

OrbitControls with a fly-to animation on selection. Clicking a hole smoothly pans the orbit target to the collar position (lerp at 0.08 per frame). Clicking empty space deselects. A "Fit all" button resets the camera to frame all holes using drei's `Bounds.refresh()`.

Hit detection uses invisible cylinder meshes alongside the visual `Line` geometry. drei's `Line` component uses `LineSegments2`, which does not participate in Three.js raycasting. The cylinders (radius 1.5m for traces, 2m for intercepts) provide reliable click and hover targets.

### Grade estimation

14 intercepts across two prospects is too sparse for kriging (needs 30+ samples for a reliable variogram) and far below what ML approaches require. Gaussian Process Regression fits well: it handles small datasets, optimises kernel hyperparameters automatically, and provides uncertainty at every prediction point.

The implementation uses scikit-learn's `GaussianProcessRegressor` with a `ConstantKernel * RBF + WhiteKernel` configuration. Grades are log-transformed before fitting since the distribution is heavily skewed (0.6 to 10.8 g/t). Barren holes are included as zero-grade samples, constraining the interpolation where gold is absent.

The result is a voxel grid (10m cells) rendered as an `InstancedMesh`. Opacity encodes confidence: it decreases both with GPR uncertainty and with distance from the nearest sample (cosine fade beyond 50m). The cloud is togglable and off by default. The disclaimer states clearly that this is a visual aid, not a resource estimate.

GPR with an RBF kernel is mathematically equivalent to kriging with a Gaussian variogram, but without the fragile variogram fitting step. This distinction matters: presenting kriging results from 14 samples would suggest poor geostatistical judgement.

## Trade-offs

- **No database.** Static CSV loaded into memory at startup. For 31 holes this is appropriate. The loader abstraction (`loader.py`) means swapping CSV for PostgreSQL changes one module.
- **Tangential desurveying only.** Correct for single-station straight holes. The function signature supports adding minimum curvature as an internal change without modifying callers.
- **5m trace sampling.** Sufficient for straight holes. Intercept boundary depths are always included regardless of interval, so colour transitions are exact. Configurable in `config.py`.
- **No authentication.** POC scope. Production path: JWT middleware with tenant isolation.
- **GPR over kriging.** Kriging is the industry standard but needs 30+ samples for variogram estimation. GPR produces equivalent results without the variogram step. The trade-off: GPR is less familiar to mining geologists, but the mathematical output is identical.
- **Animation-first PDF updates.** Clicking a hole or cluster defers the PDF panel update until the camera animation finishes. This prevents the side panel resizing mid-flight, which was visually jarring. The `onArrive` callback on FocusTarget keeps this decoupled from the animation system itself.
- **Canvas pixelation transition for page changes.** A canvas overlay runs a nearest-neighbour upscale effect over 700ms when the PDF switches pages. Two `drawImage` calls per frame, no external dependency. Masks the iframe reload flicker.
- **Natural sky blue gradient.** Replaced the near-black navy (#0a1628) background with sky blue (#4a90c4). Combined with the extended zoom range (maxDistance 10000, matching the camera far plane), the scene reads as an outdoor site viewed from above rather than a dark void.
- **Single global GPR model.** Both prospects are interpolated together. With more data, fitting separate models per prospect would capture local spatial structure better.
- **Fixed 10m voxel grid.** Adequate for the data density. Adaptive resolution (finer near data, coarser far away) would improve visual quality at the cost of complexity.

## What I would improve with more time

- Minimum curvature desurveying for curved multi-station holes
- Database backend (PostgreSQL + PostGIS) with a proper ingestion pipeline
- Spatial filtering (bounding box selection, depth range slider)
- Multi-commodity support (colour by different elements)
- Embedded PDF viewer with extraction region highlighting
- Performance optimisation for large datasets (LOD, instancing, streaming)
- Authentication and multi-tenancy
