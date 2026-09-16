# Variable: DEFAULT\_TRACING\_FACADE\_COMPONENT\_EXCLUDE\_TYPES

> `const` **DEFAULT\_TRACING\_FACADE\_COMPONENT\_EXCLUDE\_TYPES**: `string`[]

The instance types the tracing facade is never applied to in the component factory, matched as
regular expressions anywhere in the type name. The facade resolves the tracing and logging
components while recording a span, so wrapping those results in an endless call chain. The
remaining patterns cover the high volume infrastructure services whose spans carry little value.
