FROM node:24.14.0-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl jq && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY node/apps/node/src ./src/
COPY node/apps/node/dist/locales ./dist/locales/
COPY node/apps/node/docs ./docs/
COPY node/apps/node/static ./static/
COPY node/apps/node/package.json ./

# The 4-authority consignment superset served by dataspace-test-app. Referenced
# from env as TWIN_TEST_APP_CONSIGNMENTS="@json:consignments.json", which node-core
# resolves against the execution dir (/app). Each authority publishes a dataset
# scoped to its own `id`; the consumer pulls each via ?id=<id>.
COPY node/apps/node/tests/kenyaCommunityUseCaseDocker/consignments.json ./consignments.json

COPY node/node_modules ./node_modules/

# Resolve local-link symlinks back to published packages, then override with in-flight
# local sources. While TICKETs B/D/E are unmerged, TenantUrlHelper (api-tenant-processor)
# and the vaultConnectorType factory injections (engine-types, engine-server-types) only
# exist in our local sources.
RUN find ./node_modules/@twin.org -maxdepth 1 -name '*.bak' -exec sh -c \
      'pkg="${1%.bak}"; rm -rf "$pkg" && mv "$1" "$pkg"' _ {} \;

# node-core is a workspace package (not published independently); always copy from source.
# Override every in-flight package with local source. HostingService refactor +
# ecosystem-policy removal touches many more packages than the original platform PR.
RUN rm -rf ./node_modules/@twin.org/node-core \
    ./node_modules/@twin.org/api-core \
    ./node_modules/@twin.org/api-models \
    ./node_modules/@twin.org/api-rest-client \
    ./node_modules/@twin.org/api-service \
    ./node_modules/@twin.org/api-tenant-processor \
    ./node_modules/@twin.org/dataspace-control-plane-service \
    ./node_modules/@twin.org/dataspace-data-plane-service \
    ./node_modules/@twin.org/dataspace-models \
    ./node_modules/@twin.org/dataspace-test-app \
    ./node_modules/@twin.org/rights-management-models \
    ./node_modules/@twin.org/rights-management-pap-service \
    ./node_modules/@twin.org/rights-management-pdp-service \
    ./node_modules/@twin.org/rights-management-pep-service \
    ./node_modules/@twin.org/rights-management-pip-service \
    ./node_modules/@twin.org/rights-management-plugins \
    ./node_modules/@twin.org/rights-management-pmp-service \
    ./node_modules/@twin.org/rights-management-pnp-service \
    ./node_modules/@twin.org/rights-management-pxp-service \
    ./node_modules/@twin.org/rights-management-rest-client \
    ./node_modules/@twin.org/rights-management-service \
    ./node_modules/@twin.org/federated-catalogue-filters \
    ./node_modules/@twin.org/federated-catalogue-models \
    ./node_modules/@twin.org/federated-catalogue-rest-client \
    ./node_modules/@twin.org/federated-catalogue-service \
    ./node_modules/@twin.org/engine \
    ./node_modules/@twin.org/engine-core \
    ./node_modules/@twin.org/engine-models \
    ./node_modules/@twin.org/engine-server \
    ./node_modules/@twin.org/engine-server-types \
    ./node_modules/@twin.org/engine-types \
    ./node_modules/@twin.org/synchronised-storage-models \
    ./node_modules/@twin.org/synchronised-storage-rest-client \
    ./node_modules/@twin.org/synchronised-storage-service \
    ./node_modules/@twin.org/trust-models \
    ./node_modules/@twin.org/trust-service \
    ./node_modules/@twin.org/trust-generators \
    ./node_modules/@twin.org/trust-verifiers
