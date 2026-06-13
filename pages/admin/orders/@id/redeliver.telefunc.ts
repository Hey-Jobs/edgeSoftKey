import { assertAdminAccess } from "../../../../modules/auth/service";
import { adminDeliverOrder } from "../../../../modules/delivery/service";
import { getContext } from "telefunc";
import type { PrismaClient } from "../../../../generated/prisma/client";

export async function onRedeliver(input: { orderId: number; content?: string }) {
  assertAdminAccess();
  const { prisma } = getContext<{ prisma: PrismaClient }>();
  return adminDeliverOrder(prisma, input.orderId, { content: input.content });
}
