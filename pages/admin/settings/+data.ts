import type { PrismaClient } from "../../../generated/prisma/client";
import { getSiteSetting } from "../../../modules/site/service";

export type Data = ReturnType<typeof data>;

export async function data(pageContext: {
  prisma: PrismaClient;
  session?: { user?: { role?: string } };
}) {
  if (pageContext.session?.user?.role !== "admin") {
    return { site: null };
  }

  return {
    site: await getSiteSetting(pageContext.prisma),
  };
}
