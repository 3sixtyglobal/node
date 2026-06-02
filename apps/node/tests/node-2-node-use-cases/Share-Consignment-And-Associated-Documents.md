# Share a Consignment and associated documents

## Purpose

An organisation that owns a TWIN Consignment (e.g. an Exporter) needs to share structured Consignment data and associated documents with a supply chain partner (e.g. a Freight Forwarder) so that the partner can reuse trusted up-to-date information via TWIN.

## Actors & Roles

- **Exporter (Consignment Owner / Data Publisher):** Creates and maintains the authoritative TWIN Consignment and related documents; initiates sharing with selected partners.
- **Freight Forwarder (Supply Chain Partner / Data Consumer & Co‑Publisher):** Receives consignment data and documents, uses them to organise transport and regulatory processes, and may add further data or documents (e.g. House B/L, packing lists).
- **TWIN Network / Platform:** Provides the infrastructure and protocols for secure, permissioned sharing of consignment data and documents between participants.

## Data Scope

- **Structured Consignment Data:**
  - Consignment identifiers, parties, locations, goods details.
- **Associated Documents:**
  - Such as the commercial invoice, packing list, certificates, licences, etc.

## Sharing & Visibility Rules

- The Exporter can grant and revoke a Freight Forwarder's access to a specific TWIN Consignment and its associated documents.
- By default, shared Consignment data and documents are only visible to:
  - the Exporter (publisher), and
  - explicitly authorised supply chain partners (e.g. the Freight Forwarder).
- Additional visibility (e.g. to carriers or customs brokers) requires separate, explicit sharing decisions by the current data/document owner or authorised steward.

## Policy Controls

- Access to Consignment data and documents is controlled by explicit, consent‑based permissions managed by the Consignment owner in TWIN.
- Each participant retains control over the data and documents they publish (e.g. a Freight Forwarder controls access to documents it uploads, even when linked to the same consignment).
- All access and sharing actions are logged and auditable, including who accessed which Consignment or document and when, in line with applicable legal and contractual requirements.