COPY node/packages/node-core ./node_modules/@twin.org/node-core/
# Identity stays as the npm-installed version (bulk-copied via node/node_modules) to
# avoid pulling in the full identity + telemetry chain; backwards-compat is what we
# validate here.
COPY trust/packages/trust-models ./node_modules/@twin.org/trust-models/
COPY trust/packages/trust-service ./node_modules/@twin.org/trust-service/
COPY trust/packages/trust-generators ./node_modules/@twin.org/trust-generators/
COPY trust/packages/trust-verifiers ./node_modules/@twin.org/trust-verifiers/
# api family — BaseRestClient query-string preservation, HostingService implementation, IHostingComponent types.
COPY api/packages/api-core ./node_modules/@twin.org/api-core/
COPY api/packages/api-models ./node_modules/@twin.org/api-models/
COPY api/packages/api-rest-client ./node_modules/@twin.org/api-rest-client/
COPY api/packages/api-service ./node_modules/@twin.org/api-service/
COPY api/packages/api-tenant-processor ./node_modules/@twin.org/api-tenant-processor/
# dataspace family — TICKET-D, getDatasetTargets adoption, skipTenant flag removal.
COPY dataspace/packages/dataspace-control-plane-service ./node_modules/@twin.org/dataspace-control-plane-service/
COPY dataspace/packages/dataspace-data-plane-service ./node_modules/@twin.org/dataspace-data-plane-service/
COPY dataspace/packages/dataspace-models ./node_modules/@twin.org/dataspace-models/
COPY dataspace/packages/dataspace-test-app ./node_modules/@twin.org/dataspace-test-app/
# rights-management family — HostingService refactor, ecosystem-policy removal, skipTenant flag removal on PNP routes.
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
# federated-catalogue family — TICKET-G, HostingService-based tenantToken minting.
COPY federated-catalogue/packages/federated-catalogue-filters ./node_modules/@twin.org/federated-catalogue-filters/
COPY federated-catalogue/packages/federated-catalogue-models ./node_modules/@twin.org/federated-catalogue-models/
COPY federated-catalogue/packages/federated-catalogue-rest-client ./node_modules/@twin.org/federated-catalogue-rest-client/
COPY federated-catalogue/packages/federated-catalogue-service ./node_modules/@twin.org/federated-catalogue-service/
# engine family — vaultConnectorType injection, factory wiring, hosting service plumbing.
# 'engine' itself ships coreTypeInitialisers.json which now includes urlTransformerComponent
# that has no url-transformer in its initialiser list, and PNP/CP/fedcat fail to resolve it.
COPY engine/packages/engine ./node_modules/@twin.org/engine/
COPY engine/packages/engine-core ./node_modules/@twin.org/engine-core/
COPY engine/packages/engine-models ./node_modules/@twin.org/engine-models/
COPY engine/packages/engine-server ./node_modules/@twin.org/engine-server/
COPY engine/packages/engine-server-types ./node_modules/@twin.org/engine-server-types/
COPY engine/packages/engine-types ./node_modules/@twin.org/engine-types/
# synchronised-storage family — skipTenant flag removal on cross-node routes.
COPY synchronised-storage/packages/synchronised-storage-models ./node_modules/@twin.org/synchronised-storage-models/
COPY synchronised-storage/packages/synchronised-storage-rest-client ./node_modules/@twin.org/synchronised-storage-rest-client/
COPY synchronised-storage/packages/synchronised-storage-service ./node_modules/@twin.org/synchronised-storage-service/

# Local engine-types declares deps on @twin.org/automation-* that node's node_modules
# doesn't have (they live in engine/node_modules). Bring them in so engine-types can
# resolve its imports at runtime.
COPY engine/node_modules/@twin.org/automation-actions ./node_modules/@twin.org/automation-actions/
COPY engine/node_modules/@twin.org/automation-models ./node_modules/@twin.org/automation-models/
COPY engine/node_modules/@twin.org/automation-rest-client ./node_modules/@twin.org/automation-rest-client/
COPY engine/node_modules/@twin.org/automation-service ./node_modules/@twin.org/automation-service/

# @twin.org/crypto became a runtime dep of dataspace-control-plane-service +
# rights-management-pnp-service (BLAKE2b hashing for tid/composite identifier under
# the node/tenant identifier model). Node's node_modules doesn't ship it directly
# because the node app only depends on node-core; pull from the workspace install.
COPY dataspace/node_modules/@twin.org/crypto ./node_modules/@twin.org/crypto/

# The 'node' symlink points to the app itself.
RUN rm -rf ./node_modules/@twin.org/node && ln -s /app ./node_modules/@twin.org/node

# No HEALTHCHECK: /health is gated by TenantProcessor when TWIN_TENANT_ENABLED=true,
# so a keyless probe always returns 401. The test scripts poll /health directly.

EXPOSE 3000

CMD ["node", "src/index.js"]
