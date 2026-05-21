# Decisions

Key technical decisions with rationale. Updated each phase.

---

## Phase 1: Backend

### Full-stack architecture, not frontend-only

The data is static CSV and could be processed entirely client-side. Chose a backend because:

- The repo is called "full-stack-challenge". Shipping without a backend skips half the brief.
- Pulse Intelligence's production stack is Python. Demonstrating backend competence matters.
- Desurveying, validation, and coordinate transforms are domain logic that belongs server-side, testable in isolation.
- A defined API contract is how this would work in a real product. The frontend should render, not compute.

### Tangential projection, not minimum curvature

All 31 holes have a single survey point at the collar (no downhole deviation surveys). With one station, tangential and minimum curvature produce identical results. Minimum curvature adds complexity for zero benefit on this dataset.

The desurvey function accepts a list of intercept depths and produces a trace, so adding multi-station support is an internal change, not an interface change.

### Centroid subtraction for coordinate centering

MGA Zone 51 easting values around 318,000 exceed WebGL's 32-bit float precision for sub-metre accuracy. Subtracting the dataset centroid produces coordinates near zero. No projection library needed since the data is already in projected metres.

### Lifespan startup with cached app state

Data is loaded, validated, desurveyed, and cached on `app.state` during FastAPI's lifespan context. All endpoints read from this cache. For 31 holes this completes in under 1ms.

The production equivalent is a Redis or in-process cache backed by database queries, with cache invalidation on data change. The route handlers already read from an abstraction (`app.state`), so swapping the backing store is a config change.

### 5m sample interval for trace generation

At 5m intervals, 31 holes produce ~1,400 trace points (~30KB JSON). At 1m, ~6,900 points (~70KB). Both are small, but 5m is sufficient since all holes are straight lines (single survey station). Intercept boundary depths are included regardless of interval, so colour transitions are exact. The interval is configurable in `config.py`.

### Grade > 0 in the intercept validator

Intercepts represent mineralised intervals. A zero-grade interval would not be reported as an intercept in a mining context. The validator rejects zero to avoid ambiguity. All 14 intercepts in the dataset have positive grades.

### Quality checks baked into the loader layer

After auditing the data, seven findings emerged that require explicit handling (CVEX028 spatial outlier, twin holes, RL jumps, etc.). Rather than treating these as observations in NOTES.md, we built quality checks into the system.

Pulse Intelligence's business is extracting structured data from mining documents. Data quality is the product. Building quality awareness into the challenge demonstrates alignment with their core value proposition.

### Loader abstraction

CSV reading is isolated in `loader.py` behind `load_collars()` and `load_intercepts()`. No other module touches CSV. In production, swapping CSV for PostgreSQL means rewriting `loader.py` internals. The Pydantic models, desurvey engine, quality checks, and API routes remain unchanged. This is the most important seam in the architecture because it encapsulates the biggest POC-to-production change.

### Full CSV schema in Pydantic models

CollarRecord and InterceptRecord carry all columns from the source CSV, including fields the backend does not currently use (latitude, longitude, hole_type, sampling_type, drilling_purpose, etc.). The alternative was trimming models to only the fields used by the desurveying and quality pipelines.

Kept the full schema because: the data is served to the frontend, which may need these fields for display (e.g. hole_type in the info panel, drilling dates for context). Trimming now and adding back later means changing the model, the loader, and the tests. Loading them upfront costs nothing (31 rows) and keeps the models as a faithful representation of the source data.

### CORS from environment variable

Hardcoded localhost origins work for development but not deployment. `CORS_ORIGINS` reads from an environment variable with localhost defaults. On Cloud Run, the deploy script sets the production origin.

### Version-controlled performance metrics

Performance test results are committed to `metrics/` as JSON. Budgets are defined in `metrics/budgets.json`. The assessor can see actual measured values, not just pass/fail. Git history shows how metrics evolved. The same files would feed CI/CD in production.

---

## Phase 2: Frontend + 3D Scene

