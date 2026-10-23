// Payment implementation is retained. Reactivating also requires the server gates.
export const PAYMENTS_ENABLED = import.meta.env.VITE_PAYMENTS_ENABLED === "true";

// The legacy service catalogue is independent of recommendation checkout.
export const SERVICE_CATALOG_ENABLED = import.meta.env.VITE_SERVICE_CATALOG_ENABLED === "true";
