# Freight Forwarders → Government Border Agencies / Port Operators data sharing

## Purpose

This page describes the data sharing requirements for scenarios where Freight Forwarders publish data to TWIN that Government Border Agencies / Port Operators consume securely, with strict isolation between publishers.

## Actors & Roles

The following types of organisation are involved in this process:

- Freight Forwarders (Publishers)
- Government Border Agencies (Consumers): Customs, Port Health, etc.
- Port / Location Operators (Consumers): Ports, airports, rail terminals, etc.

## Data Scope

This use case is based on providing the ability to share:

- Documents via API, where those documents are attached to a Goods Load.
- Visibility of the goods load, events and attached documents via the UI.

## Sharing & Visibility Rules

- Privacy requirement: Data and documents published by a Freight Forwarder must never be visible to other Freight Forwarders, unless explicitly authorised for that organisation.
- Publisher → Government Border Agencies: Freight Forwarders shall be able to share data with all Government Border Agencies in a particular jurisdiction.
- Publisher → Port/Location Operators: Freight Forwarders shall be able to share data with all location operators in a particular jurisdiction.
- Consolidated data consumption: Government Border Agencies and Location Operators shall be able to access data that has been shared by multiple publishers. This shall apply to data viewed in the UI and data that is accessed via API.

## Policy Controls

- Data shall only be accessible by the publisher of that data or where explicit permission has been granted.
- Data sharing permissions for location operators and border agencies shall be based on the system role that the organisation holds, e.g.
  - UK Government Border Agency
  - UK Location of Entry / Exit Operator
