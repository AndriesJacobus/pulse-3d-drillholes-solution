# 3D Drillhole Viewer

Interactive 3D viewer for mining drillhole data, built for the Pulse Intelligence Partners assessment.

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (Python package manager)

## Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The API runs on `http://localhost:8000`. Interactive docs at `/docs`.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/metadata` | Project info, grade range, prospects |
| `GET /api/drillholes` | All holes with 3D traces and intercepts |
| `GET /api/source-pdf` | Original ASX announcement PDF |
| `GET /api/data-quality` | Data quality findings |

### Tests

```bash
cd backend
uv run pytest
```

74 tests covering desurveying maths, CSV parsing, data quality checks, API endpoints, and performance budgets.

### Docker

```bash
cd backend
docker build -t pulse-drillholes .
docker run -p 8080:8080 pulse-drillholes
```

### Lint

```bash
cd backend
uv run ruff check .
```

## Documentation

- [docs/architecture.md](docs/architecture.md) - system overview, coordinate system, API design
- [docs/data-pipeline.md](docs/data-pipeline.md) - data flow from CSV to 3D-ready responses
- [docs/decisions.md](docs/decisions.md) - key technical decisions with rationale
