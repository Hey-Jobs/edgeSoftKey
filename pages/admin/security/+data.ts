import type { PrismaClient } from "../../../generated/prisma/client";
import { getTurnstileConfig } from "../../../server/turnstile";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: {
  prisma: PrismaClient;
  session?: { user?: { id?: string; role?: string } };
}) {
  if (pageContext.session?.user?.role !== "admin") {
    return {
      turnstileEnabled: false,
      twoFactor: null,
    };
  }

  const config = getTurnstileConfig();
  const adminId = Number(pageContext.session?.user?.id);
  if (!Number.isFinite(adminId)) {
    return {
      turnstileEnabled: config.enabled,
      twoFactor: null,
    };
  }

  const admin = await pageContext.prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      username: true,
      status: true,
      twoFactorEnabled: true,
      twoFactorEnabledAt: true,
    },
  });

  return {
    turnstileEnabled: config.enabled,
    twoFactor: admin && admin.status === "ACTIVE"
      ? {
          username: admin.username,
          twoFactorEnabled: admin.twoFactorEnabled,
          twoFactorEnabledAt: admin.twoFactorEnabledAt?.toISOString() ?? null,
        }
      : null,
  };
}
