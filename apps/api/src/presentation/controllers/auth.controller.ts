import type { LoginResponse, PublicUser } from '@cpf-pdf/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthenticateUserUseCase } from '../../application/use-cases/auth/authenticate-user.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/auth/register-user.use-case';
import { LoginDto, RegisterDto } from '../dtos/auth.dto';
import { toPublicUser } from '../presenters/user.presenter';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly authenticateUser: AuthenticateUserUseCase,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<PublicUser> {
    const user = await this.registerUser.execute(dto);
    return toPublicUser(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authenticateUser.execute(dto);
  }
}
