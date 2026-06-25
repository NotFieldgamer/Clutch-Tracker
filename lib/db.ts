import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In dev, Next.js hot-reload would otherwise spawn a
 * new client (and a new connection pool) on every reload — so we cache it on
 * globalThis. In production a single instance is created per server.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
