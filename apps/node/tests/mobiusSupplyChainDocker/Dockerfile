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

# Step 2: Override packages that have local source changes.
# Expanded for HostingService refactor + ecosystem-policy removal —
# many more @twin.org/* packages are in flight than originally listed.
RUN rm -rf ./node_modules/@twin.org/node ./node_modules/@twin.org/node-core \
    ./node_modules/@twin.org/verifiable-storage-connector-iota \
    ./node_modules/@twin.org/rights-management-rest-client \
    ./node_modules/@twin.org/rights-management-pnp-service \
    ./node_modules/@twin.org/rights-management-plugins \
    ./node_modules/@twin.org/rights-management-service \
    ./node_modules/@twin.org/rights-management-models \
    ./node_modules/@twin.org/rights-management-pap-service \
    ./node_modules/@twin.org/rights-management-pdp-service \
    ./node_modules/@twin.org/rights-management-pep-service \
    ./node_modules/@twin.org/rights-management-pip-service \
    ./node_modules/@twin.org/rights-management-pmp-service \
    ./node_modules/@twin.org/rights-management-pxp-service \
    ./node_modules/@twin.org/dataspace-control-plane-service \
    ./node_modules/@twin.org/dataspace-data-plane-service \
    ./node_modules/@twin.org/dataspace-models \
    ./node_modules/@twin.org/dataspace-test-app \
    ./node_modules/@twin.org/standards-dataspace-protocol \
    ./node_modules/@twin.org/standards-w3c-odrl \
    ./node_modules/@twin.org/synchronised-storage-models \
    ./node_modules/@twin.org/synchronised-storage-rest-client \
    ./node_modules/@twin.org/synchronised-storage-service \
    ./node_modules/@twin.org/federated-catalogue-filters \
    ./node_modules/@twin.org/federated-catalogue-models \
    ./node_modules/@twin.org/federated-catalogue-rest-client \
    ./node_modules/@twin.org/federated-catalogue-service \
    ./node_modules/@twin.org/data-core \
    ./node_modules/@twin.org/auditable-item-graph-models \
    ./node_modules/@twin.org/auditable-item-graph-rest-client \
    ./node_modules/@twin.org/auditable-item-graph-service \
    ./node_modules/@twin.org/api-core \
    ./node_modules/@twin.org/api-models \
    ./node_modules/@twin.org/api-rest-client \
    ./node_modules/@twin.org/api-service \
    ./node_modules/@twin.org/api-tenant-processor \
    ./node_modules/@twin.org/engine \
    ./node_modules/@twin.org/engine-core \
    ./node_modules/@twin.org/engine-models \
    ./node_modules/@twin.org/engine-server \
    ./node_modules/@twin.org/engine-server-types \
    ./node_modules/@twin.org/engine-types \
    ./node_modules/@twin.org/entity \
    ./node_modules/@twin.org/trust-models \
    ./node_modules/@twin.org/trust-service \
    ./node_modules/@twin.org/trust-generators \
    ./node_modules/@twin.org/trust-verifiers
