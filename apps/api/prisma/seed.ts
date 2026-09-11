/**
 * Seed idempotente: pode rodar várias vezes sem duplicar registros.
 * Uso: npx nx run api:prisma-seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
});

const LONG_PARAGRAPH =
  'O controle de acesso a materiais restritos depende de rastreabilidade. ' +
  'Cada cópia distribuída carrega a identificação de quem a solicitou, o que ' +
  'desestimula o compartilhamento indevido e permite identificar a origem de um vazamento. ' +
  'Este parágrafo se repete para gerar um documento com várias páginas e validar ' +
  'que o carimbo aparece no cabeçalho e no rodapé de todas elas.';

const SAMPLE_DOCUMENTS = [
  {
    id: 'seed-apostila-typescript',
    title: 'Apostila de TypeScript',
    description: 'Tipos, generics e boas práticas para projetos grandes.',
    content:
      'Capítulo 1 — Tipos básicos\n\nTypeScript adiciona tipagem estática ao JavaScript.\n\n' +
      'Capítulo 2 — Generics\n\nGenerics permitem escrever código reutilizável sem perder a tipagem.',
  },
  {
    id: 'seed-guia-nestjs',
    title: 'Guia de NestJS com Arquitetura Hexagonal',
    description: 'Ports, adapters e casos de uso na prática.',
    content:
      'A arquitetura hexagonal separa o núcleo de negócio das tecnologias externas.\n\n' +
      'O domínio define ports (interfaces) e a infraestrutura fornece adapters (implementações).',
  },
  {
    id: 'seed-material-longo',
    title: 'Material Completo (várias páginas)',
    description: 'Documento longo para testar o carimbo em múltiplas páginas.',
    content: Array.from(
      { length: 40 },
      (_, i) => `${i + 1}. ${LONG_PARAGRAPH}`,
    ).join('\n\n'),
  },
];

async function main(): Promise<void> {
  const email = requireEnv('ADMIN_EMAIL').trim().toLowerCase();

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: process.env['ADMIN_NAME'] ?? 'Administrador',
      email,
      cpf: requireEnv('ADMIN_CPF').replace(/\D/g, ''),
      passwordHash: await hash(requireEnv('ADMIN_PASSWORD'), 10),
      role: 'ADMIN',
    },
  });

  for (const { id, ...data } of SAMPLE_DOCUMENTS) {
    await prisma.document.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }

  console.log(
    `Seed concluído: ADMIN ${email} e ${SAMPLE_DOCUMENTS.length} documentos.`,
  );
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente ausente: ${key}`);
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
