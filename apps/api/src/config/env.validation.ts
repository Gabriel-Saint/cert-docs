const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PUBLIC_WEB_URL',
  'INSTITUTION_NAME',
  'INSTITUTION_CITY',
  'INSTITUTION_DIRECTOR',
  'INSTITUTION_DIRECTOR_ROLE',
] as const;

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

  const publicWebUrl = String(config['PUBLIC_WEB_URL']);
  if (!URL.canParse(publicWebUrl)) {
    throw new Error(`PUBLIC_WEB_URL não é uma URL válida: ${publicWebUrl}`);
  }
  return config;
}
