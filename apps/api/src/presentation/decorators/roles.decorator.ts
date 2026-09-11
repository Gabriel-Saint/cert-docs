import { Role } from '@cpf-pdf/shared';
import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SWAGGER_BEARER_AUTH } from '../../swagger.setup';
import { ApiErrorDto } from '../dtos/response.dto';

export const ROLES_KEY = 'roles';

/**
 * Define quais roles podem acessar a rota (lido pelo RolesGuard) e,
 * de quebra, documenta no Swagger que a rota exige token e quais erros 401/403 devolve.
 */
export const Roles = (...roles: Role[]) => {
  const isAdminOnly = !roles.includes(Role.USER);

  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiBearerAuth(SWAGGER_BEARER_AUTH),
    ApiUnauthorizedResponse({
      type: ApiErrorDto,
      description: 'Token ausente, inválido ou expirado',
    }),
    ...(isAdminOnly
      ? [
          ApiForbiddenResponse({
            type: ApiErrorDto,
            description: `Acesso restrito a: ${roles.join(', ')}`,
          }),
        ]
      : []),
  );
};
