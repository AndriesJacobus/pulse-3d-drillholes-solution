# Coding Standards

Standards for both stacks, enforced by tooling and review. The configuration files are the source of truth. This document explains each rule and its rationale.

---

## Shared

**Line length:** 100 characters (ruff and Prettier aligned).

**Comments:** None by default. Add one only when the logic is not clear from reading the code. One-line comments only.

**Naming:**

| Context | Convention | Example |
|---------|-----------|---------|
| Python variables/functions | snake_case | `load_collars`, `hole_code` |
| Python classes/models | PascalCase | `CollarRecord`, `DrillholeResponse` |
| TypeScript variables/functions | camelCase | `selectedHole`, `gradeToColour` |
| React components | PascalCase | `DrillholeGroup`, `InfoPanel` |
| TypeScript types/interfaces | PascalCase | `Drillhole`, `InterceptResponse` |
| Constants | UPPER_SNAKE_CASE | `SAMPLE_INTERVAL_M`, `API_BASE_URL` |

**Imports:** Three groups (stdlib, third-party, first-party), blank line between each, alphabetical within groups.

**Error handling:** Fail fast, typed exceptions, no silent swallowing. Invalid CSV rows are skipped with a warning (partial data is better than no data for a viewer).

**Testing:** Behaviour-driven, arrange-act-assert. Factory helpers for test data. Test boundaries explicitly.

**Language:** European English throughout (colour, organisation, behaviour, realise).

---

## Python (Backend)

### Ruff rules

Configured in `backend/pyproject.toml`. Target: Python 3.12, line length 100.

| Group | Purpose |
|-------|---------|
| E/F/W | pycodestyle + Pyflakes baseline |
| I | Import sorting (`known-first-party = ["app"]`) |
| N | PEP 8 naming (snake_case functions, PascalCase classes) |
| UP | Modernise syntax for 3.12 (`X \| None` over `Optional[X]`) |
| B | Bugbear: mutable defaults, broad exceptions, assert on tuples |
| A | Prevent shadowing built-in names |
| SIM | Simplification suggestions |
| TCH | Move type-only imports to `if TYPE_CHECKING:` |

E501 (line length) is ignored because `ruff format` handles it.

### Type annotations

All function signatures annotated. No `Any` in the API contract. Modern union syntax: `X | None` not `Optional[X]`.

### Pydantic

`field_validator` (v2), not `@validator`. Descriptive error messages. Optional fields have explicit defaults. Response models are separate from input models.

### Coverage

90% minimum via `pytest-cov`. `if TYPE_CHECKING:` blocks excluded. Current: 98%.

### Commands

```bash
uv run ruff check app/ tests/           # lint
uv run ruff format --check app/ tests/   # format check
uv run pytest                            # test (includes coverage)
```

---

## TypeScript (Frontend)

### ESLint

Flat config (`eslint.config.js`, ESLint 9+). Plugins: `@eslint/js`, `typescript-eslint`, `react-hooks`, `react-refresh`.

### Prettier

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

### TypeScript

Strict mode enabled. Key settings: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (forces explicit `import type`), `noFallthroughCasesInSwitch`. Target: ES2023. Module resolution: bundler (Vite).

### React patterns

- Function components only, named exports (no default exports)
- Props as interfaces, destructured in the function signature
- Zustand for scene state, TanStack Query for server state, no mixing
- No prop drilling beyond 2 levels

### Commands

```bash
npx eslint src/             # lint
npx prettier --check src/   # format check
npm run test                 # test
```

---

## Configuration files

| File | Purpose |
|------|---------|
| `backend/pyproject.toml` | Ruff rules, pytest config, coverage threshold |
| `frontend/eslint.config.js` | ESLint flat config |
| `frontend/.prettierrc` | Prettier formatting |
| `frontend/tsconfig.json` | TypeScript composite root |
| `frontend/tsconfig.app.json` | Strict type-checking for source |
