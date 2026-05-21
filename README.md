# 3D Drillhole Viewer

Interactive 3D viewer for mining drillhole data, built for the Pulse Intelligence Partners assessment.

## Prerequisites

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)

## Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Or use the auto-port launcher, which finds an available port starting from 8000:

```bash
cd backend
uv run python run.py
```

The API runs on `http://localhost:8000` (or the next available port if 8000 is taken). Interactive docs at `/docs`.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/metadata` | Project info, grade range, prospects |
| `GET /api/drillholes` | All holes with 3D traces and intercepts |
| `GET /api/source-pdf` | Original ASX announcement PDF |
| `GET /api/clusters` | Spatial clusters with centroids and hole membership |
| `GET /api/data-quality` | Data quality findings |
| `GET /api/grade-estimation` | GPR-interpolated grade voxels with uncertainty |

### Tests

```bash
cd backend
uv run pytest
```

133 tests covering desurveying maths, CSV parsing, data quality checks, grade estimation (GPR), spatial clustering, API endpoints, and performance budgets.

### Docker

```bash
cd backend
docker build -t pulse-drillholes .
docker run -p 8080:8080 pulse-drillholes
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to the backend.

### Tests

```bash
cd frontend
npm run test
```

39 tests covering colour scale mapping, API client, state management, and component rendering (InfoPanel, GradeLegend, Header).

### Build

```bash
cd frontend
npm run build
```

### Lint

```bash
cd backend
uv run ruff check app/ tests/
uv run ruff format --check app/ tests/
```

```bash
cd frontend
npm run lint
npm run format:check
```

## Documentation

- [docs/architecture.md](docs/architecture.md) - system overview, coordinate system, API design
- [docs/data-pipeline.md](docs/data-pipeline.md) - data flow from CSV to 3D-ready responses
- [docs/decisions.md](docs/decisions.md) - key technical decisions with rationale
- [docs/coding-standards.md](docs/coding-standards.md) - coding standards for both stacks
