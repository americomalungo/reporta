import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { Request } from 'express';
import { User } from '@/generated/prisma';

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
  dbUser?: User;
};

export const CurrentUser = createParamDecorator(
  (field: keyof DecodedIdToken | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    return field ? user?.[field] : user;
  },
);
