import type { VoteType as VoteTypeEnum } from '@/src/common/types/incidents.types';

export class ReturnIncidentDto {
  id: string;
  authorId: string;
  categoryId: string;
  title: string;
  description: string;
  address: string | null;
  status: string;
  expiresAt: Date;
  confirmCount: number;
  disconfirmCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  latitude: number;
  longitude: number;
  myVote: VoteTypeEnum | null;
}
