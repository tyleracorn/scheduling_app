import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessions = await prisma.session.findMany({
  take: 5,
  include: { user: { select: { email: true } } },
});
console.log(JSON.stringify(sessions, null, 2));
await prisma.$disconnect();
