import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import type { UserRole as UserRoleType } from '@/src/common/types/users.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<UserRoleType[]>(
      ROLES_KEY,
      targets,
    );
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = user?.role;
    const isKnownRole = Object.values(UserRole).some(
      (role) => role === userRole,
    );

    if (
      !userRole ||
      !isKnownRole ||
      !required.some((role) => role === userRole)
    ) {
      throw new ForbiddenException('Sem permissão para este recurso');
    }
    return true;
  }
}
