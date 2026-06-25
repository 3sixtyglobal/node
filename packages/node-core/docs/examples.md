# Node Core Examples

These snippets show practical runtime setup patterns, state inspection, and controlled shutdown so you can move from local development to automation with predictable behaviour.

## Engine

```typescript
import { run } from '@twin.org/node-core';

const runtime = await run(
  {
    disableProcessExitOnFailure: true,
    envVars: {
      TWIN_HOST: '127.0.0.1',
      TWIN_PORT: '8080',
      TWIN_STORAGE_FILE_ROOT: './storage',
      TWIN_STATE_FILENAME: 'engine-state.json'
    }
  },
  ['node', 'index.js']
);

if (runtime) {
  const state = runtime.engine.getState();
  console.log(typeof state); // object
  console.log(state.nodeId ?? 'not-configured'); // not-configured
  await runtime.shutdown();
}
```

```typescript
import { run } from '@twin.org/node-core';

const runtime = await run(
  {
    disableProcessExitOnFailure: true,
    envVars: {
      TWIN_HOST: '127.0.0.1',
      TWIN_PORT: '8081',
      TWIN_STORAGE_FILE_ROOT: './storage',
      TWIN_STATE_FILENAME: 'engine-state.json'
    }
  },
  ['node', 'index.js']
);

if (runtime) {
  await runtime.engine.logInfo('Startup validation completed');
  const state = runtime.engine.getState();
  console.log(Object.keys(state).length >= 0); // true
  await runtime.shutdown();
}
```

## EngineServer

```typescript
import type { IServerInfo } from '@twin.org/api-models';
import type { INodeOptions } from '@twin.org/node-core';
import { buildConfiguration, start } from '@twin.org/node-core';

const processEnv: Record<string, string> = {
  TWIN_HOST: '127.0.0.1',
  TWIN_PORT: '8082',
  TWIN_STORAGE_FILE_ROOT: './storage',
  TWIN_STATE_FILENAME: 'engine-state.json'
};

const options: INodeOptions = {
  disableProcessExitOnFailure: true,
  envPrefix: 'TWIN_',
  executionDirectory: process.cwd(),
  scriptDirectory: process.cwd()
};

const serverInfo: IServerInfo = {
  name: 'Local Runtime',
  version: '0.0.0-dev'
};

const { nodeEngineConfig, nodeEnvVars, availableContextIdKeys } = await buildConfiguration(
  processEnv,
  options,
  serverInfo
);

const runtime = await start(
  options,
  nodeEngineConfig,
  nodeEnvVars,
  undefined,
  availableContextIdKeys
);

if (runtime) {
  console.log(typeof runtime.server.stop); // function
  await runtime.server.stop();
}
```
