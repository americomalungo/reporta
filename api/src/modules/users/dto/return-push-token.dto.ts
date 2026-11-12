import type { PushPlatform } from '@/src/common/types/devices.types';

/**
 * Dados públicos devolvidos após registar um token push.
 */
export class ReturnPushTokenDto {
  /**
   * Identificador do registo do token.
   */
  id: string;

  /**
   * Plataforma associada ao token.
   */
  platform: PushPlatform;

  /**
   * Identificador do dispositivo, quando fornecido.
   */
  deviceId: string | null;

  /**
   * Indica se o token está ativo.
   */
  isActive: boolean;

  /**
   * Data da última atualização do registo.
   */
  updatedAt: Date;
}
