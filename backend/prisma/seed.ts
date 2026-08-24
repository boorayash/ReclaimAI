// One-time setup: creates your login user since there's no public
// signup flow (this is an internal admin tool, not a consumer app).
// Run with: npx ts-node prisma/seed.ts
// Change the email/password before running, then don't commit real ones.

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('changeme123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@revenue-recovery.local' },
    update: {},
    create: {
      email: 'admin@revenue-recovery.local',
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('Seeded admin user:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
