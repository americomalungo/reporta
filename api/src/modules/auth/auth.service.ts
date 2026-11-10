import { FIREBASE_AUTH } from '@/src/infrastructure/firebase/firebase.constants';
import type { UserRole as UserRoleType } from '@/src/common/types/users.types';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Auth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(@Inject(FIREBASE_AUTH) private readonly auth: Auth) {}

  async onModuleInit() {
    await this.auth.listUsers(1);
  }

  setRole(uid: string, role: UserRoleType): Promise<void> {
    return this.auth.setCustomUserClaims(uid, { role });
  }

  verifyToken(token: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(token, true);
  }

  revokeUserSessions(uid: string): Promise<void> {
    return this.auth.revokeRefreshTokens(uid);
  }

  disableUser(uid: string): Promise<UserRecord> {
    return this.auth.updateUser(uid, { disabled: true });
  }
}
