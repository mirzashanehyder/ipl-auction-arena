import { PrismaClient } from '@prisma/client';

/**
 * Generates a unique human-readable room code formatted as IPL-XXXXXX
 * (e.g., IPL-X7K92P). Retries automatically if a collision occurs.
 */
export async function generateUniqueRoomCode(prisma) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit easily confused chars O, 0, I, 1
  let code = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    let randomStr = '';
    for (let i = 0; i < 6; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `IPL-${randomStr}`;

    const existing = await prisma.auctionSession.findUnique({
      where: { roomCode: code }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate a unique room code. Please try again.');
  }

  return code;
}
