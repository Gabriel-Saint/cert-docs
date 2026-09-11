import { Role, type UserListItem } from '@cpf-pdf/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ListUsersUseCase } from '../../application/use-cases/user/list-users.use-case';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { toUserListItem } from '../presenters/user.presenter';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly listUsers: ListUsersUseCase) {}

  @Get()
  @Roles(Role.ADMIN)
  async list(): Promise<UserListItem[]> {
    const users = await this.listUsers.execute();
    return users.map(toUserListItem);
  }
}
