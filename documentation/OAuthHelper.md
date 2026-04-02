# OAuth Helper Resource

The OAuth Helper is a custom helper resource that provides diagnostic operations for inspecting and validating OAuth scope coverage on the connected Zoho credential. These operations do not call any Zoho Cliq API endpoints.

## Operations

| Operation | Description |
| --- | --- |
| Get Granted Scopes | Inspect OAuth scopes currently available to this credential and explain missing-scope failures |
| List Scope Packs | List available scope packs, included scopes, and which scopes are missing on the current token |
| Check Scope Pack | Check whether the current token satisfies one selected scope pack |

## Related Resources

- [AI Agent Tool Field Guide](../AiAgentToolDescriptions/Resources/OAuthHelper/README.md)
- [Credentials Setup Guide](CREDENTIALS.md)
