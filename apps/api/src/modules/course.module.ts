import { Module } from '@nestjs/common';
import {
  CreateCourseUseCase,
  DeactivateCourseUseCase,
  ListActiveCoursesUseCase,
  UpdateCourseUseCase,
} from '../application/use-cases/course/course.use-cases';
import type { CourseRepositoryPort } from '../domain/ports';
import { CourseController } from '../presentation/controllers/course.controller';
import { COURSE_REPOSITORY } from './tokens';

@Module({
  controllers: [CourseController],
  providers: [
    {
      provide: ListActiveCoursesUseCase,
      inject: [COURSE_REPOSITORY],
      useFactory: (courses: CourseRepositoryPort) =>
        new ListActiveCoursesUseCase(courses),
    },
    {
      provide: CreateCourseUseCase,
      inject: [COURSE_REPOSITORY],
      useFactory: (courses: CourseRepositoryPort) =>
        new CreateCourseUseCase(courses),
    },
    {
      provide: UpdateCourseUseCase,
      inject: [COURSE_REPOSITORY],
      useFactory: (courses: CourseRepositoryPort) =>
        new UpdateCourseUseCase(courses),
    },
    {
      provide: DeactivateCourseUseCase,
      inject: [COURSE_REPOSITORY],
      useFactory: (courses: CourseRepositoryPort) =>
        new DeactivateCourseUseCase(courses),
    },
  ],
})
export class CourseModule {}
