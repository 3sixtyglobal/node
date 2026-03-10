# TWIN Node

This repository provides a core runtime toolkit and executable application for running service workloads through a consistent [Node.js](https://nodejs.org) server model.

Together, the workspace packages and applications define a practical baseline for building, running, and operating service endpoints with clear configuration, deployment, and extension patterns. The focus is on centralising shared runtime behaviour so teams can deliver integrations more predictably across environments while keeping operational concerns maintainable over time.

## Packages

- [node-core](packages/node-core/README.md) - Shared runtime components for hosting service routes with consistent server behaviour.

## Apps

- [node](apps/node/README.md) - Executable server application that assembles the shared runtime for deployment and operations.

## Architecture

- [Codebase](docs/architecture/codebase.md) - Overview of the codebase and how package layers are organised.

## Guides

- [Docker Setup MySQL](docs/guides/docker-setup-mysql.md) - Walkthrough for running a local environment with Docker and MySQL.

## Contributing

To contribute to this repository see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)
