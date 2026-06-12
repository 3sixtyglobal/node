FROM node:24.14.0-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl jq && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build context is the twin-node repo root (see docker-compose.yml). Everything in the
# image comes from the published npm packages installed in twin-node/node_modules —
# no local-source package overrides (post organization-identifiers refactor, the
# published @next versions carry the full org-DID model).
COPY apps/node/src ./src/
COPY apps/node/dist/locales ./dist/locales/
COPY apps/node/docs ./docs/
COPY apps/node/static ./static/
COPY apps/node/package.json ./

COPY node_modules ./node_modules/

# @twin.org/node-core and @twin.org/node are npm-workspace symlinks in
# twin-node/node_modules and arrive broken in the image. node-core's source is at the
# exact published tag, so copying it is equivalent to the registry package; the
# 'node' symlink points back at the app itself.
RUN rm -rf ./node_modules/@twin.org/node-core
COPY packages/node-core ./node_modules/@twin.org/node-core/
RUN rm -rf ./node_modules/@twin.org/node && ln -s /app ./node_modules/@twin.org/node

# dataspace-test-app is a test-only extension (TWIN_EXTENSIONS), not part of the node
# app's dependency tree. The published tarball (npm pack @twin.org/dataspace-test-app@next)
# is vendored into twin-node/node_modules on the host BEFORE the build and arrives via the
# node_modules COPY above. Do NOT `npm install` inside the image: with no lockfile in /app,
# npm re-reifies the ENTIRE @twin.org tree from the registry and silently overwrites any
# locally patched package (cost: one stale-image debugging round on 2026-06-11).

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:${TWIN_PORT:-3000}/health || exit 1

EXPOSE 3000 3001 3002 3003

CMD ["node", "src/index.js"]
