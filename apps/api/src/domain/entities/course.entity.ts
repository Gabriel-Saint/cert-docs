import { InvalidCourseError } from '../errors';

export const MAX_COURSE_MODULES = 12;
export const MAX_MODULE_HOURS = 999;

export interface CourseModule {
  title: string;
  hours: number;
}

export interface CourseEntity {
  id: string;
  title: string;
  description: string | null;
  coordinator: string;
  isActive: boolean;
  /** Na ordem do conteúdo programático. */
  modules: CourseModule[];
  createdAt: Date;
}

/** A carga horária nunca vem do cliente: é sempre a soma dos módulos. */
export function workloadHours(modules: readonly CourseModule[]): number {
  return modules.reduce((total, module) => total + module.hours, 0);
}

export function assertValidModules(modules: readonly CourseModule[]): void {
  if (modules.length === 0 || modules.length > MAX_COURSE_MODULES) {
    throw new InvalidCourseError(
      `O curso deve ter entre 1 e ${MAX_COURSE_MODULES} módulos`,
    );
  }
  for (const module of modules) {
    if (!module.title.trim()) {
      throw new InvalidCourseError('Todo módulo precisa de um título');
    }
    if (
      !Number.isInteger(module.hours) ||
      module.hours < 1 ||
      module.hours > MAX_MODULE_HOURS
    ) {
      throw new InvalidCourseError(
        `A carga horária de cada módulo deve ser um inteiro entre 1 e ${MAX_MODULE_HOURS}`,
      );
    }
  }
}
