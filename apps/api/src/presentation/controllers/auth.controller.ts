import type { LoginResponse, PublicUser } from '@cert-docs/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthenticateUserUseCase } from '../../application/use-cases/auth/authenticate-user.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/auth/register-user.use-case';
import { LoginDto, RegisterDto } from '../dtos/auth.dto';
import {
  ApiErrorDto,
  LoginResponseDto,
  PublicUserDto,
  ValidationErrorDto,
} from '../dtos/response.dto';
import { toPublicUser } from '../presenters/user.presenter';

@ApiTags('auth')
@ApiExtraModels(ApiErrorDto, ValidationErrorDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly authenticateUser: AuthenticateUserUseCase,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Cadastra um usuário',
    description:
      'Cria o usuário sempre com role USER. A senha é salva como hash bcrypt.',
  })
  @ApiCreatedResponse({ type: PublicUserDto })
  @ApiBadRequestResponse({
    description: 'Campos inválidos ou CPF inválido (code: INVALID_CPF)',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ValidationErrorDto) },
        { $ref: getSchemaPath(ApiErrorDto) },
      ],
    },
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Email ou CPF já cadastrado (code: EMAIL_OR_CPF_IN_USE)',
  })
  async register(@Body() dto: RegisterDto): Promise<PublicUser> {
    const user = await this.registerUser.execute(dto);
    return toPublicUser(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autentica e retorna o token JWT',
    description:
      'Use o accessToken no botão Authorize para chamar as rotas protegidas.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Email ou senha incorretos (code: INVALID_CREDENTIALS)',
  })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authenticateUser.execute(dto);
  }
}
