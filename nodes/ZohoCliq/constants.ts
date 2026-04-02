export const NODE_DESCRIPTION =
	'Fully manage your Zoho Cliq workspace — messages, channels, teams, users, databases, events, reminders, bots, files, and more';

/**
 * n8n subtitle expression template rendered in the workflow editor.
 * Normalizes legacy customEmail operation aliases, applies display overrides
 * for resource names that don't format cleanly from camelCase (e.g., oauthHelper
 * -> "OAuth Helper"), and formats remaining values into readable Title Case labels.
 */
export const SUBTITLE_EXPRESSION =
	'={{ ((operation, resource) => { const overrides = { oauthHelper: "OAuth Helper" }; const normalizedOperation = (operation === "verifyCustomEmail" || operation === "getOrganizationEmailConfiguration") ? "getOrganizationEmailConfiguration" : ((operation === "updateMailConfiguration" || operation === "addCustomEmail" || operation === "updateOrganizationEmailConfiguration") ? "updateOrganizationEmailConfiguration" : operation); const formatLabel = (value) => String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\\s+/g, " ").trim().replace(/\\b\\w/g, (char) => char.toUpperCase()); return (overrides[normalizedOperation] || formatLabel(normalizedOperation)) + ": " + (overrides[resource] || formatLabel(resource)); })($parameter["operation"], $parameter["resource"]) }}';
