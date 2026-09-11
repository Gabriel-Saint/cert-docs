import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthenticateUserUseCase } from '../application/use-cases/auth/authenticate-user.use-case';
import { RegisterUserUseCase } from '../application/use-cases/auth/register-user.use-case';
import type { HashPort, TokenPort, UserRepositoryPort } from '../domain/ports';
import { BcryptHashAdapter } from '../infrastructure/security/bcrypt-hash.adapter';
import {
  JWT_EXPIRES_IN,
  JwtTokenAdapter,
} from '../infrastructure/security/jwt-token.adapter';
import { AuthController } from '../presentation/controllers/auth.controller';
import { JwtStrategy } from '../presentation/guards/jwt.strategy';
import { HASH_SERVICE, TOKEN_SERVICE, USER_REPOSITORY } from './tokens';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: JWT_EXPIRES_IN },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    { provide: HASH_SERVICE, useClass: BcryptHashAdapter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenAdapter },
    {
      provide: RegisterUserUseCase,
      inject: [USER_REPOSITORY, HASH_SERVICE],
      useFactory: (users: UserRepositoryPort, hash: HashPort) =>
        new RegisterUserUseCase(users, hash),
    },
    {
      provide: AuthenticateUserUseCase,
      inject: [USER_REPOSITORY, HASH_SERVICE, TOKEN_SERVICE],
      useFactory: (
        users: UserRepositoryPort,
        hash: HashPort,
        token: TokenPort,
      ) => new AuthenticateUserUseCase(users, hash, token),
    },
  ],
})
export class AuthModule {}
