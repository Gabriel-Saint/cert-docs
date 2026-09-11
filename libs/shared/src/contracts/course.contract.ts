export interface CourseModuleInput {
  title: string;
  hours: number;
}

export interface CourseView {
  id: string;
  title: string;
  description: string | null;
  coordinator: string;
  /** Soma das horas dos módulos. */
  workloadHours: number;
  modules: CourseModuleInput[];
}

export interface CreateCourseRequest {
  title: string;
  description?: string;
  coordinator: string;
  modules: CourseModuleInput[];
}

export type UpdateCourseRequest = Partial<CreateCourseRequest>;
