import type { LoginRequest, RegisterRequest } from '@cpf-pdf/shared';
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
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @Transform(trimLowerCase)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** A validação dos dígitos verificadores é feita no domínio (Value Object Cpf). */
  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class LoginDto implements LoginRequest {
  @Transform(trimLowerCase)
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
