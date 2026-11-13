# Prebuilt Erniza Africa Safaris TMS demo
# The TypeScript source is not present in this workspace, so the image runs the
# compiled API/web bundles and the seeded PGlite database baked in below.
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=10000 \
    PGLITE_PATH=/app/apps/api/.data/pgdata \
    UPLOAD_DIR=/app/apps/api/uploads

WORKDIR /app

# Install only the runtime dependencies used by the compiled API.
COPY deploy/package.json deploy/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Preserve the original monorepo layout: the API resolves the admin SPA at
# apps/api/dist/../../web/dist, and resolves @erniza/shared from /app/node_modules.
COPY apps/api/dist ./apps/api/dist
COPY apps/web/dist ./apps/web/dist
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared/dist ./packages/shared/dist

RUN mkdir -p node_modules/@erniza \
    && ln -s ../../packages/shared node_modules/@erniza/shared

# Bake the seeded demo database and its uploaded media into the image.
# On Render the container filesystem is ephemeral, so each restart/deploy
# returns the demo to this exact seeded state.
COPY apps/api/.data/pgdata ./apps/api/.data/pgdata
COPY apps/api/uploads ./apps/api/uploads

COPY deploy/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/apps/api/db/migrations \
    && rm -f /app/apps/api/.data/pgdata/postmaster.pid /app/apps/api/.data/pgdata/.s.PGSQL.* \
    && chown -R node:node /app/apps/api/.data /app/apps/api/uploads

USER node

WORKDIR /app/apps/api

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/app/entrypoint.sh"]
