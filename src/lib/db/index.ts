// src/lib/db/index.ts
// Prisma singleton with a safe fallback.
// Prisma singleton with a safe fallback.
// The generated SQLite client is used by default; if Prisma cannot initialize,
// we fall back to a no-op in-memory shim so the app can still render and the
// rest of the pipeline can gracefully degrade.

import { PrismaClient } from "@prisma/client";

type NoopModel = {
  count: () => Promise<number>;
  findMany: () => Promise<unknown[]>;
  findUnique: () => Promise<null>;
  groupBy: () => Promise<never[]>;
  aggregate: () => Promise<{ _avg: { latencyMs: number | null } }>;
  create: () => Promise<null>;
  upsert: () => Promise<null>;
};

type PrismaLike = PrismaClient & {
  analysis: NoopModel;
  historyEntry: NoopModel;
  rateLimitBucket: NoopModel;
  usageEvent: NoopModel;
};

function createNoopPrisma(): PrismaLike {
  const emptyModel: NoopModel = {
    count: async () => 0,
    findMany: async () => [],
    findUnique: async () => null,
    groupBy: async () => [],
    aggregate: async () => ({ _avg: { latencyMs: null } }),
    create: async () => null,
    upsert: async () => null,
  };

  return {
    analysis: emptyModel,
    historyEntry: emptyModel,
    rateLimitBucket: emptyModel,
    usageEvent: emptyModel,
  } as unknown as PrismaLike;
}

declare global {
  // eslint-disable-next-line no-var
  var __truthlensPrisma: PrismaLike | undefined;
}

export function getPrisma(): PrismaLike {
  if (globalThis.__truthlensPrisma) return globalThis.__truthlensPrisma;

  try {
    globalThis.__truthlensPrisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["warn", "error"]
          : ["error"],
    }) as PrismaLike;
    return globalThis.__truthlensPrisma;
  } catch (err) {
    console.warn("[Prisma] Falling back to no-op client:", err);
    globalThis.__truthlensPrisma = createNoopPrisma();
    return globalThis.__truthlensPrisma;
  }
}
