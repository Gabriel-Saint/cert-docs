// Variáveis mínimas para o ConfigModule validar o ambiente nos testes.
// Nenhum teste conecta no banco: o PrismaService é substituído por repositórios em memória.
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/test';
process.env['JWT_SECRET'] ??= 'test-secret';
