#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/helpers.sh"

SKIP_TESTS=0
BACKEND_ONLY=0
FRONTEND_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --skip-tests)     SKIP_TESTS=1 ;;
    --backend-only)   BACKEND_ONLY=1 ;;
    --frontend-only)  FRONTEND_ONLY=1 ;;
    -h|--help)
      echo "Usage: ./scripts/setup.sh [--skip-tests] [--backend-only] [--frontend-only]"
      exit 0 ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

TOTAL=7
[ "$SKIP_TESTS" = "1" ] && TOTAL=$((TOTAL - 1))
[ "$BACKEND_ONLY" = "1" ] && TOTAL=$((TOTAL - 2))
[ "$FRONTEND_ONLY" = "1" ] && TOTAL=$((TOTAL - 2))

STEP=0
next_step() { STEP=$((STEP + 1)); section "$STEP" "$TOTAL" "$1"; }

# ─── 1. Prerequisites ───────────────────────────────────────────────────────

next_step "Prerequisites"

if [ "$FRONTEND_ONLY" = "0" ]; then
  require_cmd python3
  PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
  check "Python $PY_VERSION"
  if ! python3 -c "import sys; assert sys.version_info >= (3, 12)" 2>/dev/null; then
    fail "Python 3.12+ required (found $PY_VERSION)"
  fi
  ok "Python 3.12+ found"

  require_cmd uv
  ok "uv found ($(uv --version 2>&1 | head -1))"
fi

if [ "$BACKEND_ONLY" = "0" ]; then
  require_cmd node
  NODE_VERSION=$(node --version)
  check "Node.js $NODE_VERSION"
  NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js 18+ required (found $NODE_VERSION)"
  fi
  ok "Node.js 18+ found"

  require_cmd npm
  ok "npm found ($(npm --version))"
fi

# ─── 2. Backend dependencies ────────────────────────────────────────────────

if [ "$FRONTEND_ONLY" = "0" ]; then
  next_step "Backend dependencies"
  check "Installing Python packages"
  (cd "$REPO_ROOT/backend" && uv sync --extra dev)
  ok "Backend dependencies installed"
fi

# ─── 3. Frontend dependencies ───────────────────────────────────────────────

if [ "$BACKEND_ONLY" = "0" ]; then
  next_step "Frontend dependencies"
  check "Installing npm packages"
  (cd "$REPO_ROOT/frontend" && npm install --silent)
  ok "Frontend dependencies installed"
fi

# ─── 4. Environment ─────────────────────────────────────────────────────────

next_step "Environment"

if [ -f "$REPO_ROOT/backend/data/drillhole_collars.csv" ] && [ -f "$REPO_ROOT/backend/data/drill_intercepts.csv" ]; then
  ok "Data files present (drillhole_collars.csv, drill_intercepts.csv)"
else
  fail "Missing data files in backend/data/"
fi

if [ -f "$REPO_ROOT/backend/data/source.pdf" ]; then
  ok "Source PDF present"
else
  warn "Source PDF missing (PDF viewer will not work)"
fi

if command -v gcloud &>/dev/null; then
  ok "gcloud CLI available (optional, for deploy)"
else
  warn "gcloud CLI not found (optional, only needed for deploy)"
fi

if command -v firebase &>/dev/null; then
  ok "Firebase CLI available (optional, for deploy)"
else
  warn "Firebase CLI not found (optional, only needed for deploy)"
fi

# ─── 5. Lint ────────────────────────────────────────────────────────────────

next_step "Lint"

if [ "$FRONTEND_ONLY" = "0" ]; then
  check "Backend lint (ruff)"
  (cd "$REPO_ROOT/backend" && uv run ruff check . && uv run ruff format --check .)
  ok "Backend lint passed"
fi

if [ "$BACKEND_ONLY" = "0" ]; then
  check "Frontend lint (eslint + prettier)"
  (cd "$REPO_ROOT/frontend" && npx eslint src/ && npx prettier --check src/)
  ok "Frontend lint passed"
fi

# ─── 6. Tests ───────────────────────────────────────────────────────────────

if [ "$SKIP_TESTS" = "0" ]; then
  next_step "Tests"

  if [ "$FRONTEND_ONLY" = "0" ]; then
    check "Backend tests (pytest)"
    (cd "$REPO_ROOT/backend" && uv run pytest -q)
    ok "Backend tests passed"
  fi

  if [ "$BACKEND_ONLY" = "0" ]; then
    check "Frontend tests (vitest)"
    (cd "$REPO_ROOT/frontend" && npx vitest run)
    ok "Frontend tests passed"
  fi
fi

# ─── 7. Build ───────────────────────────────────────────────────────────────

if [ "$BACKEND_ONLY" = "0" ]; then
  next_step "Build"
  check "Building frontend"
  (cd "$REPO_ROOT/frontend" && npm run build 2>&1)

  if [ -d "$REPO_ROOT/frontend/dist" ]; then
    BUNDLE_SIZE=$(du -sh "$REPO_ROOT/frontend/dist" | cut -f1)
    ok "Frontend built ($BUNDLE_SIZE)"
  else
    fail "Frontend build did not produce dist/"
  fi
fi

# ─── Done ────────────────────────────────────────────────────────────────────

printf "\n${GREEN}${BOLD}Setup complete.${NC}\n\n"
echo "Start the backend:   cd backend && uv run uvicorn app.main:app --reload"
echo "Start the frontend:  cd frontend && npm run dev"
echo ""
