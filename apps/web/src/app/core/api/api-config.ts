/**
 * Prefixo de todas as chamadas à API. É relativo: em desenvolvimento o proxy do dev server
 * encaminha para a API local e em produção o Nginx faz o mesmo, sem CORS e sem host fixo.
 */
export const API_URL = '/api';

/** Rotas que não usam token e cujo 401 significa "credenciais inválidas", não "sessão expirada". */
export const PUBLIC_API_PREFIXES = [`${API_URL}/auth/`, `${API_URL}/public/`];
