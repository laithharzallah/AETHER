#!/usr/bin/env bash
# =============================================================================
# Applies every migration in supabase/migrations to a throwaway Postgres
# database, in filename order, and fails on the first error.
#
# Supabase provides an `auth` schema, an `auth.uid()` function and the
# authenticated/anon/service_role roles. Plain Postgres does not, so those are
# stubbed first — see scripts/sql/supabase-shim.sql.
#
# Usage:
#   scripts/verify-migrations.sh [--keep]
#
#   --keep   leave the database in place afterwards so it can be inspected
#
# Requires a reachable Postgres superuser connection. Override with PGHOST,
# PGPORT, PGUSER, PGPASSWORD or PSQL_SUPERUSER.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${AETHER_VERIFY_DB:-aether_migration_check}"
PSQL_SUPERUSER="${PSQL_SUPERUSER:-postgres}"
KEEP=0

for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# Run psql as the Postgres superuser. Uses sudo -u when available (typical for a
# local apt install), otherwise connects directly with the ambient credentials.
run_psql() {
  if [[ -n "${PGHOST:-}" ]] || ! command -v sudo >/dev/null 2>&1; then
    psql -U "$PSQL_SUPERUSER" "$@"
  else
    sudo -u "$PSQL_SUPERUSER" psql "$@"
  fi
}

echo "==> Recreating database '$DB_NAME'"
run_psql -q -d postgres -c "drop database if exists $DB_NAME;"
run_psql -q -d postgres -c "create database $DB_NAME;"

echo "==> Installing Supabase shim (auth schema, auth.uid(), roles)"
run_psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$ROOT/scripts/sql/supabase-shim.sql"

failed=0
count=0
for migration in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$migration")"
  count=$((count + 1))
  printf '==> [%02d] %s ... ' "$count" "$name"
  if output="$(run_psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$migration" 2>&1)"; then
    echo "ok"
    # Surface notices/warnings without failing the run.
    if [[ -n "$output" ]]; then
      echo "$output" | sed 's/^/       /'
    fi
  else
    echo "FAILED"
    echo "$output" | sed 's/^/       /'
    failed=1
    break
  fi
done

if [[ "$failed" -eq 0 ]]; then
  echo
  echo "==> Post-apply checks"
  run_psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" \
    -f "$ROOT/scripts/sql/post-apply-checks.sql"
fi

if [[ "$KEEP" -eq 0 ]]; then
  echo
  echo "==> Dropping database '$DB_NAME'"
  run_psql -q -d postgres -c "drop database if exists $DB_NAME;"
else
  echo
  echo "==> Kept database '$DB_NAME'"
fi

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "MIGRATION VERIFICATION FAILED" >&2
  exit 1
fi

echo
echo "All $count migrations applied cleanly."
