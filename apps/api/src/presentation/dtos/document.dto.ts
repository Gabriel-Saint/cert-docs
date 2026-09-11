import type {
  CreateDocumentRequest,
  UpdateDocumentRequest,
} from '@cpf-pdf/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto implements CreateDocumentRequest {
  @ApiProperty({ maxLength: 255, example: 'Apostila de NestJS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    maxLength: 1000,
    example: 'Módulos, providers e arquitetura hexagonal.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'Texto do documento. Quebras de linha são preservadas no PDF.',
    example:
      'Capítulo 1 — Introdução\n\nO NestJS organiza a aplicação em módulos...',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

/** Todos os campos são opcionais: só os enviados são alterados. */
export class UpdateDocumentDto implements UpdateDocumentRequest {
  @ApiPropertyOptional({
    maxLength: 255,
    example: 'Apostila de NestJS (2ª edição)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}
