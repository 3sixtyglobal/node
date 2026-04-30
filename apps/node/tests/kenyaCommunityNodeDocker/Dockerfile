FROM node:24.14.0-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl jq && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY node/apps/node/src ./src/
COPY node/apps/node/dist/locales ./dist/locales/
COPY node/apps/node/docs ./docs/
COPY node/apps/node/static ./static/
COPY node/apps/node/package.json ./

COPY node/node_modules ./node_modules/

# Resolve local-link symlinks back to published packages, then override with in-flight
# local sources. While TICKETs B/D/E are unmerged, TenantUrlHelper (api-tenant-processor)
# and the vaultConnectorType factory injections (engine-types, engine-server-types) only
# exist in our local sources.
RUN find ./node_modules/@twin.org -maxdepth 1 -name '*.bak' -exec sh -c \
      'pkg="${1%.bak}"; rm -rf "$pkg" && mv "$1" "$pkg"' _ {} \;

# node-core is a workspace package (not published independently); always copy from source.
RUN rm -rf ./node_modules/@twin.org/node-core \
    ./node_modules/@twin.org/api-core \
    ./node_modules/@twin.org/api-tenant-processor \
    ./node_modules/@twin.org/dataspace-control-plane-service \
    ./node_modules/@twin.org/dataspace-data-plane-service \
    ./node_modules/@twin.org/dataspace-models \
    ./node_modules/@twin.org/dataspace-test-app \
    ./node_modules/@twin.org/rights-management-pnp-service \
    ./node_modules/@twin.org/rights-management-models \
    ./node_modules/@twin.org/federated-catalogue-service \
    ./node_modules/@twin.org/federated-catalogue-models \
    ./node_modules/@twin.org/engine-types \
    ./node_modules/@twin.org/engine-server-types
COPY node/packages/node-core ./node_modules/@twin.org/node-core/
# api-core carries the BaseRestClient endpoint-URL fix that preserves query strings
# (so PNP/DSP outbound callbacks with `?tenantToken=` reach the right tenant).
COPY api/packages/api-core ./node_modules/@twin.org/api-core/
COPY api/packages/api-tenant-processor ./node_modules/@twin.org/api-tenant-processor/
COPY dataspace/packages/dataspace-control-plane-service ./node_modules/@twin.org/dataspace-control-plane-service/
COPY dataspace/packages/dataspace-data-plane-service ./node_modules/@twin.org/dataspace-data-plane-service/
COPY dataspace/packages/dataspace-models ./node_modules/@twin.org/dataspace-models/
COPY dataspace/packages/dataspace-test-app ./node_modules/@twin.org/dataspace-test-app/
COPY rights-management/packages/rights-management-pnp-service ./node_modules/@twin.org/rights-management-pnp-service/
COPY rights-management/packages/rights-management-models ./node_modules/@twin.org/rights-management-models/
COPY federated-catalogue/packages/federated-catalogue-service ./node_modules/@twin.org/federated-catalogue-service/
COPY federated-catalogue/packages/federated-catalogue-models ./node_modules/@twin.org/federated-catalogue-models/
COPY engine/packages/engine-types ./node_modules/@twin.org/engine-types/
COPY engine/packages/engine-server-types ./node_modules/@twin.org/engine-server-types/

# Local engine-types declares deps on @twin.org/automation-* that node's node_modules
# doesn't have (they live in engine/node_modules). Bring them in so engine-types can
# resolve its imports at runtime.
COPY engine/node_modules/@twin.org/automation-actions ./node_modules/@twin.org/automation-actions/
COPY engine/node_modules/@twin.org/automation-models ./node_modules/@twin.org/automation-models/
COPY engine/node_modules/@twin.org/automation-rest-client ./node_modules/@twin.org/automation-rest-client/
COPY engine/node_modules/@twin.org/automation-service ./node_modules/@twin.org/automation-service/

# The 'node' symlink points to the app itself.
RUN rm -rf ./node_modules/@twin.org/node && ln -s /app ./node_modules/@twin.org/node

# No HEALTHCHECK: /health is gated by TenantProcessor when TWIN_TENANT_ENABLED=true,
# so a keyless probe always returns 401. The test scripts poll /health directly.

EXPOSE 3000

CMD ["node", "src/index.js"]
