const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

/** Falha na inicialização se faltar variável obrigatória, com mensagem clara. */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`,
    );
  }
  return config;
}
