import { assertAdminAccess } from "../../../modules/auth/service";
import { listDiscountCodes, createDiscountCode, updateDiscountCode, deleteDiscountCode } from "../../../modules/discount/service";
import type { PrismaClient } from "../../../generated/prisma/client";
import { getContext } from "telefunc";

function getAdminPrisma(): PrismaClient {
  assertAdminAccess();
  return getContext<{ prisma: PrismaClient }>().prisma;
}

export async function onQueryDiscountCodes(input: {
  page?: number;
  pageSize?: number;
}) {
  const prisma = getAdminPrisma();
  const page = input.page || 1;
  const pageSize = input.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.discountCode.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.discountCode.count(),
  ]);

  return { items, total };
}

export async function onCreateDiscountCode(input: {
  code: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minAmount?: number;
  maxUses?: number;
  productIds?: string;
  expiresAt?: string;
}) {
  const prisma = getAdminPrisma();
  return createDiscountCode({
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  }, prisma);
}

export async function onUpdateDiscountCode(id: number, input: {
  code?: string;
  type?: "FIXED" | "PERCENT";
  value?: number;
  minAmount?: number | null;
  maxUses?: number | null;
  productIds?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const prisma = getAdminPrisma();
  return updateDiscountCode(id, {
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : input.expiresAt === null ? null : undefined,
  }, prisma);
}

export async function onDeleteDiscountCode(id: number) {
  const prisma = getAdminPrisma();
  return deleteDiscountCode(id, prisma);
}
