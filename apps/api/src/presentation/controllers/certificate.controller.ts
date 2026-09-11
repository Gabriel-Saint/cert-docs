import {
  type CertificateDetailView,
  type CertificateHistoryItem,
  type MyCertificateView,
  type Page,
  Role,
} from '@cert-docs/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { CertificateSettings } from '../../application/certificate-settings';
import {
  GetCertificateDetailUseCase,
  GetCertificateFileUseCase,
  ListCertificatesUseCase,
  ListMyCertificatesUseCase,
  RevokeCertificateUseCase,
} from '../../application/use-cases/certificate/certificate.use-cases';
import type { TokenPayload } from '../../domain/ports';
import { CERTIFICATE_SETTINGS } from '../../modules/tokens';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import {
  CertificateDetailViewDto,
  CertificateHistoryPageDto,
  CertificateHistoryQueryDto,
  MyCertificateViewDto,
  ReasonDto,
} from '../dtos/certificate.dto';
import { ApiErrorDto } from '../dtos/response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import {
  toDetailView,
  toHistoryItem,
  toMyCertificateView,
} from '../presenters/certificate.presenter';

const CertificateNotFound = () =>
  ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Certificado inexistente (code: CERTIFICATE_NOT_FOUND)',
  });

@ApiTags('certificates')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificateController {
  constructor(
    private readonly listMyCertificates: ListMyCertificatesUseCase,
    private readonly getCertificateFile: GetCertificateFileUseCase,
    private readonly listCertificates: ListCertificatesUseCase,
    private readonly getCertificateDetail: GetCertificateDetailUseCase,
    private readonly revokeCertificate: RevokeCertificateUseCase,
    @Inject(CERTIFICATE_SETTINGS)
    private readonly settings: CertificateSettings,
  ) {}

  @Get('me/certificates')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({ summary: 'Meus certificados emitidos' })
  @ApiOkResponse({ type: [MyCertificateViewDto] })
  async listMine(
    @CurrentUser() user: TokenPayload,
  ): Promise<MyCertificateView[]> {
    const certificates = await this.listMyCertificates.execute(user.sub);
    return certificates.map((certificate) =>
      toMyCertificateView(certificate, this.settings.publicWebUrl),
    );
  }

  @Get('certificates')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Histórico de certificados emitidos (mais recentes primeiro)',
  })
  @ApiOkResponse({ type: CertificateHistoryPageDto })
  async list(
    @Query() query: CertificateHistoryQueryDto,
  ): Promise<Page<CertificateHistoryItem>> {
    const page = await this.listCertificates.execute(query);
    return { ...page, items: page.items.map(toHistoryItem) };
  }

  @Get('certificates/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Detalhe do certificado com dados congelados e hashes',
  })
  @ApiOkResponse({ type: CertificateDetailViewDto })
  @CertificateNotFound()
  async findOne(@Param('id') id: string): Promise<CertificateDetailView> {
    const certificate = await this.getCertificateDetail.execute(id);
    return toDetailView(certificate, this.settings.publicWebUrl);
  }

  @Get('certificates/:id/pdf')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({
    summary: 'Baixa o PDF do certificado',
    description:
      'O dono do certificado ou um ADMIN. Para outros usuários responde 404, sem revelar que o certificado existe.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Arquivo guardado na emissão',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @CertificateNotFound()
  async download(
    @Param('id') id: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<StreamableFile> {
    const file = await this.getCertificateFile.execute({
      certificateId: id,
      requester: user,
    });
    return new StreamableFile(file.content, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.fileName}"`,
      length: file.content.length,
    });
  }

  @Post('certificates/:id/revoke')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoga um certificado',
    description:
      'Continua no histórico; a verificação pública passa a mostrar "revogado".',
  })
  @ApiNoContentResponse({ description: 'Certificado revogado' })
  @CertificateNotFound()
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Já revogado (code: CERTIFICATE_ALREADY_REVOKED)',
  })
  async revoke(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() admin: TokenPayload,
  ): Promise<void> {
    await this.revokeCertificate.execute({
      certificateId: id,
      revokerId: admin.sub,
      reason: dto.reason,
    });
  }
}
