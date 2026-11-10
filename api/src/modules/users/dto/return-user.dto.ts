export class ReturnUserDto {
  id: string | undefined;
  name: string | undefined;
  role: string | null | undefined;
  email: string;
  phone: string | undefined;
  alertsEnabled: boolean | undefined;
  avatarUrl: string | undefined;
  alertRadiusM?: number | null | undefined;
}
