import type { CourseView } from '@cpf-pdf/shared';
import {
  type CourseEntity,
  workloadHours,
} from '../../domain/entities/course.entity';

export function toCourseView(course: CourseEntity): CourseView {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    coordinator: course.coordinator,
    workloadHours: workloadHours(course.modules),
    modules: course.modules.map(({ title, hours }) => ({ title, hours })),
  };
}
