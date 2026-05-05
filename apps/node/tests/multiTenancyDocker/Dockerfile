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
# local sources. The previous comment "all fixes are now in published versions" is no
# longer true while TICKETs B/D/E are unmerged — TenantUrlHelper export
# (api-tenant-processor) and the vaultConnectorType factory injections
# (engine-types, engine-server-types) only exist in our local sources.
RUN find ./node_modules/@twin.org -maxdepth 1 -name '*.bak' -exec sh -c \
      'pkg="${1%.bak}"; rm -rf "$pkg" && mv "$1" "$pkg"' _ {} \;

# node-core is a workspace package (not published independently of the workspace) — copy from source.
# rights-management family is fully overridden because intra-family API drift between published .bak
# versions and our locally-updated rights-management-models would otherwise cause runtime import errors
# (e.g., rights-management-pap-service @ .bak importing RightsManagementPolicyType from a newer models
# that no longer exports it). Mobius Dockerfile uses the same full-family override pattern.
RUN rm -rf ./node_modules/@twin.org/node-core \
    ./node_modules/@twin.org/api-tenant-processor \
    ./node_modules/@twin.org/dataspace-control-plane-service \
    ./node_modules/@twin.org/rights-management-models \
    ./node_modules/@twin.org/rights-management-dap-service \
    ./node_modules/@twin.org/rights-management-pap-service \
    ./node_modules/@twin.org/rights-management-pap-entity-storage \
    ./node_modules/@twin.org/rights-management-pdp-service \
    ./node_modules/@twin.org/rights-management-pep-service \
    ./node_modules/@twin.org/rights-management-pip-service \
    ./node_modules/@twin.org/rights-management-pmp-service \
    ./node_modules/@twin.org/rights-management-pnp-service \
    ./node_modules/@twin.org/rights-management-pxp-service \
    ./node_modules/@twin.org/rights-management-plugins \
    ./node_modules/@twin.org/rights-management-rest-client \
    ./node_modules/@twin.org/rights-management-service \
    ./node_modules/@twin.org/engine-types \
    ./node_modules/@twin.org/engine-server-types
COPY node/packages/node-core ./node_modules/@twin.org/node-core/
COPY api/packages/api-tenant-processor ./node_modules/@twin.org/api-tenant-processor/
COPY dataspace/packages/dataspace-control-plane-service ./node_modules/@twin.org/dataspace-control-plane-service/
COPY rights-management/packages/rights-management-models ./node_modules/@twin.org/rights-management-models/
COPY rights-management/packages/rights-management-dap-service ./node_modules/@twin.org/rights-management-dap-service/
COPY rights-management/packages/rights-management-pap-service ./node_modules/@twin.org/rights-management-pap-service/
COPY rights-management/packages/rights-management-pap-entity-storage ./node_modules/@twin.org/rights-management-pap-entity-storage/
COPY rights-management/packages/rights-management-pdp-service ./node_modules/@twin.org/rights-management-pdp-service/
COPY rights-management/packages/rights-management-pep-service ./node_modules/@twin.org/rights-management-pep-service/
COPY rights-management/packages/rights-management-pip-service ./node_modules/@twin.org/rights-management-pip-service/
COPY rights-management/packages/rights-management-pmp-service ./node_modules/@twin.org/rights-management-pmp-service/
COPY rights-management/packages/rights-management-pnp-service ./node_modules/@twin.org/rights-management-pnp-service/
COPY rights-management/packages/rights-management-pxp-service ./node_modules/@twin.org/rights-management-pxp-service/
COPY rights-management/packages/rights-management-plugins ./node_modules/@twin.org/rights-management-plugins/
COPY rights-management/packages/rights-management-rest-client ./node_modules/@twin.org/rights-management-rest-client/
COPY rights-management/packages/rights-management-service ./node_modules/@twin.org/rights-management-service/
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