### React Three Fiber over vanilla Three.js

R3F provides declarative scene composition with React's component model. The scene is built from `<Line>`, `<mesh>`, `<Html>` components that compose naturally. The alternative was imperative Three.js with manual scene graph management, which is harder to reason about and test.

drei (the R3F helper library) provides `OrbitControls`, `Bounds` (auto-framing), `Line` (GPU-accelerated), and `Html` (screen-space labels). These would take significant effort to implement from scratch.

### Zustand over React context for scene state

Selection state (`selectedHole`, `selectedIntercept`) needs to be shared between the 3D scene and the info panel. React context would trigger re-renders of the entire tree on every state change. Zustand provides selector-based subscriptions, so only the components that use the changed slice re-render. For a scene with 31 interactive objects, this matters.

### TanStack Query for data fetching

The data is static (never changes during a session), but TanStack Query gives loading/error states, deduplication, and retry for free. The hooks return `{ data, isLoading, error }` and the components handle all three states. The alternative was raw `fetch` in a `useEffect`, which requires manual state management for loading/error.

### Log-scaled colour domain

The grade distribution is skewed: 12 of 14 intercepts fall below 5.0 g/t, with a single outlier at 10.8. A linear colour scale compresses 85% of the data into the cool half of the ramp. Log scaling (`scaleSequentialLog`) spreads the visual range so differences between 0.6 and 3.0 g/t are visible, not washed out. This is a deliberate choice, not a default.

### YlOrRd colour ramp

Yellow-orange-red follows mining convention: cool colours for low grades, hot for high. Alternatives considered: Viridis (perceptually uniform, but the yellow-purple range does not map intuitively to "low grade / high grade" for mining users), Magma (similar issue). YlOrRd is the standard in mining GIS and exploration software.

### Tailwind CSS v4 with custom design tokens

Tailwind v4 uses CSS-native `@theme` for tokens rather than a JavaScript config file. Design tokens (background, text, accent, border colours) are defined once in `index.css` and referenced throughout. The colour system uses a dark theme (common for 3D viewers) with amber/gold accents that reference the gold commodity.

### Frontend receives pre-computed geometry

The frontend does zero geometry maths. All 3D coordinates arrive pre-computed from the backend in the Three.js Y-up coordinate system. This keeps the rendering layer thin: map over the data, create `Line` and `mesh` components at the given positions. No desurveying, no coordinate transforms, no axis mapping on the client.

---

## Phase 3: Interaction + Grade Estimation

### Smoothstep camera animation, not lerp or instant snap

Clicking a hole animates the camera to the collar position over 1 second using smoothstep easing (HOLE_ZOOM_DISTANCE=350 units). Clicking a cluster zooms to fit it (radius * 4). The earlier implementation used per-frame lerp (0.08), which produced variable-speed animation that felt floaty at large distances. Smoothstep gives consistent timing with natural acceleration and deceleration. Snapping instantly was ruled out because it is disorienting: the user loses spatial context.

### Invisible cylinder hit meshes for click targets

drei's `Line` component uses `LineSegments2`, which does not participate in Three.js's standard raycaster. Alternatives considered: patching the Line's `computeLineDistances`, using `MeshLine`, or switching to tube geometry. Invisible cylinders (radius 1.5m traces, 2m intercepts) are simpler, performant, and composable with R3F's event system. They also enable hover events.

### Background click to deselect via onPointerMissed

R3F's `onPointerMissed` on the `Canvas` fires only when the click hits no 3D object. This cleanly handles deselection without needing to check "did I click empty space?" manually. The alternative was a transparent background plane, which would interfere with OrbitControls.

### GPR over kriging for grade estimation

Kriging is the industry standard for mineral resource estimation but needs 30+ samples for reliable variogram fitting. With 14 intercepts, variogram estimation is unreliable. GPR with an RBF kernel is mathematically equivalent to kriging with a Gaussian variogram, but kernel hyperparameters are optimised via maximum likelihood rather than manual variogram selection. The distinction matters for a mining data company: presenting kriging results from 14 samples would suggest poor geostatistical judgement.

