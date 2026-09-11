import { Role, type UserListItem } from '@cpf-pdf/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListUsersUseCase } from '../../application/use-cases/user/list-users.use-case';
import { Roles } from '../decorators/roles.decorator';
import { UserListItemDto } from '../dtos/response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { toUserListItem } from '../presenters/user.presenter';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly listUsers: ListUsersUseCase) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Lista os usuários cadastrados',
    description: 'O CPF sai mascarado e o hash da senha nunca é retornado.',
  })
  @ApiOkResponse({ type: [UserListItemDto] })
  async list(): Promise<UserListItem[]> {
    const users = await this.listUsers.execute();
    return users.map(toUserListItem);
  }
}
