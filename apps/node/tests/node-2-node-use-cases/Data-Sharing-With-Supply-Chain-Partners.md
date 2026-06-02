# Data Sharing with Supply Chain Partners

## Purpose

This use case outlines a scenario where a Freight Forwarder publishes a Goods Load that contains multiple consignments. Each consignment is may contain data relating to different supply chain partners, and the system must ensure that each partner can only view the data and documents directly related to the consignments they are a party to.

## Actors & Roles

- **Freight Forwarder:** The organization responsible for publishing the Goods Load, which includes multiple Consignments.
- **Supply Chain Partner** (e.g., Consignee, Importer, or Exporter): Any legal entity involved in the supply chain that is a party to one or more specific consignments within the Goods Load.

## Data Scope

Anatomy of the Goods Load:

- **Goods load:** Details that are common to all consignments of the load such as a unique ID for the load and the method of transport. These data elements are largely related to the logistics elements of the goods movement and provide a summary of the physical journey. As use of the platform grows we may potentially have goods movements with multiple legs (e.g. an air journey and a road journey).
- **Consignment header:** A consignment is defined as goods that are included in the same customs declaration and therefore have the same Exporter, Consignor, Consignee and Importer. Each shipment must have at least one consignment and there may be multiple consignments in a load (more than 10 consignments per goods load is not unusual). In this use case we are considering a Goods Load that contains multiple Consignments for different organisations.
- **Consignment items:** The individual line items within a consignment, these items share data such as a common description, stock ID or the HS / Commodity Code. Each consignment must have at least one item and typically there are multiple line items with up to 99 goods line items being allowable for a UK customs declaration.

The data in scope includes:

- Goods Load structured data.
- Individual Consignment structured data.
- Attached documents relevant to the Goods Load or specific Consignments.
- Supply Chain events relating to the Goods Load (the goods movement).

## Sharing & Visibility Rules

The Goods Load published by the Freight Forwarder may contain multiple consignments.

Each supply chain partner shall only be able to via or access via API:

- The Consignment details (data and documents) where they are directly associated with (a party to) the specific consignment(s).
- The structured data relating to the Goods Load (e.g. planned route, transport and carrier details).
- The Supply Chain events relating to the Goods Load.

Each supply chain partner shall not be able to see or access via API:

- Data and documents for Consignments where they are not an involved party.
- Documents that are attached to the Goods Load itself (e.g. a packing list).

## Policy Controls

- Access to data and documents within a Goods Load shall be restricted based on explicit party association at the Consignment level and the Goods Load level.
- Data shall only be accessible by the Freight Forwarder (publisher) and the specific supply chain partners identified as parties to individual consignments.
- A robust access control mechanism must be in place to enforce consignment-specific visibility.
