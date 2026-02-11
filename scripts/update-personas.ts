// Update personas in database with new humanized prompts
import { PrismaClient } from '@prisma/client';
import { DEFAULT_PERSONAS } from '../lib/personas';

const prisma = new PrismaClient();

async function updatePersonas() {
  console.log('🔄 Updating personas with enhanced humanized prompts...\n');

  for (const persona of DEFAULT_PERSONAS) {
    console.log(`Updating: ${persona.name}`);

    // Check if persona exists
    const existing = await prisma.persona.findFirst({
      where: { name: persona.name }
    });

    if (existing) {
      // Update existing
      await prisma.persona.update({
        where: { id: existing.id },
        data: {
          systemPrompt: persona.systemPrompt,
          description: persona.description,
        }
      });
      console.log(`  ✅ Updated ${persona.name}\n`);
    } else {
      // Create new
      await prisma.persona.create({
        data: {
          name: persona.name,
          description: persona.description,
          systemPrompt: persona.systemPrompt,
          isDefault: true,
        }
      });
      console.log(`  ✅ Created ${persona.name}\n`);
    }
  }

  console.log('✅ All personas updated!');

  await prisma.$disconnect();
}

updatePersonas().catch(console.error);