### Barren holes as zero-grade constraints

17 holes have no intercepts above the cutoff. Including these as zero-grade samples at regular intervals constrains the interpolation: the model learns where gold is absent, not just where it is present. Without this, the GPR would extrapolate high grades into barren zones.

### Log-transform grades before GPR fitting

The grade distribution is heavily skewed (0.6 to 10.8 g/t). Log-transforming before fitting improves GPR performance by making the distribution more symmetric. The back-transform (exponentiation) can produce unrealistically high values in extrapolated regions, so we cap at 1.5x the observed maximum.

### InstancedMesh for voxel rendering

A 10m grid within 50m of data produces ~2600 voxels. InstancedMesh renders these in a single draw call with per-instance colour via `setColorAt()`. Alternatives: individual meshes (2600 draw calls, poor performance), Points (less visual information), volume rendering (custom GLSL, too complex for the time budget).

### Grade cloud off by default with disclaimer

The estimation is speculative. Showing it by default would give false confidence. The toggle ("Show grades"/"Hide grades") keeps it secondary to the drillhole data. The disclaimer text comes from the backend response, so the API itself communicates the limitation.

### DBSCAN spatial clustering for drill hole groups

31 holes form visible clusters on the map. DBSCAN (density-based) on 2D collar coordinates (east, north) finds clusters without a pre-specified count. eps=100m and min_samples=2 produces 4 clusters from 30 holes. CVEX028 (2.6km spatial outlier) is excluded as noise rather than promoted to a singleton.

The eps was increased from 50 to 100 because the original value fragmented natural groupings into too many small clusters. At 100m, the four clusters match the visual groupings in the data. Noise points are excluded rather than promoted to singletons because singleton "clusters" added visual clutter without providing useful navigation. Cluster labels use the format "Cluster N" rather than prospect names, since prospect assignment in the source data is unreliable (CVEX028 is assigned to Cheer but sits 2.6km away). Backend computes clusters at startup and serves via `/api/clusters`.

### Distance-adaptive click areas

At default cylinder radius (1.5m traces, 2m intercepts), distant holes are nearly impossible to click. `useFrame` scales hit cylinders by up to 6x based on camera distance. At 50m (close), the radius stays at 1x. At 1000m+, it reaches 6x. This makes far-away holes clickable without affecting precision when zoomed in.

### PDF viewer stacks below InfoPanel (not replacing it)

Cross-referencing the 3D scene with the original announcement is the primary use case for the PDF link. The initial implementation replaced InfoPanel with PdfViewer, but this forced users to close the PDF to see hole details again. The current layout keeps InfoPanel always visible and stacks the PdfViewer below it when active. This way, hole details and the source document are visible simultaneously. The `#page=N` fragment navigates to the correct page.

### Multi-tile satellite map with extended ground plane

The initial single-tile map at zoom 15 covered only ~1km, while the dataset spans 10km (CVEX028 outlier). Rewrote to compute a tile grid that auto-selects zoom level (max 12 tiles). A 20km brown ground plane extends behind the tiles, providing continuous ground-level context. All materials use `DoubleSide` rendering so they remain visible when orbiting below the surface.

### Google Maps integration with satellite view

Per-hole links in the InfoPanel use `/maps/place/` format, which drops a pin at the hole's coordinates. The scene toolbar button uses `/maps/dir/` format with all cluster centroids as waypoints, showing labelled pins (A through D) for the four clusters. Satellite mode is appropriate for mining exploration (terrain and vegetation visibility).

### Auto port selection for dev ergonomics

`run.py` scans from port 8000 upward to find an available port, then passes it to uvicorn. The frontend's `vite.config.ts` reads `API_PORT` from the environment and sets `strictPort: false`, so both services find open ports without manual configuration. The CORS whitelist includes ports 5173 through 5175 to accommodate Vite's port fallback. This avoids the "port already in use" friction when running multiple dev sessions.

