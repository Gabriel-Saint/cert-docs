import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Token ausente, expirado, malformado ou com assinatura inválida -> 401. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
