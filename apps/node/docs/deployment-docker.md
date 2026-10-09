# Node Deployment Docker

The 3Sixty Node can be run as a Docker container, either from the published image or from an image you build yourself.

## Published Image

Images are published to GitHub Packages as [ghcr.io/3sixtyglobal/node](https://github.com/3sixtyglobal/node/pkgs/container/3sixty-node) for `linux/amd64` and `linux/arm64`, with the following tags:

| Tag       | Description                                      |
| --------- | ------------------------------------------------ |
| `latest`  | The most recent production release.              |
| `next`    | The most recent prerelease.                      |
| `<x.y.z>` | A specific version, for example `0.10.1-next.6`. |

```shell
docker pull ghcr.io/3sixtyglobal/node:latest
```

## Building the Image

The dockerfile is in `apps/node/deploy/dockerfile`. It builds `@3sixty/node-core` from the repository source and packs it, then installs that package and the other dependencies with pnpm, merges the translation messages, and removes the development dependencies. The repository root forms the build context, and `apps/node/deploy/dockerfile.dockerignore` keeps your local `node_modules`, build output and `.env` files out of the image.

Build the image from the repository root:

```shell
docker build -t 3sixty-node -f apps/node/deploy/dockerfile . --load
```

> **Note**: The `--load` flag is required when using Docker Buildx to ensure the image is loaded into your local Docker registry. Without it, the image will only exist in the build cache.

To build for both of the published platforms use a Buildx builder with the `docker-container` driver:

```shell
docker buildx create --name 3sixty-multiplatform-builder --driver docker-container --use
docker buildx build --platform linux/amd64,linux/arm64 -t 3sixty-node -f apps/node/deploy/dockerfile .
```

The examples below use the locally built `3sixty-node` image, replace it with `ghcr.io/3sixtyglobal/node:<tag>` to use the published image.

## Configuration

The node reads its configuration from `/app/.env` in the container, and from environment variables, which take precedence over the file. The image does not contain a `.env`, so start from one of the example configurations described in [Node Configuration](./configuration.md) and mount it into the container:

```shell
-v /home/twin-node/.env:/app/.env:ro
```

Mount the file rather than passing it with `--env-file`. Docker does not remove the quotes around values in an env file, so the quoted values used in the example configurations would be read incorrectly.

The image sets the following environment variables, which override the same settings in `/app/.env`:

| Variable                 | Value             | Description                                    |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `TWIN_HOST`              | `0.0.0.0`         | Listen on all interfaces inside the container. |
| `TWIN_PORT`              | `3000`            | The port the API server listens on.            |
| `TWIN_STORAGE_FILE_ROOT` | `/twin-node/data` | The root directory for `file` storage.         |

Change any of them with `-e`, for example `-e TWIN_PORT=8080`.

## Data Persistence

When storage is configured to use the `file` connector, its data and the engine state in `engine-state.json` are written to `/twin-node/data`. Mount a volume or a host directory there so that the data is kept when the container is replaced:

```shell
-v /home/twin-node/data:/twin-node/data
```

The same data directory must be mounted for the bootstrap commands and for the running node.

## Bootstrapping

The node will not start until it has been bootstrapped. A container started without a node identity stops with:

```shell
The node identity is enabled in config but is not set, please set it using the "node-identity-set" CLI command.
```

The CLI commands run from the same image by passing the command after `node src/index.js`, with the same configuration and data directory that the node will use. For a development node the [bootstrap-dev](./commands/bootstrap-dev.md) command creates the node identity, organisation identity and admin user in a single step:

```shell
docker run --rm \
  -v /home/twin-node/.env:/app/.env:ro \
  -v /home/twin-node/.env.bootstrap-dev:/app/.env.bootstrap-dev:ro \
  -v /home/twin-node/data:/twin-node/data \
  3sixty-node node src/index.js bootstrap-dev --load-env=.env.bootstrap-dev
```

The values it reads are described in [bootstrap-dev](./commands/bootstrap-dev.md), and `.env.example-bootstrap-dev` is a starting point for the file. Any value that is not provided is generated. Generated mnemonics and passwords are only shown in the command output, so record them.

To bootstrap a production node step by step, or to manage identities, tenants and users later, run the relevant commands from [Node Usage](./usage.md) in the same way. Use `help` to list the commands available in the image:

```shell
docker run --rm 3sixty-node node src/index.js help
```

## Running the Node

Once bootstrapped, start the node with the same configuration and data directory:

```shell
docker run -d --name 3sixty-node \
  -v /home/twin-node/.env:/app/.env:ro \
  -v /home/twin-node/data:/twin-node/data \
  -p 3000:3000 \
  3sixty-node
```

Follow the output with `docker logs -f 3sixty-node`. When the node is ready you should see:

```shell
INFO [2026-09-24T04:57:23.320Z] EngineCore Engine has started
INFO [2026-09-24T04:57:23.346Z] FastifyWebServer Building Web Server
INFO [2026-09-24T04:57:23.384Z] FastifyWebServer Starting Web Server with binding "0.0.0.0" on port "3000"
INFO [2026-09-24T04:57:23.392Z] FastifyWebServer The Web Server started on http://127.0.0.1:3000
```

You should now be able to access the server in the browser at [http://localhost:3000/info](http://localhost:3000/info), which returns something similar to:

```json
{
  "name": "3Sixty Node",
  "version": "0.10.1-next.6"
}
```

The request and response are also shown in the logs:

```shell
INFO [2026-09-24T04:57:25.150Z] LoggingProcessor ===> GET /info {}
INFO [2026-09-24T04:57:25.150Z] LoggingProcessor <=== 200 GET /info duration: 722µs {"body":{"name":"3Sixty Node","version":"0.10.1-next.6"}}
```

## Stopping the Node

The node responds to the standard termination signals, so `docker stop 3sixty-node` stops the components gracefully before the container exits:

```shell
INFO [2026-09-24T05:00:09.380Z] EngineCore Components have stopped
INFO [2026-09-24T05:00:09.380Z] EngineCore Engine has stopped
```

Starting the container again with `docker start 3sixty-node` reuses the existing engine state, so the bootstrap does not need to be repeated.