### Clickable collar labels for direct hole navigation

Collar labels in `DrillholeTrace` are clickable: clicking a label selects the hole and zooms the camera to it. This is a shortcut past the invisible-cylinder hit mesh, which is harder to target at distance. Combined with the distance-adaptive click areas, every hole is reachable at any zoom level through at least one interaction path.

### Cluster label visibility tied to camera distance

`ClusterMarker` labels are visible only when the camera is more than 600 units from the marker. When zoomed in close, cluster labels would overlap with individual collar labels and obstruct the view. Hiding them at close range keeps the scene clean during detailed inspection while still providing orientation when zoomed out.

### CSS gradient background for spatial orientation

A linear gradient behind the transparent Canvas (blue at top, brown at bottom) gives immediate sky/ground orientation. This is a CSS-only effect with zero GPU cost, unlike a Three.js skybox.

### Deferred PDF updates after camera animation

When clicking a hole or cluster, the camera animation runs to completion before the PDF viewer updates. Hole selection stores the target page in an `onComplete` callback on the animation system. Cluster clicks pass an `onArrive` callback via the FocusTarget store entry. This prevents the jarring experience of the side panel resizing mid-animation. Deselecting (clicking empty space) still closes the PDF immediately since no animation is involved.

### Canvas pixelation transition on PDF page change

When the PDF switches pages, a canvas overlay runs a genuine pixelation effect: a noise texture is drawn once, then each frame downscales it to a tiny resolution and upscales with `imageSmoothingEnabled = false` (nearest-neighbour interpolation). The resolution grows exponentially from 3px to full over 700ms while fading out in the final 35%. Only two `drawImage` calls per frame, both GPU-friendly. No external library needed.

### FocusTarget onArrive callback pattern

Extended the Zustand FocusTarget interface with an optional `onArrive` callback. This lets click handlers specify post-animation actions (like closing the PDF) without coupling the animation system to specific side effects. The CameraController forwards the callback to its internal animation ref and fires it when progress reaches 1.

### Sky gradient and zoom range

Changed the scene background gradient from near-black navy (#0a1628) to natural sky blue (#4a90c4) for realism. Increased OrbitControls maxDistance from 2000 to 10000 (matching the camera far plane) so users can zoom out far enough to see the full site in context.

---

## Phase 4: Deploy + Polish

### Firebase Hosting with Cloud Run rewrite

Firebase Hosting serves the frontend and rewrites `/api/**` to Cloud Run. The frontend uses the same relative API paths in dev (Vite proxy) and production (Firebase rewrite), so there are no environment conditionals in the client code. If the Cloud Run deploy fails, the frontend still deploys but API calls 404. This is an acceptable failure mode for a stretch goal.

### Playwright JS, not Python

The Phase 4 spec originally considered `pytest-playwright` running from the backend. This was wrong: it couples frontend tests to the Python environment. Playwright JS integrates with the existing npm toolchain. The assessor runs `npm run test:e2e` and gets browser tests without touching Python.

### E2E tests focus on DOM and API, not 3D pixels

3D pixel testing is fragile across GPUs and renderers. The E2E tests verify: scene container renders, collar label click opens info panel, API health check through the proxy, drillholes endpoint returns 31 holes. These are stable across environments and catch real integration failures.

### Cloud Run memory and startup

512Mi memory with min-instances 0. The container starts in ~2 seconds (CSV parsing + GPR fit). Cold starts are acceptable for a demo. `uv` cache is redirected to `/tmp/uv-cache` because the non-root container user's home directory would not be writable otherwise.

### Help popup with localStorage dismissal

First-time visitors see controls reference automatically. Once dismissed, localStorage prevents it from reappearing. This replaces a README-only controls description with an in-app guide. No external dependency, no cookie consent needed.

### Class component error boundary

React error boundaries require `getDerivedStateFromError`, which is class-only. The boundary wraps the R3F Canvas to catch WebGL failures. Inline in Scene.tsx since it is used exactly once.
