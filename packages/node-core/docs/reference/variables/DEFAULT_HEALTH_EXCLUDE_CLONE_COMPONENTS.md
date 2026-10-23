# Variable: DEFAULT\_HEALTH\_EXCLUDE\_CLONE\_COMPONENTS

> `const` **DEFAULT\_HEALTH\_EXCLUDE\_CLONE\_COMPONENTS**: `string`[]

The default component types excluded from the engine clone used by the application health
background task. Each entry is a regular expression matched against the engine config type keys.
None of the components in these groups implement healthApplication, and nothing that does
implement it depends on them, so keeping them out of the clone removes the cost of constructing
and starting them in the health worker.
