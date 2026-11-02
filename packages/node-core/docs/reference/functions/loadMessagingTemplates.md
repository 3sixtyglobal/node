# Function: loadMessagingTemplates()

> **loadMessagingTemplates**(`directory`): `Promise`\<[`IMessagingTemplate`](../interfaces/IMessagingTemplate.md)[]\>

Load the messaging templates from a directory, &lt;template-id&gt;.html for the default locale and
&lt;template-id&gt;.&lt;locale&gt;.html for a locale, the title is taken from the title element.

## Parameters

### directory

`string`

The directory holding the templates.

## Returns

`Promise`\<[`IMessagingTemplate`](../interfaces/IMessagingTemplate.md)[]\>

The templates.

## Throws

GeneralError when a template has no title.
