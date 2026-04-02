# Message Component Builder Resource

The Message Component Builder is a custom helper resource that runs locally within the node. These operations generate valid Zoho Cliq message payload structures without making any API calls, allowing you to build and validate rich message objects before sending them.

## Operations

| Operation | Description |
| --- | --- |
| Build Card Payload | Build a reusable rich card payload |
| Agent Card Payload Builder | Build a validated rich message payload object for AI-agent workflows |
| Build/Fire ACK Message | Build an immediate loading-state ACK payload and optionally send it to a bot with sync_message forced on |
| Build Buttons | Build one or more button objects |
| Build Components | Build one or more component objects |
| Build Table Component | Build a single table component object |
| Build Chart Component | Build a single chart component object |
| Build Graph Component | Build a single graph component object |
| Build Image Component | Build a single image component object |
| Build Label Component | Build a single label component object |
| Build List Component | Build a single list component object |

All operations in this resource are local builders. They output JSON objects that can be passed into message-sending operations in the Message, Channel, Chat, Bot, or Thread resources.

## Related Resources

- [AI Agent Tool Field Guide](../AiAgentToolDescriptions/Resources/MessageComponentBuilder/README.md)
