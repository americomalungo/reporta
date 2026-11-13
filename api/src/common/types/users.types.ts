import { $Enums } from '@/generated/prisma';

export type UserRole = $Enums.UserRole;
export type AccountStatus = $Enums.AccountStatus;

/** Stable cursor for listing users by creation timestamp and identifier. */
export interface UserListCursor {
  /** Data de criação usada como primeira parte do cursor estável. */
  createdAt: Date;
  /** Identificador usado para desempatar datas iguais. */
  id: string;
}

/** Dados de perfil necessários para criar uma conta na aplicação. */
export interface CreateUserData {
  /** Nome público do utilizador. */
  name: string;
  /** Identificador Firebase associado à conta. */
  firebaseUid: string;
  /** Endereço de email da conta. */
  email: string;
  /** Telefone opcional do utilizador. */
  phone?: string;
  /** URL opcional do avatar. */
  avatarUrl?: string;
  /** Indica se o utilizador pretende receber alertas. */
  alertsEnabled?: boolean;
  /** Raio de alertas configurado em metros. */
  alertRadiusM?: number;
}

/** Campos de perfil que podem ser atualizados pelo utilizador. */
export interface UpdateUserData {
  /** Novo nome público, quando enviado. */
  name?: string;
  /** Novo URL do avatar ou null para o remover. */
  avatarUrl?: string | null;
  /** Novo telefone ou null para o remover. */
  phone?: string | null;
  /** Nova preferência de alertas. */
  alertsEnabled?: boolean;
  /** Novo raio de alertas em metros. */
  alertRadiusM?: number;
}

/** Dados de auditoria para a remoção lógica de uma conta. */
export interface SoftDeleteUserOptions {
  /** Identificador do utilizador que executou a remoção. */
  actorId: string;
  /** Motivo opcional registado no histórico. */
  reason?: string;
}

/** Localização conhecida do utilizador em coordenadas geográficas. */
export interface UserLocation {
  /** Latitude em graus decimais. */
  latitude: number;
  /** Longitude em graus decimais. */
  longitude: number;
}
