import {
  Role,
  type DocumentDetail,
  type DocumentSummary,
} from '@cert-docs/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CreateDocumentUseCase } from '../../application/use-cases/document/create-document.use-case';
import { DeleteDocumentUseCase } from '../../application/use-cases/document/delete-document.use-case';
import { GeneratePersonalizedPdfUseCase } from '../../application/use-cases/document/generate-personalized-pdf.use-case';
import { GetDocumentUseCase } from '../../application/use-cases/document/get-document.use-case';
import { ListDocumentsUseCase } from '../../application/use-cases/document/list-documents.use-case';
import { UpdateDocumentUseCase } from '../../application/use-cases/document/update-document.use-case';
import type { TokenPayload } from '../../domain/ports';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CreateDocumentDto, UpdateDocumentDto } from '../dtos/document.dto';
import {
  ApiErrorDto,
  DocumentDetailDto,
  DocumentSummaryDto,
  ValidationErrorDto,
} from '../dtos/response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import {
  toDocumentDetail,
  toDocumentSummary,
} from '../presenters/document.presenter';

const DocumentIdParam = () =>
  ApiParam({
    name: 'id',
    description: 'ID do documento',
    example: 'seed-material-longo',
  });

const DocumentNotFound = () =>
  ApiNotFoundResponse({
    type: ApiErrorDto,
    description:
      'Documento inexistente ou desativado (code: DOCUMENT_NOT_FOUND)',
  });

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard) // a ordem importa: 401 antes de 403
export class DocumentController {
  constructor(
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly getDocument: GetDocumentUseCase,
    private readonly createDocument: CreateDocumentUseCase,
    private readonly updateDocument: UpdateDocumentUseCase,
    private readonly deleteDocument: DeleteDocumentUseCase,
    private readonly generatePersonalizedPdf: GeneratePersonalizedPdfUseCase,
  ) {}

  @Get()
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({ summary: 'Lista os documentos ativos' })
  @ApiOkResponse({ type: [DocumentSummaryDto] })
  async list(): Promise<DocumentSummary[]> {
    const documents = await this.listDocuments.execute();
    return documents.map(toDocumentSummary);
  }

  @Get(':id')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({ summary: 'Detalha um documento' })
  @DocumentIdParam()
  @ApiOkResponse({ type: DocumentDetailDto })
  @DocumentNotFound()
  async findOne(@Param('id') id: string): Promise<DocumentDetail> {
    return toDocumentDetail(await this.getDocument.execute(id));
  }

  @Get(':id/pdf')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({
    summary: 'Baixa o PDF personalizado',
    description:
      'Gera o PDF com `CPF: <cpf formatado> | <nome>` no cabeçalho e no rodapé de todas as páginas, ' +
      'usando sempre o usuário do token. Cada download é registrado antes de o arquivo ser entregue.',
  })
  @DocumentIdParam()
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Arquivo PDF',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
    headers: {
      'Content-Disposition': {
        description: 'Nome do arquivo com o CPF parcial do usuário',
        schema: {
          type: 'string',
          example:
            'attachment; filename="documento-seed-material-longo-529-25.pdf"',
        },
      },
    },
  })
  @DocumentNotFound()
  @ApiInternalServerErrorResponse({
    type: ApiErrorDto,
    description:
      'Falha ao gerar o PDF (PDF_GENERATION_FAILED) ou ao registrar o download (DOWNLOAD_LOG_FAILED)',
  })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: TokenPayload,
    @Ip() ipAddress: string,
  ): Promise<StreamableFile> {
    const pdf = await this.generatePersonalizedPdf.execute({
      documentId: id,
      userId: user.sub,
      ipAddress,
    });

    return new StreamableFile(pdf.buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${pdf.fileName}"`,
      length: pdf.buffer.length,
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cria um documento' })
  @ApiCreatedResponse({ type: DocumentDetailDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  async create(@Body() dto: CreateDocumentDto): Promise<DocumentDetail> {
    return toDocumentDetail(await this.createDocument.execute(dto));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualiza os campos enviados de um documento' })
  @DocumentIdParam()
  @ApiOkResponse({ type: DocumentDetailDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @DocumentNotFound()
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentDetail> {
    return toDocumentDetail(await this.updateDocument.execute(id, dto));
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Desativa um documento (soft delete)',
    description:
      'O documento some da listagem, mas o histórico de downloads é mantido.',
  })
  @DocumentIdParam()
  @ApiOkResponse({ description: 'Documento desativado' })
  @DocumentNotFound()
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteDocument.execute(id);
  }
}
