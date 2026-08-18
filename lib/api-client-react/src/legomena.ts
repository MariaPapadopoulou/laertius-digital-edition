// Entry point for the Legomena (ontology-first) API client.
// Import via "@workspace/api-client-react/legomena" so the primary client's
// exports never collide with these.
export * from "./generated-legomena/legomena";
export * from "./generated-legomena/legomena.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
