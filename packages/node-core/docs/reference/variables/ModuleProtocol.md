# Variable: ModuleProtocol

> `const` **ModuleProtocol**: `object`

The protocol types for modules.

## Type Declaration

### Local {#local}

> `readonly` **Local**: `"local"` = `"local"`

Local module (starts with . or / or file://).

### Npm {#npm}

> `readonly` **Npm**: `"npm"` = `"npm"`

NPM package (starts with npm:).

### Https {#https}

> `readonly` **Https**: `"https"` = `"https"`

HTTPS URL (starts with https://).

### Http {#http}

> `readonly` **Http**: `"http"` = `"http"`

HTTP URL (starts with http://).

### Default {#default}

> `readonly` **Default**: `"default"` = `"default"`

Default/standard module resolution.
