# Interface: INodeEngineState

The engine state for the node.

## Extends

- `IEngineState`

## Properties

### nodeId? {#nodeid}

> `optional` **nodeId?**: `string`

The identity for the node.

***

### nodeOrganizationId? {#nodeorganizationid}

> `optional` **nodeOrganizationId?**: `string`

This is the default organization used in the context ids when a user is not authenticated.
It is not used in multi-tenant mode, which gets the organization from the tenant table.
