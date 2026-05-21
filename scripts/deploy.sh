#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/helpers.sh"

GCP_PROJECT="ajdp-9cf24"
GCP_REGION="australia-southeast1"
SERVICE_NAME="pulse-drillhole-api"
IMAGE="gcr.io/$GCP_PROJECT/$SERVICE_NAME"
HOSTING_SITE="ajdp-pulse-drillholes"

ASSUME_YES=0
SKIP_TESTS=0

usage() {
  cat <<EOF
Usage: ./scripts/deploy.sh <target> [--yes] [--skip-tests]

Targets:
  backend    Build and deploy API to Cloud Run
  frontend   Build and deploy to Firebase Hosting
  all        Deploy backend then frontend

Flags:
  --yes          Skip the interactive confirmation prompt
  --skip-tests   Skip pre-flight test gate
EOF
  exit 1
}

[ $# -lt 1 ] && usage

TARGET="$1"
shift
for arg in "$@"; do
  case "$arg" in
    --yes|-y)       ASSUME_YES=1 ;;
    --skip-tests)   SKIP_TESTS=1 ;;
    *) echo "Unknown flag: $arg"; usage ;;
  esac
done

# ─── Pre-flight ──────────────────────────────────────────────────────────────

preflight() {
  section "1" "4" "Pre-flight checks"

  check "Git status"
  if [ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" ]; then
    warn "Working tree has uncommitted changes"
  else
    ok "Working tree clean"
  fi

  check "Backend lint"
  (cd "$REPO_ROOT/backend" && uv run ruff check . && uv run ruff format --check .) || fail "Backend lint failed"
  ok "Backend lint passed"

  check "Frontend lint"
  (cd "$REPO_ROOT/frontend" && npx eslint src/ && npx prettier --check src/) || fail "Frontend lint failed"
  ok "Frontend lint passed"

  if [ "$SKIP_TESTS" = "0" ]; then
    check "Backend tests"
    (cd "$REPO_ROOT/backend" && uv run pytest -q) || fail "Backend tests failed"
    ok "Backend tests passed"

    check "Frontend tests"
    (cd "$REPO_ROOT/frontend" && npx vitest run) || fail "Frontend tests failed"
    ok "Frontend tests passed"
  else
    warn "Tests skipped (--skip-tests)"
  fi

  check "Frontend build"
  (cd "$REPO_ROOT/frontend" && npm run build 2>&1) || fail "Frontend build failed"
  ok "Frontend build succeeded"
}

# ─── Backend deploy ──────────────────────────────────────────────────────────

deploy_backend() {
  section "2" "4" "Deploy backend to Cloud Run"

  require_cmd gcloud

  confirm "Deploy $SERVICE_NAME to Cloud Run ($GCP_REGION)?"

  check "Building container image"
  (cd "$REPO_ROOT/backend" && gcloud builds submit --tag "$IMAGE" --project "$GCP_PROJECT") || fail "Cloud Build failed"
  ok "Image built and pushed"

  check "Deploying to Cloud Run"
  gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE" \
    --platform managed \
    --region "$GCP_REGION" \
    --allow-unauthenticated \
    --memory 512Mi \
    --max-instances 2 \
    --min-instances 0 \
    --project "$GCP_PROJECT" || fail "Cloud Run deploy failed"
  ok "Backend deployed"

  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$GCP_REGION" \
    --project "$GCP_PROJECT" \
    --format 'value(status.url)')

  check "Smoke test: $SERVICE_URL/api/health"
  HEALTH=$(curl -sf "$SERVICE_URL/api/health" 2>/dev/null) || fail "Health check failed"
  echo "$HEALTH" | grep -q '"ok"' && ok "Health check passed" || fail "Unexpected health response: $HEALTH"

  check "Smoke test: /api/drillholes"
  COUNT=$(curl -sf "$SERVICE_URL/api/drillholes" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null) || fail "Drillholes endpoint failed"
  [ "$COUNT" = "31" ] && ok "31 holes returned" || fail "Expected 31 holes, got $COUNT"
}

# ─── Frontend deploy ─────────────────────────────────────────────────────────

deploy_frontend() {
  section "3" "4" "Deploy frontend to Firebase Hosting"

  require_cmd firebase

  confirm "Deploy to Firebase Hosting ($HOSTING_SITE)?"

  check "Deploying to Firebase"
  (cd "$REPO_ROOT" && firebase deploy --only "hosting:$HOSTING_SITE" --project "$GCP_PROJECT") || fail "Firebase deploy failed"
  ok "Frontend deployed"

  HOSTING_URL="https://$HOSTING_SITE.web.app"

  check "Smoke test: $HOSTING_URL"
  curl -sf "$HOSTING_URL" >/dev/null 2>&1 && ok "Hosting URL responds" || warn "Hosting URL not responding yet (may need a moment)"

  check "Smoke test: $HOSTING_URL/api/health"
  HEALTH=$(curl -sf "$HOSTING_URL/api/health" 2>/dev/null) || warn "API proxy not responding (Cloud Run may be cold-starting)"
  if [ -n "${HEALTH:-}" ]; then
    echo "$HEALTH" | grep -q '"ok"' && ok "API proxy working" || warn "Unexpected response: $HEALTH"
  fi
}

# ─── Post-flight ─────────────────────────────────────────────────────────────

postflight() {
  section "4" "4" "Deploy summary"

  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$GCP_REGION" \
    --project "$GCP_PROJECT" \
    --format 'value(status.url)' 2>/dev/null || echo "(not deployed)")

  printf "\n"
  echo "  Backend:  $SERVICE_URL"
  echo "  Frontend: https://$HOSTING_SITE.web.app"
  echo "  Git SHA:  $(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  printf "\n${GREEN}${BOLD}Deploy complete.${NC}\n"
}

# ─── Main ────────────────────────────────────────────────────────────────────

case "$TARGET" in
  backend)
    preflight
    deploy_backend
    postflight
    ;;
  frontend)
    preflight
    deploy_frontend
    postflight
    ;;
  all)
    preflight
    deploy_backend
    deploy_frontend
    postflight
    ;;
  *)
    echo "Unknown target: $TARGET"
    usage
    ;;
esac
