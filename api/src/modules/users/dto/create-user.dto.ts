import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  /**
   * Nome apresentado no perfil.
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * URL opcional do avatar.
   */
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  /**
   * Número de telefone opcional.
   */
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  /**
   * Latitude da última localização, quando fornecida.
   */
  @ValidateIf((user: CreateUserDto) => user.lastLongitude !== undefined)
  @IsLatitude()
  lastLatitude?: number;

  /**
   * Longitude da última localização, quando fornecida.
   */
  @ValidateIf((user: CreateUserDto) => user.lastLatitude !== undefined)
  @IsLongitude()
  lastLongitude?: number;

  /**
   * Indica se o utilizador pretende receber alertas de proximidade.
   */
  @IsBoolean()
  @IsOptional()
  alertsEnabled?: boolean;

  /**
   * Raio máximo de alertas em metros, entre 100 e 10 000.
   */
  @IsInt()
  @IsOptional()
  @Min(100)
  @Max(10000)
  alertRadiusM?: number;
}
