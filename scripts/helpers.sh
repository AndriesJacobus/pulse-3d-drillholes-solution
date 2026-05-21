#!/usr/bin/env bash
# Shared helpers for setup and deploy scripts.
# Source this file; do not execute directly.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

check() { printf "  ${BLUE}→${NC} %s\n" "$1"; }
ok()    { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
fail()  { printf "  ${RED}✗${NC} %s\n" "$1"; exit 1; }

section() {
  printf "\n${BOLD}[%s/%s] %s${NC}\n" "$1" "$2" "$3"
}

confirm() {
  if [ "${ASSUME_YES:-0}" = "1" ]; then return 0; fi
  printf "\n${BOLD}%s${NC} [y/N] " "$1"
  read -r answer
  case "$answer" in
    y|Y|yes|Yes) return 0 ;;
    *) echo "Aborted."; exit 0 ;;
  esac
}

require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    fail "$1 is required but not installed"
  fi
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
