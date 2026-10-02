import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('=================================');
  console.log('🌱 Starting IPL Auction Arena Seed Script');
  console.log('=================================');

  const dataPath = path.join(__dirname, '../data/players.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const { teams, players } = JSON.parse(rawData);

  // 1. Seed Teams
  console.log(`\n🏏 Seeding ${teams.length} IPL Franchise Teams...`);
  let seededTeamsCount = 0;
  for (const team of teams) {
    await prisma.team.upsert({
      where: { shortName: team.shortName },
      update: {
        name: team.name,
        logoUrl: team.logoUrl,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor
      },
      create: {
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        logoUrl: team.logoUrl,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor
      }
    });
    seededTeamsCount++;
  }
  console.log(`✅ ${seededTeamsCount} Teams successfully seeded/updated.`);

  // 2. Seed Players
  console.log(`\n👤 Seeding ${players.length} IPL Players...`);
  let seededPlayersCount = 0;
  for (const player of players) {
    const statsPayload = typeof player.stats === 'object' ? JSON.stringify(player.stats) : player.stats;

    await prisma.player.upsert({
      where: { id: player.id },
      update: {
        name: player.name,
        role: player.role,
        country: player.country,
        basePrice: player.basePrice,
        category: player.category || 'Capped',
        battingStyle: player.battingStyle || null,
        bowlingStyle: player.bowlingStyle || null,
        isActive: player.isActive !== undefined ? player.isActive : true,
        imageUrl: player.imageUrl || null,
        stats: statsPayload || null
      },
      create: {
        id: player.id,
        name: player.name,
        role: player.role,
        country: player.country,
        basePrice: player.basePrice,
        category: player.category || 'Capped',
        battingStyle: player.battingStyle || null,
        bowlingStyle: player.bowlingStyle || null,
        isActive: player.isActive !== undefined ? player.isActive : true,
        imageUrl: player.imageUrl || null,
        stats: statsPayload || null
      }
    });
    seededPlayersCount++;
  }
  console.log(`✅ ${seededPlayersCount} Players successfully seeded/updated.`);

  console.log('\n=================================');
  console.log('🎉 Database Seed Completed Successfully!');
  console.log('=================================');
}

main()
  .catch((e) => {
    console.error('❌ Seed script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
