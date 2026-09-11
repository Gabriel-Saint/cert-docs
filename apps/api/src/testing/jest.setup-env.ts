// Variáveis mínimas para o ConfigModule validar o ambiente nos testes.
// Nenhum teste conecta no banco: o PrismaService é substituído por repositórios em memória.
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/test';
process.env['JWT_SECRET'] ??= 'test-secret';
process.env['PUBLIC_WEB_URL'] ??= 'http://localhost:4200';
process.env['INSTITUTION_NAME'] ??= 'Academia Horizonte';
process.env['INSTITUTION_CITY'] ??= 'São Paulo';
process.env['INSTITUTION_DIRECTOR'] ??= 'Dra. Helena Duarte';
process.env['INSTITUTION_DIRECTOR_ROLE'] ??= 'Diretora Acadêmica';
