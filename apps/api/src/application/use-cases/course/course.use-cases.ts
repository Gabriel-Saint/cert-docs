import type {
  CreateCourseRequest,
  UpdateCourseRequest,
} from '@cert-docs/shared';
import {
  assertValidModules,
  type CourseEntity,
} from '../../../domain/entities/course.entity';
import { CourseNotFoundError } from '../../../domain/errors';
import type { CourseRepositoryPort } from '../../../domain/ports';

export class CreateCourseUseCase {
  constructor(private readonly courses: CourseRepositoryPort) {}

  execute(input: CreateCourseRequest): Promise<CourseEntity> {
    assertValidModules(input.modules);
    return this.courses.create({
      title: input.title,
      description: input.description ?? null,
      coordinator: input.coordinator,
      modules: input.modules,
    });
  }
}

export class UpdateCourseUseCase {
  constructor(private readonly courses: CourseRepositoryPort) {}

  async execute(
    id: string,
    changes: UpdateCourseRequest,
  ): Promise<CourseEntity> {
    if (changes.modules) assertValidModules(changes.modules);

    const updated = await this.courses.update(id, changes);
    if (!updated) throw new CourseNotFoundError();
    return updated;
  }
}

/** Soft delete: o curso deixa de aceitar pedidos, mas pedidos e certificados existentes continuam. */
export class DeactivateCourseUseCase {
  constructor(private readonly courses: CourseRepositoryPort) {}

  async execute(id: string): Promise<void> {
    const deactivated = await this.courses.deactivate(id);
    if (!deactivated) throw new CourseNotFoundError();
  }
}

export class ListActiveCoursesUseCase {
  constructor(private readonly courses: CourseRepositoryPort) {}

  execute(): Promise<CourseEntity[]> {
    return this.courses.findAllActive();
  }
}
