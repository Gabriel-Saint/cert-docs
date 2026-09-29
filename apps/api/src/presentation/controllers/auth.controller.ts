import type { AuthSession, LoginResponse, PublicUser } from '@cert-docs/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticateUserUseCase } from '../../application/use-cases/auth/authenticate-user.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/auth/register-user.use-case';
import type { TokenPayload } from '../../domain/ports';
import {
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '../../infrastructure/security/session-cookie';
import { BrowserLoginDto, LoginDto, RegisterDto } from '../dtos/auth.dto';
import {
  ApiErrorDto,
  AuthSessionDto,
  LoginResponseDto,
  PublicUserDto,
  ValidationErrorDto,
} from '../dtos/response.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { toPublicUser } from '../presenters/user.presenter';

@ApiTags('auth')
@ApiExtraModels(ApiErrorDto, ValidationErrorDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly authenticateUser: AuthenticateUserUseCase,
    private readonly jwt: JwtService,
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

  @Post('session/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia sessão web por cookie HttpOnly',
    description:
      'Usado pelo frontend. O JWT não é retornado no corpo; integrações usam POST /auth/login.',
  })
  @ApiOkResponse({
    type: AuthSessionDto,
    description: 'Sessão iniciada; JWT definido em cookie HttpOnly',
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Email ou senha incorretos (code: INVALID_CREDENTIALS)',
  })
  async loginBrowser(
    @Body() dto: BrowserLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const { accessToken } = await this.authenticateUser.execute(dto);
    const claims = await this.jwt.verifyAsync<TokenPayload & { exp: number }>(
      accessToken,
    );
    response.cookie(SESSION_COOKIE_NAME, accessToken, {
      ...sessionCookieOptions(),
      ...(dto.rememberMe ? { maxAge: SESSION_COOKIE_MAX_AGE_MS } : {}),
    });
    return {
      userId: claims.sub,
      email: claims.email,
      role: claims.role,
      expiresAt: claims.exp * 1000,
    };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('web-session')
  @ApiOperation({ summary: 'Restaura a sessão web atual' })
  @ApiOkResponse({
    type: AuthSessionDto,
    description: 'Identidade da sessão validada pelo servidor',
  })
  async getBrowserSession(
    @CurrentUser() user: TokenPayload,
  ): Promise<AuthSession> {
    if (!user.exp) throw new UnauthorizedException();
    return {
      userId: user.sub,
      email: user.email,
      role: user.role,
      expiresAt: user.exp * 1000,
    };
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('web-session')
  @ApiOperation({ summary: 'Encerra a sessão web atual' })
  @ApiNoContentResponse({ description: 'Cookie de sessão removido' })
  logoutBrowser(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  }
}
