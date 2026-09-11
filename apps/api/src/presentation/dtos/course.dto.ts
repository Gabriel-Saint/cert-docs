import type {
  CourseModuleInput,
  CourseView,
  CreateCourseRequest,
  UpdateCourseRequest,
} from '@cpf-pdf/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_COURSE_MODULES,
  MAX_MODULE_HOURS,
} from '../../domain/entities/course.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CourseModuleDto implements CourseModuleInput {
  @ApiProperty({
    maxLength: 120,
    example: 'Arquitetura hexagonal: domínio, ports e adapters',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_MODULE_HOURS, example: 8 })
  @IsInt()
  @Min(1)
  @Max(MAX_MODULE_HOURS)
  hours!: number;
}

export class CreateCourseDto implements CreateCourseRequest {
  @ApiProperty({ maxLength: 200, example: 'NestJS com Arquitetura Hexagonal' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    maxLength: 1000,
    example: 'Do zero ao deploy com ports e adapters.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ maxLength: 100, example: 'Prof. Ricardo Menezes' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  coordinator!: string;

  @ApiProperty({
    type: [CourseModuleDto],
    minItems: 1,
    maxItems: MAX_COURSE_MODULES,
    description:
      'Na ordem do conteúdo programático. A carga horária total é a soma.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_COURSE_MODULES)
  @ValidateNested({ each: true })
  @Type(() => CourseModuleDto)
  modules!: CourseModuleDto[];
}

/** Campos opcionais; se `modules` for enviado, substitui a lista inteira. */
export class UpdateCourseDto implements UpdateCourseRequest {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  coordinator?: string;

  @ApiPropertyOptional({
    type: [CourseModuleDto],
    minItems: 1,
    maxItems: MAX_COURSE_MODULES,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_COURSE_MODULES)
  @ValidateNested({ each: true })
  @Type(() => CourseModuleDto)
  modules?: CourseModuleDto[];
}

export class CourseViewDto implements CourseView {
  @ApiProperty({ example: 'seed-curso-nestjs' })
  id!: string;

  @ApiProperty({ example: 'NestJS com Arquitetura Hexagonal' })
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'Prof. Ricardo Menezes' })
  coordinator!: string;

  @ApiProperty({ example: 40, description: 'Soma das horas dos módulos' })
  workloadHours!: number;

  @ApiProperty({ type: [CourseModuleDto] })
  modules!: CourseModuleDto[];
}
