# Share a single document with a supply chain partner

## Purpose

An organisation using TWIN needs to share one or more documents with a specific supply chain partner so that the partner can use these documents to perform logistics, regulatory, or commercial activities. The documents may be unstructured (e.g. PDF or image) or structured (e.g. JSON or XML) and are not linked to a specific TWIN Consignment or Goods Load.

## Actors & Roles

- **Document Publisher** (e.g. Exporter, Freight Forwarder, Carrier, Customs Broker): Holds and publishes the original document(s) into TWIN and initiates sharing with one or more partners.
- **Document Consumer** (e.g. Freight Forwarder, Carrier, Importer, Customs Broker, Authority): Receives access to the shared document(s) and uses them for planning, execution, compliance, or verification and may include adding the document to a Consignment or Goods Load.
- **TWIN application:** Provides secure storage, referencing, and permissioned access to both structured and unstructured documents.

## Data Scope

In scope for this use case are:

- **Unstructured documents:** e.g. PDFs, scanned copies, images.
- **Structured documents:** e.g. XML or JSON formats.
- **Document metadata:** publisher, type, creation time, format, and version.

No additional consignment or event data is required beyond what is referenced in the document or its metadata.

## Sharing & Visibility Rules

- The Document Publisher explicitly selects which document(s) to share and with which partner(s).
- By default, a document is visible only to:
  - its publisher, and
  - the partner(s) for whom access has been explicitly granted.
- Sharing does not automatically expose the document to other supply chain participants (e.g. carriers, authorities) unless they are separately granted access.
- Where a document is linked to a TWIN entity (e.g. a Consignment), this does not imply that all data in that entity becomes visible to the document recipient.

## Policy Controls

- Access is governed by explicit, consent‑based permissions set by the Document Publisher within TWIN.
- Each organisation retains control over re‑sharing: partners may not extend visibility to third parties unless permitted by the publisher's policy or an agreed delegation.
- All document access and sharing actions are logged and auditable, including who accessed which document and when, in line with contractual and regulatory requirements.
