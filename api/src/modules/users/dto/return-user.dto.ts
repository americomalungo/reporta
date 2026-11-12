export class ReturnUserDto {
  /** Pontuação de reputação do utilizador. */
  reputationScore: number;
  id: string | undefined;
  name: string | undefined;
  role: string | null | undefined;
  email: string;
  phone: string | undefined;
  alertsEnabled: boolean | undefined;
  avatarUrl: string | undefined;
  alertRadiusM?: number | null | undefined;
}
