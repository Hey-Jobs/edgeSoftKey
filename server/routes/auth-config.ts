import type { Hono } from "hono";
import type { PrismaClient } from "../../generated/prisma/client";
import { logger } from "../../lib/logger";

export function registerAuthConfigRoutes(app: Hono) {
  app.get("/api/auth/two-factor-config", async (c) => {
    try {
      const universalContext = (c as any).get("universalContext") as { prisma?: PrismaClient } | undefined;
      const prisma = universalContext?.prisma;
      if (!prisma) {
        return c.json({ enabled: false });
      }

      const enabledAdmin = await prisma.admin.findFirst({
        where: {
          status: "ACTIVE",
          twoFactorEnabled: true,
        },
        select: {
          id: true,
        },
      });

      return c.json({ enabled: Boolean(enabledAdmin) });
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), {
        event: "auth.two_factor_config.failed",
      });
      return c.json({ enabled: false });
    }
  });
}
