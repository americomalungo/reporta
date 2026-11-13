/** Default request limit per authenticated user or client IP. */
export const RATE_LIMIT_DEFAULT = { limit: 120, ttl: 60_000 } as const;
/** Incident creation limit per ten-minute window. */
export const RATE_LIMIT_INCIDENT_CREATE = { limit: 10, ttl: 600_000 } as const;
/** Photo upload limit per ten-minute window. */
export const RATE_LIMIT_PHOTO_UPLOAD = { limit: 20, ttl: 600_000 } as const;
/** Comment creation limit per minute. */
export const RATE_LIMIT_COMMENTS = { limit: 30, ttl: 60_000 } as const;
/** Vote submission limit per minute. */
export const RATE_LIMIT_VOTES = { limit: 60, ttl: 60_000 } as const;
/** Administrative endpoint limit per minute. */
export const RATE_LIMIT_ADMIN = { limit: 60, ttl: 60_000 } as const;
