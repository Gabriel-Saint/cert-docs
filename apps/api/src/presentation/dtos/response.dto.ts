/**
 * Classes de resposta usadas só para documentação no Swagger.
 * Os contratos da libs/shared são interfaces (somem em runtime), e o Swagger precisa de classes.
 */
import {
  type DocumentDetail,
  type DocumentSummary,
  type LoginResponse,
  type PublicUser,
  Role,
  type UserListItem,
} from '@cert-docs/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserDto implements PublicUser {
  @ApiProperty({ example: 'cmtwaxakk0000jod4msdn5h4h' })
  id!: string;

  @ApiProperty({ example: 'João Silva' })
  name!: string;

  @ApiProperty({ example: 'joao@example.com' })
  email!: string;

  @ApiProperty({ enum: Object.values(Role), example: Role.USER })
  role!: Role;
}

export class UserListItemDto extends PublicUserDto implements UserListItem {
  @ApiProperty({
    description: 'CPF mascarado: só os 3 primeiros e os 2 últimos dígitos',
    example: '529.***.***-25',
  })
  cpf!: string;
}

export class LoginResponseDto implements LoginResponse {
  @ApiProperty({
    description: 'JWT com sub, email e role. Expira em 24 horas.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;
}

export class DocumentSummaryDto implements DocumentSummary {
  @ApiProperty({ example: 'seed-material-longo' })
  id!: string;

  @ApiProperty({ maxLength: 255, example: 'Apostila de TypeScript' })
  title!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 1000,
    example: 'Tipos, generics e boas práticas para projetos grandes.',
  })
  description!: string | null;
}

export class DocumentDetailDto
  extends DocumentSummaryDto
  implements DocumentDetail
{
  @ApiProperty({ example: 'Capítulo 1 — Tipos básicos...' })
  content!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-11T01:52:46.104Z' })
  createdAt!: string;
}

/** Erro de negócio ou de autenticação/autorização. */
export class ApiErrorDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiPropertyOptional({
    description: 'Identificador do erro de negócio',
    example: 'DOCUMENT_NOT_FOUND',
  })
  code?: string;

  @ApiProperty({ example: 'Documento não encontrado' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Presente nos erros gerados pelo NestJS (401, 403)',
    example: 'Forbidden',
  })
  error?: string;
}

/** Erro do ValidationPipe: body com campos ausentes, inválidos ou desconhecidos. */
export class ValidationErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    type: [String],
    example: [
      'password must be longer than or equal to 8 characters',
      'property hack should not exist',
    ],
  })
  message!: string[];
}
