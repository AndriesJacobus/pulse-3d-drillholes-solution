<p align="center">
  <img src="frontend/public/icon-192.png" alt="Drillhole Viewer" width="96" />
</p>

# 3D Drillhole Viewer

Interactive 3D viewer for mining drillhole data, built for the Pulse Intelligence Partners assessment.

**Live demo:** https://ajdp-pulse-drillholes.web.app

## Quick start

```bash
bash scripts/setup.sh
```

This checks prerequisites, installs dependencies, runs lint and tests, and builds the frontend. Flags: `--skip-tests`, `--backend-only`, `--frontend-only`.

Or set up manually:

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

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to the backend.

## Tests

### Backend (133 tests)

```bash
cd backend
uv run pytest
```

Covers desurveying maths, CSV parsing, data quality checks, grade estimation (GPR), spatial clustering, API endpoints, and performance budgets.

### Frontend unit tests (48 tests)

```bash
cd frontend
npm run test
```

Covers colour scale mapping, API client, state management, component rendering (InfoPanel, GradeLegend, Header), and HelpPopup behaviour.

### E2E browser tests (4 tests)

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Playwright tests that start both servers automatically: scene renders, collar click opens info panel, API health proxy, drillholes count.

## Build

```bash
cd frontend
npm run build
```

## Lint

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

## Deploy

```bash
bash scripts/deploy.sh all
```

Runs pre-flight checks (lint, tests, build), deploys backend to Cloud Run, deploys frontend to Firebase Hosting, and runs smoke tests. Targets: `backend`, `frontend`, `all`.

## Docker

```bash
cd backend
docker build -t pulse-drillholes .
docker run -p 8080:8080 pulse-drillholes
```

## Documentation

- [NOTES.md](NOTES.md) - approach, decisions, trade-offs, time spent
- [docs/architecture.md](docs/architecture.md) - system overview, coordinate system, API design
- [docs/data-pipeline.md](docs/data-pipeline.md) - data flow from CSV to 3D-ready responses
- [docs/decisions.md](docs/decisions.md) - key technical decisions with rationale
- [docs/coding-standards.md](docs/coding-standards.md) - coding standards for both stacks
