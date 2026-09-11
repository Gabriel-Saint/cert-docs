import type { PublicUser, UserListItem } from '@cert-docs/shared';
import type { UserEntity } from '../../domain/entities/user.entity';

/** Nunca expõe passwordHash. */
export function toPublicUser(user: UserEntity): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** CPF sempre mascarado: 529.***.***-25 */
export function toUserListItem(user: UserEntity): UserListItem {
  return { ...toPublicUser(user), cpf: user.cpf.masked() };
}
