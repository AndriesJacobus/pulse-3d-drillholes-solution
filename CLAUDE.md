# Claude

Solution repo for the Pulse Intelligence Partners full-stack 3D drillholes challenge.

## Coding Standards

- Production-quality code throughout
- See `docs/coding-standards.md` for the full standards reference (both BE and FE)
- Comments only where logic is genuinely unclear from reading the code
- Follow separation of concerns
- Tests for all new code with proper coverage
- European English (organisation, behavioural, colour, realise)
- Backend lint: `cd backend && uv run ruff check . && uv run ruff format --check .`
- Frontend lint: `cd frontend && npx eslint src/ && npx prettier --check src/`

## Writing Style

- **Never use em dashes.** Use commas, periods, parentheses, or restructure.
- No AI vocabulary (leverage, delve, intricate, tapestry, landscape, etc.)
- No AI attribution anywhere
- Direct, specific, concise

## Stack

- **Backend:** FastAPI (Python 3.12), Pydantic v2, stdlib csv + math, uvicorn
- **Frontend:** React 19 + TypeScript + Vite, Three.js via React Three Fiber + drei
- **State:** Zustand (scene state), TanStack Query (data fetching)
- **Styling:** Tailwind CSS v4
- **Colour:** d3-scale + d3-scale-chromatic
- **Testing:** pytest + httpx (backend), Vitest + React Testing Library (frontend)
- **Lint:** Ruff (backend), ESLint + Prettier (frontend)
- **Deploy:** Firebase Hosting (frontend) + GCP Cloud Run (backend)

## Testing

- Test behaviour, not implementation
- Unit tests as default; integration/E2E where boundaries matter
- Every PR includes tests for new code
- Backend: `uv run pytest`
- Frontend: `npm run test`
