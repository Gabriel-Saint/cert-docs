import {
  Role,
  type DocumentDetail,
  type DocumentSummary,
} from '@cpf-pdf/shared';
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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import {
  toDocumentDetail,
  toDocumentSummary,
} from '../presenters/document.presenter';

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
  async list(): Promise<DocumentSummary[]> {
    const documents = await this.listDocuments.execute();
    return documents.map(toDocumentSummary);
  }

  @Get(':id')
  @Roles(Role.USER, Role.ADMIN)
  async findOne(@Param('id') id: string): Promise<DocumentDetail> {
    return toDocumentDetail(await this.getDocument.execute(id));
  }

  @Get(':id/pdf')
  @Roles(Role.USER, Role.ADMIN)
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
  async create(@Body() dto: CreateDocumentDto): Promise<DocumentDetail> {
    return toDocumentDetail(await this.createDocument.execute(dto));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentDetail> {
    return toDocumentDetail(await this.updateDocument.execute(id, dto));
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteDocument.execute(id);
  }
}
