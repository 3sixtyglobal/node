# Kenya Supply Chain Use Cases

## Overview

The Kenya supply chain system connects multiple government agencies and traders. The KRA (Kenya Revenue Authority) is the primary producer of consignment data. Other agencies — KPA, KENTRADE, and AFA — enrich consignments with supporting documents. Traders with a matching KRA PIN can view the shared consignment and its associated documents.

```text
                    Creates consignment
                    (pre-notification)
                          |
                          v
                    +-----------+
                    |    KRA    |  <-- Producer
                    +-----------+
                          |
            PIN: "DIMA" assigned to consignment
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
     +---------+    +-----------+    +---------+
     |   KPA   |    | KENTRADE  |    |   AFA   |  <-- Document providers
     +---------+    +-----------+    +---------+
     Port docs      Trade/customs    Inspection
     & clearance    documents        certificates
          |               |               |
          +---------------+---------------+
                          |
                   Documents attached
                   to consignment
                          |
                          v
                    +-----------+
                    |  Trader   |  <-- Consumer (PIN: "DIMA")
                    +-----------+
                    Views shared
                    consignment +
                    all documents
```

## Agencies and Their Roles

### KRA — Kenya Revenue Authority (Producer)

**Role:** The primary producer of consignment data. KRA creates consignments in their tenant with trader-specific customs and tax data.

**Data provided:**

- Export Declaration
- Certificate of Export
- Import Declaration
- Commercial Invoice
- KRA PIN of the associated trader (e.g. "DIMA")

**Adaptor:** KRA Adaptor

- Receives consignment data from KRA's system
- Transforms into UNECE-compliant format
- Triggers `Activity.Create` on the Data Space Connector
- The DSC app creates the consignment and publishes to the Federated Catalogue

### KPA — Kenya Ports Authority (Document Provider)

**Role:** Provides port-related documents and clearance data for consignments. KPA does not create consignments — they add documents to existing consignments created by KRA based on a unique identifier.

**Data provided:**

- Import data

**Adaptor:** KPA adaptor (integration point for port documentation)

### KENTRADE — Kenya Trade Network Agency (Document Provider)

**Role:** Operates the national single window system for trade facilitation. KENTRADE provides trade and customs documentation for consignments — they add documents to existing consignments created by KRA based on a unique identifier.

**Data provided:**

- Export Declaration
- Export Certificate
- Consignment Details
- Import/export permits

**Adaptor:** KENTRADE adaptor (integration point for trade documentation)

### AFA — Agriculture and Food Authority (Document Provider)

**Role:** Provides inspection and compliance certificates for agricultural and food products. AFA is involved when the consignment contains goods that require phytosanitary or food safety certification. They also add documents to existing consignments created by KRA based on a unique identifier.

**Data provided:**

- Phytosanitary certificates

**Interaction:** AFA adds inspection certificates and compliance documents to consignments that contain agricultural or food products.

## Consignment Sharing Flow

### Step 1: KRA Creates Consignment

KRA creates a consignment via the KRA adaptor with an actor PIN identifying the trader:

```text
KRA Adaptor → POST /data-space-connector/notify
  → Activity.Create with consignment data
  → Actor: { registeredId: "DIMA" }  ← trader's KRA PIN
```

The DSC app:

- Creates the consignment in KRA's tenant storage
- Publishes a dataset to the Federated Catalogue with an ODRL offer containing the PIN constraint
- Registers the offer in the PAP (Policy Administration Point)

### Step 2: Agencies Add Documents

KPA, KENTRADE, and AFA add documents to the consignment as they become available:

Each agency adds their specific documents independently. The consignment accumulates documents over its lifecycle.

### Step 3: Trader Pulls Shared Consignment

A trader with KRA PIN "DIMA" sets their PIN and fetches consignment overviews:

The trader sees the consignment along with all documents attached by KRA, KPA, KENTRADE, and AFA.

## Adaptor Architecture

```text
External Systems                    Supply Chain Node
                                    (Multi-tenant)
+------------------+
|       KRA        | -----> KRA Adaptor -------> DSC App -----> KRA Tenant
+------------------+                                              |
                                                           Creates consignment
                                                           Publishes to catalogue
+------------------+
|      KPA         | -----> KPA Adaptor --------> DSC App -----> KPA Tenant
+------------------+                                              |
                                                           Adds port documents
                                                           to KRA's consignment
+------------------+
|    KENTRADE      | -----> KENTRADE Adaptor ----> DSC App -----> KENTRADE Tenant
+------------------+                                              |
                                                           Adds trade documents
                                                           to KRA's consignment
+------------------+
|      AFA         | -----> AFA Adaptor ---------> DSC App -----> AFA Tenant
+------------------+                                              |
                                                           Adds inspection docs
                                                           to KRA's consignment
                           Federated Catalogue
                           +------------------+
                           | Dataset: consignment |
                           | Offer: PIN "DIMA"    |
                           +------------------+
                                    |
                                    | PIN match
                                    v
                           +------------------+
                           |  Trader Tenant   |
                           |  (PIN: "DIMA")   |
                           |  Pulls overview  |
                           +------------------+
```

## PIN-Based Access Control

The KRA PIN is the key identifier that connects producers and consumers:

- KRA creates a consignment with `actor.registeredId = "DIMA"` (the trader's KRA PIN)
- The catalogue publishes an ODRL offer with constraint `registeredId eq "DIMA"`
- The trader sets their organization PIN to "DIMA" via `setOrganizationPin()`

This ensures that only the trader associated with a consignment can view it. Each trader sees only consignments where their KRA PIN matches the actor's registered ID.

## Why Same-Node Multi-Tenancy Matters

These organizations operate within a single jurisdiction and share a single community node. They are not separate nodes communicating over the internet — they are separate tenants on one node. This is by design:

- Simpler infrastructure (one deployment, one set of credentials)
- All organizations are within the Kenya trade ecosystem
- Data stays in-country
- Each organization still has full tenant isolation for their own data

## Where DSP Protocol Hits Tenant Boundaries

The DSP protocol assumes consumer and provider are on separate nodes with separate storage. On the same node with multi-tenancy:

- KRA's consignment data lives in KRA's tenant partition
- The trader's negotiation lives in the trader's tenant partition
- DSP callback routes use skipTenant (no API key = no tenant context)
- Every storage lookup crosses a tenant boundary

## Open Questions for Core Team

### Cross-tenant document contribution

KRA creates the consignment in their tenant. KPA, KENTRADE, and AFA each operate in their own tenant but need to add documents to KRA's consignment.

- How do agencies discover and access KRA's consignment from their own tenant? Do they pull the shared consignment via the catalogue, or is there a different mechanism to reference a consignment across tenants?
- How do agencies in their own tenant add documents to a consignment owned by KRA's tenant? The current DSP protocol doesn't support cross-tenant write operations for same-node tenants.
- Where do the documents live? Should all documents end up on KRA's consignment (single source of truth), or can they be stored in each agency's tenant separately?
- When the trader pulls the shared consignment, they should see all documents from all agencies in a single view? How will this data remain in sync?
