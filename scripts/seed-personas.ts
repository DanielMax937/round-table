// Seed default personas into the database

import { createPersona, getAllPersonas } from '../lib/db/personas';
import { DEFAULT_PERSONAS } from '../lib/personas';

async function seedDefaultPersonas() {
    console.log('Seeding default personas...');

    try {
        // Check if default personas already exist
        const existingPersonas = await getAllPersonas();
        const defaultPersonas = existingPersonas.filter((p) => p.isDefault);

        if (defaultPersonas.length > 0) {
            console.log(`✅ Found ${defaultPersonas.length} default personas already seeded`);
            return;
        }

        // Create default personas
        for (const persona of DEFAULT_PERSONAS) {
            const created = await createPersona({
                name: persona.name,
                description: persona.description,
                systemPrompt: persona.systemPrompt,
                isDefault: true,
            });
            console.log(`✅ Created default persona: ${created.name}`);
        }

        console.log(`✅ Successfully seeded ${DEFAULT_PERSONAS.length} default personas`);
    } catch (error) {
        console.error('❌ Error seeding default personas:', error);
        throw error;
    }
}

seedDefaultPersonas()
    .then(() => {
        console.log('✅ Seeding complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });
