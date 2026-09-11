import { Injectable } from '@nestjs/common';
import type { User as PrismaUser } from '../../../generated/prisma/client';
import { UserEntity } from '../../../domain/entities/user.entity';
import { EmailOrCpfAlreadyInUseError } from '../../../domain/errors';
import type { NewUser, UserRepositoryPort } from '../../../domain/ports';
import { Cpf } from '../../../domain/value-objects/cpf';
import { isUniqueConstraintViolation } from '../prisma-errors';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row && toDomain(row);
  }

  async findByCpf(cpf: Cpf): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({
      where: { cpf: cpf.toString() },
    });
    return row && toDomain(row);
  }

  async create(data: NewUser): Promise<UserEntity> {
    try {
      const row = await this.prisma.user.create({
        data: { ...data, cpf: data.cpf.toString() },
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new EmailOrCpfAlreadyInUseError({ cause: error });
      }
      throw error;
    }
  }

  async findAll(): Promise<UserEntity[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }
}

function toDomain(row: PrismaUser): UserEntity {
  return new UserEntity(
    row.id,
    row.name,
    row.email,
    Cpf.create(row.cpf),
    row.passwordHash,
    row.role,
    row.createdAt,
  );
}
