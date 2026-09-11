import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TokenPayload } from '../../domain/ports';

export interface AuthenticatedRequest {
  user?: TokenPayload;
}

/** Usuário extraído do JWT pelo JwtStrategy. Use só em rotas protegidas pelo JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): TokenPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new Error('CurrentUser usado em rota sem JwtAuthGuard');
    }
    return request.user;
  },
);
