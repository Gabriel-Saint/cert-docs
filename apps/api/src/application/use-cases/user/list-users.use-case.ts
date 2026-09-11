import type { UserEntity } from '../../../domain/entities/user.entity';
import type { UserRepositoryPort } from '../../../domain/ports';

export class ListUsersUseCase {
  constructor(private readonly userRepo: UserRepositoryPort) {}

  execute(): Promise<UserEntity[]> {
    return this.userRepo.findAll();
  }
}
