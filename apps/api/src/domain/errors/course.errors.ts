import { DomainError } from './domain.error';

export class CourseNotFoundError extends DomainError {
  readonly code = 'COURSE_NOT_FOUND';

  constructor() {
    super('Curso não encontrado');
  }
}

export class InvalidCourseError extends DomainError {
  readonly code = 'INVALID_COURSE';

  constructor(message: string) {
    super(message);
  }
}