COPY node/packages/node-core ./node_modules/@twin.org/node-core/
COPY framework/packages/entity ./node_modules/@twin.org/entity/
# Identity stays as the npm-installed version (bulk-copied via node/node_modules) to
# avoid pulling in the full identity + telemetry chain; backwards-compat is what we
# validate here.
COPY trust/packages/trust-models ./node_modules/@twin.org/trust-models/
COPY trust/packages/trust-service ./node_modules/@twin.org/trust-service/
COPY trust/packages/trust-generators ./node_modules/@twin.org/trust-generators/
COPY trust/packages/trust-verifiers ./node_modules/@twin.org/trust-verifiers/
COPY auditable-item-graph/packages/auditable-item-graph-models ./node_modules/@twin.org/auditable-item-graph-models/
COPY auditable-item-graph/packages/auditable-item-graph-rest-client ./node_modules/@twin.org/auditable-item-graph-rest-client/
COPY auditable-item-graph/packages/auditable-item-graph-service ./node_modules/@twin.org/auditable-item-graph-service/
COPY verifiable-storage/packages/verifiable-storage-connector-iota ./node_modules/@twin.org/verifiable-storage-connector-iota/
# rights-management family — full copy (HostingService refactor + ecosystem-policy removal touches every variant).
COPY rights-management/packages/rights-management-models ./node_modules/@twin.org/rights-management-models/
COPY rights-management/packages/rights-management-pap-service ./node_modules/@twin.org/rights-management-pap-service/
COPY rights-management/packages/rights-management-pdp-service ./node_modules/@twin.org/rights-management-pdp-service/
COPY rights-management/packages/rights-management-pep-service ./node_modules/@twin.org/rights-management-pep-service/
COPY rights-management/packages/rights-management-pip-service ./node_modules/@twin.org/rights-management-pip-service/
COPY rights-management/packages/rights-management-plugins ./node_modules/@twin.org/rights-management-plugins/
COPY rights-management/packages/rights-management-pmp-service ./node_modules/@twin.org/rights-management-pmp-service/
COPY rights-management/packages/rights-management-pnp-service ./node_modules/@twin.org/rights-management-pnp-service/
COPY rights-management/packages/rights-management-pxp-service ./node_modules/@twin.org/rights-management-pxp-service/
COPY rights-management/packages/rights-management-rest-client ./node_modules/@twin.org/rights-management-rest-client/
COPY rights-management/packages/rights-management-service ./node_modules/@twin.org/rights-management-service/
COPY dataspace/packages/dataspace-control-plane-service ./node_modules/@twin.org/dataspace-control-plane-service/
COPY dataspace/packages/dataspace-data-plane-service ./node_modules/@twin.org/dataspace-data-plane-service/
COPY dataspace/packages/dataspace-models ./node_modules/@twin.org/dataspace-models/
COPY dataspace/packages/dataspace-test-app ./node_modules/@twin.org/dataspace-test-app/
COPY standards/packages/standards-dataspace-protocol ./node_modules/@twin.org/standards-dataspace-protocol/
COPY standards/packages/standards-w3c-odrl ./node_modules/@twin.org/standards-w3c-odrl/
# synchronised-storage family — skipTenant flag removal on cross-node routes.
COPY synchronised-storage/packages/synchronised-storage-models ./node_modules/@twin.org/synchronised-storage-models/
COPY synchronised-storage/packages/synchronised-storage-rest-client ./node_modules/@twin.org/synchronised-storage-rest-client/
COPY synchronised-storage/packages/synchronised-storage-service ./node_modules/@twin.org/synchronised-storage-service/
# federated-catalogue family — TICKET-G + HostingService-based tenantToken minting.
COPY federated-catalogue/packages/federated-catalogue-filters ./node_modules/@twin.org/federated-catalogue-filters/
COPY federated-catalogue/packages/federated-catalogue-models ./node_modules/@twin.org/federated-catalogue-models/
COPY federated-catalogue/packages/federated-catalogue-rest-client ./node_modules/@twin.org/federated-catalogue-rest-client/
COPY federated-catalogue/packages/federated-catalogue-service ./node_modules/@twin.org/federated-catalogue-service/
COPY data/packages/data-core ./node_modules/@twin.org/data-core/
# api family — BaseRestClient query-string preservation, HostingService implementation, IHostingComponent types.
COPY api/packages/api-core ./node_modules/@twin.org/api-core/
COPY api/packages/api-models ./node_modules/@twin.org/api-models/
COPY api/packages/api-rest-client ./node_modules/@twin.org/api-rest-client/
COPY api/packages/api-service ./node_modules/@twin.org/api-service/
COPY api/packages/api-tenant-processor ./node_modules/@twin.org/api-tenant-processor/
# engine family — vaultConnectorType injection, factory wiring, HostingService consumer.
# 'engine' itself ships coreTypeInitialisers.json which now includes urlTransformerComponent
# that has no url-transformer in its initialiser list, and PNP/CP/fedcat fail to resolve it.
COPY engine/packages/engine ./node_modules/@twin.org/engine/
COPY engine/packages/engine-core ./node_modules/@twin.org/engine-core/
COPY engine/packages/engine-models ./node_modules/@twin.org/engine-models/
COPY engine/packages/engine-server ./node_modules/@twin.org/engine-server/
COPY engine/packages/engine-server-types ./node_modules/@twin.org/engine-server-types/
COPY engine/packages/engine-types ./node_modules/@twin.org/engine-types/

# Our local engine-types declares deps on @twin.org/automation-* that node's
# node_modules doesn't have (they're installed in engine/node_modules instead).
# Bring them in so the copied engine-types can resolve its imports at runtime.
COPY engine/node_modules/@twin.org/automation-actions ./node_modules/@twin.org/automation-actions/
COPY engine/node_modules/@twin.org/automation-models ./node_modules/@twin.org/automation-models/
COPY engine/node_modules/@twin.org/automation-rest-client ./node_modules/@twin.org/automation-rest-client/
COPY engine/node_modules/@twin.org/automation-service ./node_modules/@twin.org/automation-service/

# The 'node' symlink points to the app itself — create it pointing to /app
RUN ln -s /app ./node_modules/@twin.org/node

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:${TWIN_PORT:-3000}/health || exit 1

EXPOSE 3000 3001 3002 3003

CMD ["node", "src/index.js"]
