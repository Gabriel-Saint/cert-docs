import {
  type ApproveCertificateRequestBody,
  type CertificateDetailView,
  type CertificateHistoryItem,
  type CertificateHistoryQuery,
  CertificateRequestStatus,
  type CertificateRequestView,
  type CertificateSnapshot,
  CertificateStatus,
  type CreateCertificateRequestBody,
  type FileCheckResult,
  type MyCertificateRequestView,
  type MyCertificateView,
  type PublicCertificateVerification,
  type ReasonBody,
} from '@cpf-pdf/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = 'deve estar no formato AAAA-MM-DD';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// ---------- Requests ----------

export class CreateCertificateRequestDto implements CreateCertificateRequestBody {
  @ApiProperty({ example: 'seed-curso-nestjs' })
  @IsString()
  @IsNotEmpty()
  courseId!: string;
}

export class ApproveCertificateRequestDto implements ApproveCertificateRequestBody {
  @ApiPropertyOptional({
    format: 'date',
    example: '2026-08-04',
    description: 'Início do curso',
  })
  @IsOptional()
  @Matches(ISO_DATE, { message: `startDate ${ISO_DATE_MESSAGE}` })
  startDate?: string;

  @ApiProperty({
    format: 'date',
    example: '2026-09-11',
    description: 'Conclusão; não pode ser futura',
  })
  @Matches(ISO_DATE, { message: `completionDate ${ISO_DATE_MESSAGE}` })
  completionDate!: string;
}

export class ReasonDto implements ReasonBody {
  @ApiProperty({
    minLength: 10,
    maxLength: 500,
    example: 'Frequência abaixo do mínimo exigido.',
  })
  @Transform(trim)
  @IsString()
  @Length(10, 500)
  reason!: string;
}

export class CertificateRequestQueryDto {
  @ApiPropertyOptional({ enum: Object.values(CertificateRequestStatus) })
  @IsOptional()
  @IsIn(Object.values(CertificateRequestStatus))
  status?: CertificateRequestStatus;
}

export class CertificateHistoryQueryDto implements CertificateHistoryQuery {
  @ApiPropertyOptional({ enum: Object.values(CertificateStatus) })
  @IsOptional()
  @IsIn(Object.values(CertificateStatus))
  status?: CertificateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Emitidos a partir de (inclusive)',
  })
  @IsOptional()
  @Matches(ISO_DATE, { message: `from ${ISO_DATE_MESSAGE}` })
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Emitidos até (inclusive)',
  })
  @IsOptional()
  @Matches(ISO_DATE, { message: `to ${ISO_DATE_MESSAGE}` })
  to?: string;

  @ApiPropertyOptional({
    description: 'Nome do aluno ou trecho do código de verificação',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

// ---------- Responses (documentação Swagger) ----------

class CourseRefDto {
  @ApiProperty({ example: 'seed-curso-nestjs' })
  id!: string;

  @ApiProperty({ example: 'NestJS com Arquitetura Hexagonal' })
  title!: string;
}

class PersonRefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Administrador' })
  name!: string;
}

class StudentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Maria Clara Souza' })
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  email!: string;

  @ApiProperty({ example: '935.***.***-80' })
  cpf!: string;
}

export class MyCertificateRequestViewDto implements MyCertificateRequestView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: CourseRefDto })
  course!: CourseRefDto;

  @ApiProperty({ enum: Object.values(CertificateRequestStatus) })
  status!: CertificateRequestStatus;

  @ApiProperty({ format: 'date-time' })
  requestedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reviewedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  rejectionReason!: string | null;
}

export class CertificateRequestViewDto
  extends MyCertificateRequestViewDto
  implements CertificateRequestView
{
  @ApiProperty({ type: StudentDto })
  student!: StudentDto;
}

