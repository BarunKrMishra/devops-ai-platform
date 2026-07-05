// Shared lightweight types for loosely-shaped API responses used across the UI.

// A connected/available integration record as returned by /api/integrations
// and the various ops/business endpoints.
export type IntegrationItem = {
  id?: number | string;
  type?: string;
  name?: string;
  is_active?: boolean;
  status?: string;
  last_sync?: string;
  configuration?: Record<string, unknown>;
  [key: string]: unknown;
};

// Summary payload returned by /api/integrations/:id/summary.
export type IntegrationSummary = {
  supported?: boolean;
  entities?: Record<string, unknown>;
  [key: string]: unknown;
};

// A pending/approved ops purchase request keyed by module.
export type PurchaseRequest = {
  module_key?: string;
  status?: string;
  [key: string]: unknown;
};

// Generic JSON-ish record for other dynamic payloads.
export type JsonRecord = Record<string, unknown>;
