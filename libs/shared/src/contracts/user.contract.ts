import type { PublicUser } from './auth.contract.js';

export interface UserListItem extends PublicUser {
  /** Sempre mascarado, ex.: 529.***.***-25 */
  cpf: string;
}
