# TWIN Node

This repository provides a core runtime toolkit and executable application for running service workloads through a consistent [Node.js](https://nodejs.org) server model.

Together, the workspace packages and applications define a practical baseline for building, running, and operating service endpoints with clear configuration, deployment, and extension patterns. The focus is on centralising shared runtime behaviour so teams can deliver integrations more predictably across environments while keeping operational concerns maintainable over time.

## Packages

- [node-core](packages/node-core/README.md) - Shared runtime components for hosting service routes with consistent server behaviour.

## Apps

- [node](apps/node/README.md) - Executable server application that assembles the shared runtime for deployment and operations.

## Architecture

- [Node Runtime](docs/architecture/node.mdx) - How the executable runtime builds configuration, starts services, and handles extensions.
- [Node Environment Variables](docs/architecture/node-env-variables.mdx) - Runtime configuration surface for connectors, features, servers, and providers.
- [Node Extensions](docs/architecture/node-extensions.mdx) - Extension loading protocols, lifecycle timing, and operational controls.

## Guides

- [Docker Setup MySQL](docs/guides/node-docker-setup-mysql.md) - Walkthrough for running a local environment with Docker and MySQL.

## Contributing

To contribute to this repository see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)
