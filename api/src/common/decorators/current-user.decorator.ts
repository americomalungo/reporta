import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { Request } from 'express';
import { User } from '@/generated/prisma';

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
  dbUser?: User;
};

/**
 * Decorator que devolve o utilizador autenticado em formato Firebase.
 * Pode receber um campo opcional do payload do Firebase.
 * @returns {DecodedIdToken | string | undefined}
 */
export const CurrentUser = createParamDecorator(
  (field: keyof DecodedIdToken | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    return field ? user?.[field] : user;
  },
);

/**
 * Decorator que devolve o utilizador autenticado já carregado da base de dados.
 * @returns {User}
 * @throws {ForbiddenException} se não existir registo do utilizador na base de dados
 */
export const CurrentDbUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const { dbUser } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!dbUser) {
      throw new ForbiddenException('Utilizador não registado');
    }

    return dbUser;
  },
);
