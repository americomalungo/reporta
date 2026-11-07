import { Global, Module } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { EnvService } from '../env/env.service';
import { FIREBASE_APP, FIREBASE_AUTH } from './firebase.constants';

@Global()
@Module({
  providers: [
    {
      provide: FIREBASE_APP,
      inject: [EnvService],
      useFactory: (env: EnvService): App => {
        const { projectId, privateKey, clientEmail } = env.firebase;
        return (
          getApps()[0] ??
          initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
          })
        );
      },
    },
    {
      provide: FIREBASE_AUTH,
      inject: [FIREBASE_APP],
      useFactory: (app: App): Auth => getAuth(app),
    },
  ],
  exports: [FIREBASE_APP, FIREBASE_AUTH],
})
export class FirebaseModule {}
