import { FIREBASE_AUTH } from '@/src/infrastructure/firebase/firebase.constants';
import { UserRole } from '@/src/common/types/users.types';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Auth, DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(@Inject(FIREBASE_AUTH) private readonly auth: Auth) {}

  async onModuleInit() {
    await this.auth.listUsers(1);
  }

  setRole(uid: string, role: UserRole): Promise<void> {
    return this.auth.setCustomUserClaims(uid, { role });
  }

  verifyToken(token: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(token, true);
  }
}
