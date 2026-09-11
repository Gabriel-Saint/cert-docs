import { type CourseView, Role } from '@cpf-pdf/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateCourseUseCase,
  DeactivateCourseUseCase,
  ListActiveCoursesUseCase,
  UpdateCourseUseCase,
} from '../../application/use-cases/course/course.use-cases';
import { Roles } from '../decorators/roles.decorator';
import {
  CourseViewDto,
  CreateCourseDto,
  UpdateCourseDto,
} from '../dtos/course.dto';
import { ApiErrorDto, ValidationErrorDto } from '../dtos/response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { toCourseView } from '../presenters/course.presenter';

const CourseNotFound = () =>
  ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Curso inexistente ou desativado (code: COURSE_NOT_FOUND)',
  });

@ApiTags('courses')
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseController {
  constructor(
    private readonly listActiveCourses: ListActiveCoursesUseCase,
    private readonly createCourse: CreateCourseUseCase,
    private readonly updateCourse: UpdateCourseUseCase,
    private readonly deactivateCourse: DeactivateCourseUseCase,
  ) {}

  @Get()
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({
    summary: 'Lista os cursos ativos com o conteúdo programático',
  })
  @ApiOkResponse({ type: [CourseViewDto] })
  async list(): Promise<CourseView[]> {
    const courses = await this.listActiveCourses.execute();
    return courses.map(toCourseView);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cria um curso com módulos' })
  @ApiCreatedResponse({ type: CourseViewDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  async create(@Body() dto: CreateCourseDto): Promise<CourseView> {
    return toCourseView(await this.createCourse.execute(dto));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Atualiza um curso',
    description:
      'Se `modules` for enviado, substitui a lista inteira na ordem recebida.',
  })
  @ApiOkResponse({ type: CourseViewDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @CourseNotFound()
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseView> {
    return toCourseView(await this.updateCourse.execute(id, dto));
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desativa um curso (soft delete)',
    description:
      'O curso deixa de aceitar pedidos; pedidos e certificados existentes continuam.',
  })
  @ApiNoContentResponse({ description: 'Curso desativado' })
  @CourseNotFound()
  async remove(@Param('id') id: string): Promise<void> {
    await this.deactivateCourse.execute(id);
  }
}
