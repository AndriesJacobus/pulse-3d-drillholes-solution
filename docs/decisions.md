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

### CORS from environment variable

Hardcoded localhost origins work for development but not deployment. `CORS_ORIGINS` reads from an environment variable with localhost defaults. On Cloud Run, the deploy script sets the production origin.

### Version-controlled performance metrics

Performance test results are committed to `metrics/` as JSON. Budgets are defined in `metrics/budgets.json`. The assessor can see actual measured values, not just pass/fail. Git history shows how metrics evolved. The same files would feed CI/CD in production.
