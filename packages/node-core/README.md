# TWIN Node Core

Core components for running TWIN nodes with dynamic extension loading and protocol-based module resolution.

## Installation

```shell
npm install @twin.org/node-core
```

## Quick Start

```javascript
import { start } from '@twin.org/node-core';

// Start a TWIN node
await start({
  extensions: ['./my-extension.mjs']
});
```

## Key Features

- **Protocol-based extension loading** - Load from local files, npm packages, or HTTPS URLs
- **Dynamic module resolution** - Automatic installation and caching
- **Extension lifecycle hooks** - Customize node behavior at different stages
- **Security controls** - Size limits, HTTPS-only, and cache TTL

## Documentation

For detailed documentation, configuration options, and examples, see [docs/detailed-guide.md](docs/detailed-guide.md).

## License

Apache-2.0
