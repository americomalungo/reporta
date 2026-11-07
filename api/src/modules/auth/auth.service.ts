import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from '../../config/firebase/firebase.constants';

import { UserRole } from '../../../generated/prisma';

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
