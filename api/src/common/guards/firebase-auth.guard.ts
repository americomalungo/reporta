import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { AuthService } from '../../modules/auth/auth.service';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { AccountStatus } from '@/src/common/enums/users.enums';
import { ALLOW_UNREGISTERED_KEY } from '../decorators/allow-unregistered.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) return true;

    const allowUnregistered = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNREGISTERED_KEY,
      targets,
    );

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token não informado');
    }

    try {
      req.user = await this.authService.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const user = await this.userRepository.findUnique({
      firebaseUid: req.user.uid,
    });

    if (!user) {
      if (allowUnregistered) return true;
      throw new ForbiddenException(
        'Conta não registada. Registe-se primeiro para aceder ao recurso.',
      );
    }

    if (user.status === AccountStatus.DELETED || user.status === AccountStatus.BANNED) {
      throw new ForbiddenException('A sua conta não pode aceder a esta aplicação.');
    }

    if (user.status === AccountStatus.SUSPENDED) {
      if (!user.suspendedUntil || user.suspendedUntil <= new Date()) {
        return true;
      }
      throw new ForbiddenException(
        'A sua conta está suspensa até ' + user.suspendedUntil.toISOString(),
      );
    }

    return true;
  }
}
