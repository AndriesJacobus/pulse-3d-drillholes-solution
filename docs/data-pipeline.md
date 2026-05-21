# Data pipeline

How drillhole data flows from raw CSV through the backend into 3D-ready API responses.

## Source data

Two CSV files extracted from an ASX announcement for the Comet Vale Gold Project:

- **drillhole_collars.csv** (31 rows): hole location, orientation, depth. MGA Zone 51 projected coordinates.
- **drill_intercepts.csv** (14 rows): mineralised intervals with gold grade.

Plus the original **source.pdf** for reference.

## Parsing and validation

`loader.py` reads each CSV with `csv.DictReader` and constructs Pydantic models per row. Validation happens at construction time:

```
CSV row -> dict -> Pydantic model (validates) -> list[CollarRecord]
                                                  or: warning log + skip
```

**Why skip instead of fail:** For a dataset with 31 holes, one bad row should not prevent loading the other 30. The quality report surfaces what was skipped and why. In production, this becomes a validation pipeline with human review for flagged rows.

**Cross-validation:** Intercepts are loaded second. Each intercept's `hole_code` is checked against the set of valid collars. Orphans are skipped with a warning.

## Desurveying

Converts each hole's collar position + orientation into a 3D polyline trace.

**Input per hole:** collar (east, north, rl), dip (degrees below horizontal), azimuth (degrees clockwise from north), total_depth (metres along hole).

**Algorithm: tangential projection.** All 31 holes have a single survey point at the collar (no downhole deviation data). With one station, tangential and minimum curvature methods produce identical results. No reason to add complexity for equivalent output.

For a point at downhole depth `d`:
```
dx = d * cos(dip) * sin(azimuth)     # east displacement
dy = d * cos(dip) * cos(azimuth)     # north displacement
dz = d * sin(dip)                     # vertical displacement (negative = down)
point = (collar_east + dx, collar_north + dy, collar_rl + dz)
```

**Trace sampling:** Every 5m along the hole, plus exact intercept boundary depths. The 5m interval is configurable in `config.py`. Intercept boundaries are always included regardless of interval, so grade colour transitions are exact.

## Coordinate centering

WebGL uses 32-bit floats. Raw MGA coordinates (easting ~318,000) would lose sub-metre precision. The backend computes the centroid of all collar positions and subtracts it, producing coordinates near zero.

```
centroid = mean(all collars' east, north, rl)

scene_x =  (east - centroid_east)     # east offset
scene_y =  (rl - centroid_rl)         # elevation offset (Y-up)
scene_z = -(north - centroid_north)   # north offset, negated for Three.js
```

The north negation maps geographic north to Three.js -Z (into screen), matching the convention of "looking down at a map" where north is away from the viewer. See `architecture.md` for the full axis mapping table.

## API response shape

The `/api/drillholes` endpoint returns all holes with pre-computed geometry. The frontend receives scene-ready coordinates and does zero maths.

Each drillhole includes:
- `collar`: scene-space position (Point3D)
- `trace`: ordered list of Point3D forming the 3D polyline
- `intercepts`: each with `start_pos` and `end_pos` in scene coordinates, plus grade, depth, and source PDF page reference
- Metadata: hole_code, prospect, dip, azimuth, total_depth

The `/api/metadata` endpoint returns the geographic centroid (in original MGA coordinates, not scene-relative) for reference, along with grade range bounds for the colour scale.

## Spatial clustering

After desurveying, collar 2D positions (east, north) are clustered using DBSCAN (eps=100m, min_samples=2). The algorithm groups holes that sit within 100m of each other into clusters without requiring a pre-specified count. For the real dataset, this produces 4 clusters from 30 holes. CVEX028 is classified as noise (2.6km from the nearest group) and excluded from the cluster results.

Each cluster record includes:
- **Centroid:** mean position of member collars (both scene coordinates and lat/lon)
- **Radius:** maximum distance from any member collar to the centroid
- **Membership:** list of hole codes in the cluster
- **Label:** "Cluster N" format (1-indexed)

The frontend uses these for navigation (click cluster to zoom) and Google Maps integration (cluster centroids as waypoints).

## Grade estimation pipeline

Intercept midpoints (with grade) and barren hole positions (grade=0 at 20m intervals) are extracted as sample points. Grades are log-transformed for numerical stability, then a Gaussian Process Regressor with RBF kernel is fitted. A 10m regular grid is built, filtered to within 50m of the nearest sample. The GPR predicts mean and standard deviation at each grid point, which are back-transformed, clamped, and returned as voxels with opacity derived from uncertainty and distance fade.

## Quality pipeline

Two tiers of data quality analysis:

**Tier 1: `quality.py` (runs at startup, served via API)**

Six checks producing findings with severity levels (error, warning, info) and affected row lists. The full report is cached on `app.state` and served at `/api/data-quality`.

Notable findings from this dataset:
- CVEX028 is 2.6km from its prospect centroid (likely a data entry error or misassigned prospect)
- 5 twin-hole pairs within 5m of each other (shared collar pads, common in fan drilling)
- STEX006 is vertical (dip=-90) but records azimuth=60 (azimuth is meaningless for vertical holes)

**Tier 2: `scripts/analyse_data.py` (standalone CLI)**

Deeper statistical profiling operating directly on raw CSV dicts, independently of the app modules. Produces a full report with grade statistics (percentiles, distribution), spatial extent, and all quality findings. Useful for investigating new datasets before the app processes them.

The two tiers share the same check logic conceptually but are implemented independently. The standalone script works without importing any app code, so it can run against any CSV pair without the FastAPI stack.
