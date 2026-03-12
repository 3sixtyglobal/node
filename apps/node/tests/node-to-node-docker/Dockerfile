FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl jq && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node app source + static files + compiled locales
COPY node/apps/node/src ./src/
COPY node/apps/node/dist/locales ./dist/locales/
COPY node/apps/node/docs ./docs/
COPY node/apps/node/static ./static/
COPY node/apps/node/package.json ./

# Copy node_modules (bulk copy — symlinks are preserved as-is by Docker COPY)
COPY node/node_modules ./node_modules/

# Fix symlinks: Docker COPY preserves relative symlinks rather than resolving them.
# The local-link script creates 3 symlinks in node_modules/@twin.org/ that point
# outside node_modules/. We overwrite them with the actual package contents.
#   node        -> ../../apps/node           (the app itself, already at /app/)
#   node-core   -> ../../packages/node-core  (within node/ submodule)
#   verifiable-storage-connector-iota -> absolute path (in verifiable-storage/ submodule)
RUN rm -rf ./node_modules/@twin.org/node ./node_modules/@twin.org/node-core ./node_modules/@twin.org/verifiable-storage-connector-iota ./node_modules/@twin.org/rights-management-rest-client ./node_modules/@twin.org/rights-management-pnp-service ./node_modules/@twin.org/rights-management-service ./node_modules/@twin.org/api-core
COPY node/packages/node-core ./node_modules/@twin.org/node-core/
COPY verifiable-storage/packages/verifiable-storage-connector-iota ./node_modules/@twin.org/verifiable-storage-connector-iota/
COPY rights-management/packages/rights-management-rest-client ./node_modules/@twin.org/rights-management-rest-client/
COPY rights-management/packages/rights-management-pnp-service ./node_modules/@twin.org/rights-management-pnp-service/
COPY rights-management/packages/rights-management-service ./node_modules/@twin.org/rights-management-service/
COPY api/packages/api-core ./node_modules/@twin.org/api-core/
# The 'node' symlink points to the app itself — create it pointing to /app
RUN ln -s /app ./node_modules/@twin.org/node

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:${TWIN_PORT:-3000}/health || exit 1

EXPOSE 3000 3001

CMD ["node", "src/index.js"]