export class MyCertificateViewDto implements MyCertificateView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'CERT-7K3F-9QX2-M8PD' })
  code!: string;

  @ApiProperty({ type: CourseRefDto })
  course!: CourseRefDto;

  @ApiProperty({ enum: Object.values(CertificateStatus) })
  status!: CertificateStatus;

  @ApiProperty({ format: 'date-time' })
  issuedAt!: string;

  @ApiProperty({
    example: 'http://localhost:4200/verificar/CERT-7K3F-9QX2-M8PD',
  })
  verificationUrl!: string;
}

class HolderDto {
  @ApiProperty({ example: 'Maria Clara Souza' })
  name!: string;

  @ApiProperty({ example: '935.***.***-80' })
  cpf!: string;
}

export class CertificateHistoryItemDto implements CertificateHistoryItem {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'CERT-7K3F-9QX2-M8PD' })
  code!: string;

  @ApiProperty({ example: '2026.000418' })
  registry!: string;

  @ApiProperty({ enum: Object.values(CertificateStatus) })
  status!: CertificateStatus;

  @ApiProperty({ format: 'date-time' })
  issuedAt!: string;

  @ApiProperty({ type: HolderDto })
  student!: HolderDto;

  @ApiProperty({ type: CourseRefDto })
  course!: CourseRefDto;

  @ApiProperty({ type: PersonRefDto })
  issuedBy!: PersonRefDto;
}

class RevocationDto {
  @ApiProperty({ format: 'date-time' })
  revokedAt!: string;

  @ApiProperty({ example: 'Emitido para o curso errado.' })
  reason!: string;

  @ApiProperty({ type: PersonRefDto })
  revokedBy!: PersonRefDto;
}

export class CertificateDetailViewDto
  extends CertificateHistoryItemDto
  implements CertificateDetailView
{
  @ApiProperty({ example: 3 })
  registryBook!: number;

  @ApiProperty({ example: 18 })
  registrySheet!: number;

  @ApiProperty({
    description: 'Dados congelados na emissão (CPF mascarado)',
    type: Object,
  })
  snapshot!: CertificateSnapshot;

  @ApiProperty({ description: 'SHA-256 dos dados, impresso no verso' })
  dataHash!: string;

  @ApiProperty({ description: 'SHA-256 dos bytes do PDF emitido' })
  fileHash!: string;

  @ApiProperty()
  verificationUrl!: string;

  @ApiProperty({ type: RevocationDto, nullable: true })
  revocation!: RevocationDto | null;
}

export class CertificateHistoryPageDto {
  @ApiProperty({ type: [CertificateHistoryItemDto] })
  items!: CertificateHistoryItemDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

class PeriodDto {
  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-08-04',
  })
  startDate!: string | null;

  @ApiProperty({ format: 'date', example: '2026-09-11' })
  completionDate!: string;
}

class PublicRevocationDto {
  @ApiProperty({ format: 'date-time' })
  revokedAt!: string;

  @ApiProperty()
  reason!: string;
}

export class PublicCertificateVerificationDto implements PublicCertificateVerification {
  @ApiProperty({ example: 'CERT-7K3F-9QX2-M8PD' })
  code!: string;

  @ApiProperty({ enum: Object.values(CertificateStatus) })
  status!: CertificateStatus;

  @ApiProperty({ example: 'Maria Clara Souza' })
  holderName!: string;

  @ApiProperty({ example: '935.***.***-80' })
  holderCpf!: string;

  @ApiProperty({ example: 'NestJS com Arquitetura Hexagonal' })
  courseTitle!: string;

  @ApiProperty({ example: 40 })
  workloadHours!: number;

  @ApiProperty({ type: PeriodDto })
  period!: PeriodDto;

  @ApiProperty({ format: 'date-time' })
  issuedAt!: string;

  @ApiProperty({ example: '2026.000418' })
  registry!: string;

  @ApiProperty()
  dataHash!: string;

  @ApiProperty({ type: PublicRevocationDto, nullable: true })
  revocation!: PublicRevocationDto | null;
}

export class FileCheckResultDto implements FileCheckResult {
  @ApiProperty({
    description: 'true quando o arquivo é exatamente o PDF emitido',
  })
  matches!: boolean;
}
