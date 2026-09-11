import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CourseModuleInput,
  CourseView,
  CreateCourseRequest,
  UpdateCourseRequest,
} from '@cert-docs/shared';
import type { Observable } from 'rxjs';
import { API_URL } from '../core/api/api-config';

const COURSES_URL = `${API_URL}/courses`;

/** Mesmos limites da API, para validar o formulário antes de enviar. */
export const COURSE_LIMITS = {
  titleMaxLength: 200,
  descriptionMaxLength: 1000,
  coordinatorMaxLength: 100,
  moduleTitleMaxLength: 120,
  minModules: 1,
  maxModules: 12,
  minModuleHours: 1,
  maxModuleHours: 999,
} as const;

/** Carga horária que o formulário mostra em tempo real; a API calcula a mesma soma. */
export function totalWorkload(
  modules: readonly Partial<CourseModuleInput>[],
): number {
  return modules.reduce((sum, module) => {
    const hours = Number(module.hours);
    return Number.isInteger(hours) && hours > 0 ? sum + hours : sum;
  }, 0);
}

@Injectable({ providedIn: 'root' })
export class CoursesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<CourseView[]> {
    return this.http.get<CourseView[]>(COURSES_URL);
  }

  create(data: CreateCourseRequest): Observable<CourseView> {
    return this.http.post<CourseView>(COURSES_URL, data);
  }

  /** Se `modules` for enviado, substitui a lista inteira. */
  update(id: string, changes: UpdateCourseRequest): Observable<CourseView> {
    return this.http.patch<CourseView>(
      `${COURSES_URL}/${encodeURIComponent(id)}`,
      changes,
    );
  }

  /** Soft delete: pedidos e certificados existentes continuam. */
  deactivate(id: string): Observable<void> {
    return this.http.delete<void>(`${COURSES_URL}/${encodeURIComponent(id)}`);
  }
}
