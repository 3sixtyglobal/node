FROM node:24.14.0-slim

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

# Fix symlinks: Docker COPY preserves symlinks as-is rather than resolving them.
# local-link renames originals to *.bak and creates symlinks pointing to host paths.
# Step 1: Restore all .bak packages (undo local-link symlinks → original npm versions)
RUN find ./node_modules/@twin.org -maxdepth 1 -name '*.bak' -exec sh -c \
      'pkg="${1%.bak}"; rm -rf "$pkg" && mv "$1" "$pkg"' _ {} \;

# Step 2: Override packages that have local source changes
RUN rm -rf ./node_modules/@twin.org/node ./node_modules/@twin.org/node-core \
    ./node_modules/@twin.org/verifiable-storage-connector-iota \
    ./node_modules/@twin.org/rights-management-rest-client \
    ./node_modules/@twin.org/rights-management-pnp-service \
    ./node_modules/@twin.org/rights-management-plugins \
    ./node_modules/@twin.org/rights-management-service \
    ./node_modules/@twin.org/rights-management-models \
    ./node_modules/@twin.org/dataspace-control-plane-service \
    ./node_modules/@twin.org/dataspace-models \
    ./node_modules/@twin.org/dataspace-test-app \
    ./node_modules/@twin.org/standards-dataspace-protocol \
    ./node_modules/@twin.org/federated-catalogue-service \
    ./node_modules/@twin.org/federated-catalogue-models \
    ./node_modules/@twin.org/data-core \
    ./node_modules/@twin.org/auditable-item-graph-models \
    ./node_modules/@twin.org/auditable-item-graph-rest-client \
    ./node_modules/@twin.org/auditable-item-graph-service \
    ./node_modules/@twin.org/api-core \
    ./node_modules/@twin.org/entity
COPY node/packages/node-core ./node_modules/@twin.org/node-core/
COPY framework/packages/entity ./node_modules/@twin.org/entity/
COPY auditable-item-graph/packages/auditable-item-graph-models ./node_modules/@twin.org/auditable-item-graph-models/
COPY auditable-item-graph/packages/auditable-item-graph-rest-client ./node_modules/@twin.org/auditable-item-graph-rest-client/
COPY auditable-item-graph/packages/auditable-item-graph-service ./node_modules/@twin.org/auditable-item-graph-service/
COPY verifiable-storage/packages/verifiable-storage-connector-iota ./node_modules/@twin.org/verifiable-storage-connector-iota/
COPY rights-management/packages/rights-management-rest-client ./node_modules/@twin.org/rights-management-rest-client/
COPY rights-management/packages/rights-management-pnp-service ./node_modules/@twin.org/rights-management-pnp-service/
COPY rights-management/packages/rights-management-plugins ./node_modules/@twin.org/rights-management-plugins/
COPY rights-management/packages/rights-management-service ./node_modules/@twin.org/rights-management-service/
COPY rights-management/packages/rights-management-models ./node_modules/@twin.org/rights-management-models/
COPY dataspace/packages/dataspace-control-plane-service ./node_modules/@twin.org/dataspace-control-plane-service/
COPY dataspace/packages/dataspace-models ./node_modules/@twin.org/dataspace-models/
COPY dataspace/packages/dataspace-test-app ./node_modules/@twin.org/dataspace-test-app/
COPY standards/packages/standards-dataspace-protocol ./node_modules/@twin.org/standards-dataspace-protocol/
COPY federated-catalogue/packages/federated-catalogue-service ./node_modules/@twin.org/federated-catalogue-service/
COPY federated-catalogue/packages/federated-catalogue-models ./node_modules/@twin.org/federated-catalogue-models/
COPY data/packages/data-core ./node_modules/@twin.org/data-core/
COPY api/packages/api-core ./node_modules/@twin.org/api-core/

# The 'node' symlink points to the app itself — create it pointing to /app
RUN ln -s /app ./node_modules/@twin.org/node

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:${TWIN_PORT:-3000}/health || exit 1

EXPOSE 3000 3001 3002

CMD ["node", "src/index.js"]
