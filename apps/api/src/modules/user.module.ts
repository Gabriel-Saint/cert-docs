import { Module } from '@nestjs/common';
import { ListUsersUseCase } from '../application/use-cases/user/list-users.use-case';
import type { UserRepositoryPort } from '../domain/ports';
import { UserController } from '../presentation/controllers/user.controller';
import { USER_REPOSITORY } from './tokens';

@Module({
  controllers: [UserController],
  providers: [
    {
      provide: ListUsersUseCase,
      inject: [USER_REPOSITORY],
      useFactory: (users: UserRepositoryPort) => new ListUsersUseCase(users),
    },
  ],
})
export class UserModule {}
