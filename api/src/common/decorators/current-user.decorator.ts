import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { Request } from 'express';

export type AuthenticatedRequest = Request & { user: DecodedIdToken };

export const CurrentUser = createParamDecorator(
  (field: keyof DecodedIdToken | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    return field ? user?.[field] : user;
  },
);
