import type { CourseEntity, CourseModule } from '../../entities/course.entity';

export interface NewCourse {
  title: string;
  description: string | null;
  coordinator: string;
  modules: CourseModule[];
}

export type CourseChanges = Partial<NewCourse>;

export interface CourseRepositoryPort {
  /** Inclui cursos desativados (usado na emissão de pedidos já existentes). */
  findById(id: string): Promise<CourseEntity | null>;
  findActiveById(id: string): Promise<CourseEntity | null>;
  findAllActive(): Promise<CourseEntity[]>;
  create(data: NewCourse): Promise<CourseEntity>;
  /** Substitui a lista de módulos quando `modules` é enviado. Retorna null se não houver curso ativo. */
  update(id: string, changes: CourseChanges): Promise<CourseEntity | null>;
  /** Soft delete. Retorna false se não houver curso ativo. */
  deactivate(id: string): Promise<boolean>;
}
