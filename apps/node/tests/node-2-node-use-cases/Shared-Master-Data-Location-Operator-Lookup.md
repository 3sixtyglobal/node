# Shared master data: Location Operator lookup

## Purpose

TWIN need to resolve the location operator (name and identity) for a given UN/LOCODE so that application functions can act on this data. The use case covers a global shared master data lookup where an application uses only a UN/LOCODE to retrieve the authoritative operator identity for that location.

## Actors & Roles

- **TWIN Application (Data Consumer):** Uses a UN/LOCODE to request the associated location operator and embeds the returned identity in downstream processes (e.g. sending a notification to the relevant location operator).
- **Location Operator:** Is identified in the master data and its association with one or more UN/LOCODEs (e.g. port authority, terminal operator, depot, airport).
- **Global Master Data / Discovery Service:** Stores or indexes operator data and exposes a lookup interface so that UN/LOCODE → operator identity can be resolved in a standardised way across TWIN.

## Data Scope

- **Lookup Key:** UN/LOCODE (e.g. "NLRTM"), optionally with sub‑location qualifiers.
- **Returned Data:**
  - Operator name and trade name.
  - Globally unique operator identifier(s) as per TWIN.
  - Validity of the operator–location association (start/end dates).

## Sharing & Visibility Rules

- The fact that a UN/LOCODE is associated with an operator is discoverable by authorised TWIN processes (regardless of being in a different tenant or node).
- Responses return the minimum set of identity attributes required for unambiguous reference; richer details may require additional authorization.
- The same UN/LOCODE, under equivalent conditions, must resolve to a consistent operator identifier across all participants.

## Policy Controls

- Basic UN/LOCODE → operator identity lookup is available under agreed governance rules.
- Only authorised stewards (currently the IOTA administrator) may create or update operator records and their UN/LOCODE mappings.
- All changes and lookups are logged for audit; deprecated operator–location links are clearly marked and must not be used for new transactions.
