# NOTES

## Time spent

| Phase | Time | Focus |
|-------|------|-------|
| Backend | ~2.25h | FastAPI, data models, desurveying engine, data quality, tests |
| Frontend + 3D | - | (in progress) |
| Interaction + UX | - | |
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

## Trade-offs

- **No database.** Static CSV loaded into memory at startup. For 31 holes this is appropriate. The loader abstraction (`loader.py`) means swapping CSV for PostgreSQL changes one module.
- **Tangential desurveying only.** Correct for single-station straight holes. The function signature supports adding minimum curvature as an internal change without modifying callers.
- **5m trace sampling.** Sufficient for straight holes. Intercept boundary depths are always included regardless of interval, so colour transitions are exact. Configurable in `config.py`.
- **No authentication.** POC scope. Production path: JWT middleware with tenant isolation.

## What I would improve with more time

- Minimum curvature desurveying for curved multi-station holes
- Database backend (PostgreSQL + PostGIS) with a proper ingestion pipeline
- Spatial filtering (bounding box selection, depth range slider)
- Multi-commodity support (colour by different elements)
- Embedded PDF viewer with extraction region highlighting
- Performance optimisation for large datasets (LOD, instancing, streaming)
- Authentication and multi-tenancy
