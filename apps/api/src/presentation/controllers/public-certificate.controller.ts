import type {
  FileCheckResult,
  PublicCertificateVerification,
} from '@cert-docs/shared';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CheckCertificateFileUseCase,
  VerifyCertificateUseCase,
} from '../../application/use-cases/certificate/certificate.use-cases';
import {
  FileCheckResultDto,
  PublicCertificateVerificationDto,
} from '../dtos/certificate.dto';
import { ApiErrorDto } from '../dtos/response.dto';
import { toPublicVerification } from '../presenters/certificate.presenter';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Formato mínimo do arquivo recebido pelo multer. */
interface UploadedPdf {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('public')
@Controller('public/certificates')
@UseGuards(ThrottlerGuard)
@ApiTooManyRequestsResponse({
  description: 'Mais de 30 requisições por minuto deste IP',
})
export class PublicCertificateController {
  constructor(
    private readonly verifyCertificate: VerifyCertificateUseCase,
    private readonly checkCertificateFile: CheckCertificateFileUseCase,
  ) {}

  @Get(':code')
  @ApiOperation({
    summary: 'Verifica a autenticidade de um certificado (sem login)',
    description:
      'Aceita o código com ou sem hífens, em maiúsculas ou minúsculas.',
  })
  @ApiOkResponse({ type: PublicCertificateVerificationDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Código em formato inválido',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Nenhum certificado com este código',
  })
  async verify(
    @Param('code') code: string,
  ): Promise<PublicCertificateVerification> {
    return toPublicVerification(await this.verifyCertificate.execute(code));
  }

  @Post(':code/file-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  @ApiOperation({
    summary: 'Confere se um PDF é exatamente o arquivo emitido',
    description:
      'Compara o SHA-256 do arquivo enviado com o do PDF emitido. O arquivo não é guardado.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: FileCheckResultDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Arquivo ausente ou não é PDF',
  })
  @ApiPayloadTooLargeResponse({ description: 'Arquivo acima de 5 MB' })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Nenhum certificado com este código',
  })
  async checkFile(
    @Param('code') code: string,
    @UploadedFile() file: UploadedPdf | undefined,
  ): Promise<FileCheckResult> {
    if (!file)
      throw new BadRequestException('Envie o arquivo PDF no campo "file"');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('O arquivo precisa ser um PDF');
    }
    return this.checkCertificateFile.execute({ code, content: file.buffer });
  }
}
