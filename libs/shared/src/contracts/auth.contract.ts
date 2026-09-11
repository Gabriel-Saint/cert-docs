import type { Role } from '../enums/role.js';

export interface RegisterRequest {
  name: string;
  email: string;
  cpf: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
