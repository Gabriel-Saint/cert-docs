import type { Prisma, PrismaClient } from '../../../generated/prisma/client';
import type {
  CourseEntity,
  CourseModule,
} from '../../../domain/entities/course.entity';
import type {
  CourseChanges,
  CourseRepositoryPort,
  NewCourse,
} from '../../../domain/ports';

const withModules = {
  modules: { orderBy: { position: 'asc' } },
} satisfies Prisma.CourseInclude;

type CourseRow = Prisma.CourseGetPayload<{ include: typeof withModules }>;

export class PrismaCourseRepository implements CourseRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<CourseEntity | null> {
    const row = await this.prisma.course.findUnique({
      where: { id },
      include: withModules,
    });
    return row && toDomain(row);
  }

  async findActiveById(id: string): Promise<CourseEntity | null> {
    const row = await this.prisma.course.findFirst({
      where: { id, isActive: true },
      include: withModules,
    });
    return row && toDomain(row);
  }

  async findAllActive(): Promise<CourseEntity[]> {
    const rows = await this.prisma.course.findMany({
      where: { isActive: true },
      include: withModules,
      orderBy: { title: 'asc' },
    });
    return rows.map(toDomain);
  }

  async create(data: NewCourse): Promise<CourseEntity> {
    const row = await this.prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        coordinator: data.coordinator,
        modules: { create: toModuleRows(data.modules) },
      },
      include: withModules,
    });
    return toDomain(row);
  }

  update(id: string, changes: CourseChanges): Promise<CourseEntity | null> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.course.updateMany({
        where: { id, isActive: true },
        data: {
          title: changes.title,
          description: changes.description,
          coordinator: changes.coordinator,
          updatedAt: new Date(),
        },
      });
      if (count === 0) return null;

      if (changes.modules) {
        await tx.courseModule.deleteMany({ where: { courseId: id } });
        await tx.courseModule.createMany({
          data: toModuleRows(changes.modules).map((row) => ({
            ...row,
            courseId: id,
          })),
        });
      }

      const row = await tx.course.findUniqueOrThrow({
        where: { id },
        include: withModules,
      });
      return toDomain(row);
    });
  }

  async deactivate(id: string): Promise<boolean> {
    const { count } = await this.prisma.course.updateMany({
      where: { id, isActive: true },
      data: { isActive: false },
    });
    return count > 0;
  }
}

function toModuleRows(modules: readonly CourseModule[]) {
  return modules.map((module, position) => ({
    title: module.title,
    hours: module.hours,
    position,
  }));
}

function toDomain(row: CourseRow): CourseEntity {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coordinator: row.coordinator,
    isActive: row.isActive,
    modules: row.modules.map(({ title, hours }) => ({ title, hours })),
    createdAt: row.createdAt,
  };
}
