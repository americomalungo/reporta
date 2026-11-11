import { FIREBASE_AUTH } from '@/src/infrastructure/firebase/firebase.constants';
import type { UserRole as UserRoleType } from '@/src/common/types/users.types';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Auth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';

/**
 * Serviço com as operações de autenticação e gestão do Firebase.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  constructor(@Inject(FIREBASE_AUTH) private readonly auth: Auth) {}

  /**
   * Inicializa o módulo verificando a conectividade com o Firebase.
   * @returns {Promise<void>} resolução da inicialização
   */
  async onModuleInit(): Promise<void> {
    await this.auth.listUsers(1);
  }

  /**
   * Define a role do utilizador no token customizado.
   * @param {string} uid id do utilizador no Firebase
   * @param {UserRoleType} role role a atribuir
   * @returns {Promise<void>} resolução da operação
   */
  setRole(uid: string, role: UserRoleType): Promise<void> {
    return this.auth.setCustomUserClaims(uid, { role });
  }

  /**
   * Verifica e valida um token do Firebase.
   * @param {string} token token JWT recebido no request
   * @returns {Promise<DecodedIdToken>} payload decodificado do token
   */
  verifyToken(token: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(token, true);
  }

  /**
   * Revoga todas as sessões de refresh de um utilizador.
   * @param {string} uid id do utilizador no Firebase
   * @returns {Promise<void>} resolução da operação
   */
  revokeUserSessions(uid: string): Promise<void> {
    return this.auth.revokeRefreshTokens(uid);
  }

  /**
   * Desativa uma conta do Firebase.
   * @param {string} uid id do utilizador no Firebase
   * @returns {Promise<UserRecord>} registo atualizado
   */
  disableUser(uid: string): Promise<UserRecord> {
    return this.auth.updateUser(uid, { disabled: true });
  }

  /**
   * Reativa uma conta do Firebase.
   * @param {string} uid id do utilizador no Firebase
   * @returns {Promise<UserRecord>} registo atualizado
   */
  enableUser(uid: string): Promise<UserRecord> {
    return this.auth.updateUser(uid, { disabled: false });
  }
}
