import {
  type CertificateRequestView,
  type MyCertificateRequestView,
  type MyCertificateView,
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CertificateSettings } from '../../application/certificate-settings';
import {
  ApproveCertificateRequestUseCase,
  ListCertificateRequestsUseCase,
  ListMyCertificateRequestsUseCase,
  RejectCertificateRequestUseCase,
  RequestCertificateUseCase,
} from '../../application/use-cases/certificate-request/certificate-request.use-cases';
import type { TokenPayload } from '../../domain/ports';
import { CERTIFICATE_SETTINGS } from '../../modules/tokens';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import {
  ApproveCertificateRequestDto,
  CertificateRequestQueryDto,
  CertificateRequestViewDto,
  CreateCertificateRequestDto,
  MyCertificateRequestViewDto,
  MyCertificateViewDto,
  ReasonDto,
} from '../dtos/certificate.dto';
import { ApiErrorDto, ValidationErrorDto } from '../dtos/response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import {
  toMyCertificateView,
  toMyRequestView,
  toRequestView,
} from '../presenters/certificate.presenter';

const RequestNotFound = () =>
  ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Pedido inexistente (code: CERTIFICATE_REQUEST_NOT_FOUND)',
  });

const AlreadyReviewed = () =>
  ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'Pedido já analisado (code: CERTIFICATE_REQUEST_ALREADY_REVIEWED)',
  });

@ApiTags('certificate-requests')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificateRequestController {
  constructor(
    private readonly requestCertificate: RequestCertificateUseCase,
    private readonly listMyRequests: ListMyCertificateRequestsUseCase,
    private readonly listRequests: ListCertificateRequestsUseCase,
    private readonly approveRequest: ApproveCertificateRequestUseCase,
    private readonly rejectRequest: RejectCertificateRequestUseCase,
    @Inject(CERTIFICATE_SETTINGS)
    private readonly settings: CertificateSettings,
  ) {}

  @Post('certificate-requests')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({ summary: 'Solicita o certificado de um curso' })
  @ApiCreatedResponse({ type: MyCertificateRequestViewDto })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Curso inexistente ou desativado',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'Já existe pedido pendente ou certificado válido (code: CERTIFICATE_ALREADY_REQUESTED)',
  })
  async create(
    @Body() dto: CreateCertificateRequestDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<MyCertificateRequestView> {
    const { request, course } = await this.requestCertificate.execute({
      userId: user.sub,
      courseId: dto.courseId,
    });
    return toMyRequestView(request, course);
  }

  @Get('me/certificate-requests')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({ summary: 'Meus pedidos de certificado' })
  @ApiOkResponse({ type: [MyCertificateRequestViewDto] })
  async listMine(
    @CurrentUser() user: TokenPayload,
  ): Promise<MyCertificateRequestView[]> {
    const items = await this.listMyRequests.execute(user.sub);
    return items.map((item) => toMyRequestView(item.request, item.course));
  }

  @Get('certificate-requests')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Fila de pedidos (mais antigos primeiro)' })
  @ApiOkResponse({ type: [CertificateRequestViewDto] })
  async list(
    @Query() query: CertificateRequestQueryDto,
  ): Promise<CertificateRequestView[]> {
    const items = await this.listRequests.execute({ status: query.status });
    return items.map(toRequestView);
  }

  @Post('certificate-requests/:id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Aprova o pedido e emite o certificado',
    description:
      'Congela os dados, gera código, registro e hashes, renderiza o PDF e o guarda. ' +
      'Se qualquer etapa falhar, nada é gravado e o pedido continua pendente.',
  })
  @ApiCreatedResponse({ type: MyCertificateViewDto })
  @ApiBadRequestResponse({
    type: ValidationErrorDto,
    description: 'Datas inválidas (code: INVALID_CERTIFICATE_PERIOD)',
  })
  @RequestNotFound()
  @AlreadyReviewed()
  @ApiInternalServerErrorResponse({
    type: ApiErrorDto,
    description: 'Falha na emissão (code: CERTIFICATE_ISSUANCE_FAILED)',
  })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveCertificateRequestDto,
    @CurrentUser() admin: TokenPayload,
  ): Promise<MyCertificateView> {
    const certificate = await this.approveRequest.execute({
      requestId: id,
      reviewerId: admin.sub,
      startDate: dto.startDate,
      completionDate: dto.completionDate,
    });
    return toMyCertificateView(certificate, this.settings.publicWebUrl);
  }

  @Post('certificate-requests/:id/reject')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Recusa o pedido com motivo' })
  @ApiNoContentResponse({ description: 'Pedido recusado' })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @RequestNotFound()
  @AlreadyReviewed()
  async reject(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() admin: TokenPayload,
  ): Promise<void> {
    await this.rejectRequest.execute({
      requestId: id,
      reviewerId: admin.sub,
      reason: dto.reason,
    });
  }
}
