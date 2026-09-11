import type { LoginRequest, RegisterRequest } from '@cpf-pdf/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const trimLowerCase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ minLength: 2, maxLength: 100, example: 'João Silva' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({
    format: 'email',
    maxLength: 254,
    description: 'Salvo em minúsculas',
    example: 'joao@example.com',
  })
  @Transform(trimLowerCase)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** A validação dos dígitos verificadores é feita no domínio (Value Object Cpf). */
  @ApiProperty({
    description:
      'Com ou sem pontuação. Validado pelo algoritmo oficial (módulo 11).',
    example: '111.444.777-35',
  })
  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'senha12345' })
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class LoginDto implements LoginRequest {
  @ApiProperty({ format: 'email', example: 'admin@example.com' })
  @Transform(trimLowerCase)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'admin12345' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
