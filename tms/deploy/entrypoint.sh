#!/bin/sh
set -eu

# Render publishes the public service URL at runtime. The compiled API reads
# APP_URL / API_PUBLIC_URL / CORS_ORIGINS from the environment, so derive them
# from RENDER_EXTERNAL_URL unless the operator has set them explicitly.
if [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  RENDER_EXTERNAL_URL="${RENDER_EXTERNAL_URL%/}"
  export APP_URL="${APP_URL:-$RENDER_EXTERNAL_URL}"
  export API_PUBLIC_URL="${API_PUBLIC_URL:-$RENDER_EXTERNAL_URL}"
  export CORS_ORIGINS="${CORS_ORIGINS:-$RENDER_EXTERNAL_URL}"
fi

PGLITE_DIR="${PGLITE_PATH:-/app/apps/api/.data/pgdata}"
UPLOADS_DIR="${UPLOAD_DIR:-/app/apps/api/uploads}"

# The demo database is baked into the image. A previous process in this same
# container can leave PGlite lock files behind; they are safe to remove because
# this container runs a single embedded database instance.
mkdir -p "$UPLOADS_DIR"
rm -f "$PGLITE_DIR/postmaster.pid" "$PGLITE_DIR"/.s.PGSQL.* 2>/dev/null || true

echo "Starting Erniza TMS demo on port ${PORT:-10000}"
echo "Public URL: ${API_PUBLIC_URL:-http://localhost:${PORT:-10000}}"

exec node dist/index.js
