#!/usr/bin/env bash
# =========================================================================
# C2-Network Database Setup Orchestration Script
#
# Builds only the C2 network tables, for working on them alone. The whole
# system's database (C1 + C2 + C3) is built by ../setup.sh instead.
#
# Usage:  PGHOST=localhost PGUSER=postgres PGDATABASE=railway_c2 ./database/c2-network/setup.sh
# Connection settings come from the standard PG* environment variables;
# nothing is stored in this file.
# =========================================================================
set -euo pipefail
cd "$(dirname "$0")"

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -o /dev/null)
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"

echo "Starting C2-Network database setup on ${PGDATABASE:-railway}..."
for f in schema functions triggers views seed_dev; do
  echo "Running $f.sql..."
  "${PSQL[@]}" -f "$f.sql"
done
echo "C2-Network database setup completed successfully!"
