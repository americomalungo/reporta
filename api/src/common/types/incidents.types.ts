import { $Enums } from '@/generated/prisma';

export type VoteType = $Enums.VoteType;
export type IncidentStatus = $Enums.IncidentStatus;
export type MediaType = $Enums.MediaType;

/**
 * Cursor tipado usado para percorrer o feed de incidentes.
 */
export type IncidentSearchCursor =
  { k: 'c'; t: string; id: string } | { k: 'd'; d: number; id: string };
