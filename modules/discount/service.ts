import { getContext } from "telefunc";
import type { PrismaClient } from "../../generated/prisma/client";
import { conflictError, notFoundError } from "../../lib/app-error";
import { getAdminContext, logAdminOperation } from "../auth/service";

function getDiscountContext() {
  return getContext<{ prisma: PrismaClient }>();
}

export async function validateDiscountCode(code: string, productId: number, amount: number, prisma?: PrismaClient) {
  const client = prisma ?? getDiscountContext().prisma;

  const discountCode = await client.discountCode.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!discountCode) {
    throw notFoundError("折扣码不存在", "DISCOUNT_CODE_NOT_FOUND");
  }

  if (!discountCode.isActive) {
    throw conflictError("折扣码已禁用", "DISCOUNT_CODE_DISABLED");
  }

  if (discountCode.expiresAt && discountCode.expiresAt < new Date()) {
    throw conflictError("折扣码已过期", "DISCOUNT_CODE_EXPIRED");
  }

  if (discountCode.maxUses && discountCode.usedCount >= discountCode.maxUses) {
    throw conflictError("折扣码已用完", "DISCOUNT_CODE_EXHAUSTED");
  }

  if (discountCode.minAmount && amount < discountCode.minAmount) {
    throw conflictError(`最低消费 ${(discountCode.minAmount / 100).toFixed(2)} 元`, "DISCOUNT_CODE_MIN_AMOUNT");
  }

  if (discountCode.productIds) {
    const allowedIds = discountCode.productIds.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
    if (allowedIds.length > 0 && !allowedIds.includes(productId)) {
      throw conflictError("该折扣码不适用于此商品", "DISCOUNT_CODE_PRODUCT_NOT_ALLOWED");
    }
  }

  return discountCode;
}

export function calculateDiscount(type: "FIXED" | "PERCENT", value: number, amount: number) {
  if (type === "FIXED") {
    return Math.min(value, amount);
  }

  return Math.floor(amount * value / 100);
}

export async function applyDiscountCode(discountCodeId: number, prisma?: PrismaClient) {
  const client = prisma ?? getDiscountContext().prisma;

  await client.discountCode.update({
    where: { id: discountCodeId },
    data: { usedCount: { increment: 1 } },
  });
}

export async function previewDiscount(code: string, productId: number, amount: number) {
  const { prisma } = getDiscountContext();

  try {
    const discountCode = await validateDiscountCode(code, productId, amount, prisma);
    const discount = calculateDiscount(discountCode.type, discountCode.value, amount);

    return {
      valid: true,
      code: discountCode.code,
      type: discountCode.type,
      value: discountCode.value,
      discount,
      finalAmount: amount - discount,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || "折扣码无效",
    };
  }
}

export async function listDiscountCodes(prisma?: PrismaClient) {
  const client = prisma ?? getDiscountContext().prisma;

  return client.discountCode.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getDiscountCodeById(id: number, prisma?: PrismaClient) {
  const client = prisma ?? getDiscountContext().prisma;

  return client.discountCode.findUnique({
    where: { id },
  });
}

export async function createDiscountCode(input: {
  code: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minAmount?: number;
  maxUses?: number;
  productIds?: string;
  expiresAt?: Date;
}, prisma?: PrismaClient) {
  const client = prisma ?? getDiscountContext().prisma;
  const adminContext = getAdminContext();
  const adminId = Number(adminContext.session?.user?.id);

  const existing = await client.discountCode.findUnique({
    where: { code: input.code.toUpperCase() },
  });

  if (existing) {
    throw conflictError("折扣码已存在", "DISCOUNT_CODE_EXISTS");
  }

  if (input.type === "PERCENT" && (input.value <= 0 || input.value > 100)) {
    throw conflictError("百分比折扣值必须在 1-100 之间", "DISCOUNT_CODE_INVALID_PERCENT");
  }

  if (input.type === "FIXED" && input.value <= 0) {
    throw conflictError("固定金额折扣值必须大于 0", "DISCOUNT_CODE_INVALID_FIXED");
  }

  const discountCode = await client.discountCode.create({
    data: {
      code: input.code.toUpperCase(),
      type: input.type,
      value: input.value,
      minAmount: input.minAmount || null,
      maxUses: input.maxUses || null,
      productIds: input.productIds || null,
      expiresAt: input.expiresAt || null,
    },
  });

  await logAdminOperation(
    {
      action: "CREATE_DISCOUNT_CODE",
      targetType: "DiscountCode",
      targetId: String(discountCode.id),
      detail: `code=${discountCode.code}`,
    },
    { prisma: client, adminId },
  );

  return discountCode;
}

export async function updateDiscountCode(id: number, input: {
  code?: string;
  type?: "FIXED" | "PERCENT";
  value?: number;
  minAmount?: number | null;
  maxUses?: number | null;
  productIds?: string | null;
  expiresAt?: Date | null;
  isActive?: boolean;
}, prisma?: PrismaClient) {
  const client = prisma ?? getDiscountContext().prisma;
  const adminContext = getAdminContext();
  const adminId = Number(adminContext.session?.user?.id);

  const existing = await client.discountCode.findUnique({ where: { id } });
  if (!existing) {
    throw notFoundError("折扣码不存在", "DISCOUNT_CODE_NOT_FOUND");
  }

  if (input.code && input.code.toUpperCase() !== existing.code) {
    const duplicate = await client.discountCode.findUnique({
      where: { code: input.code.toUpperCase() },
    });
    if (duplicate) {
      throw conflictError("折扣码已存在", "DISCOUNT_CODE_EXISTS");
    }
  }

  if (input.type === "PERCENT" && input.value !== undefined && (input.value <= 0 || input.value > 100)) {
    throw conflictError("百分比折扣值必须在 1-100 之间", "DISCOUNT_CODE_INVALID_PERCENT");
  }

  if (input.type === "FIXED" && input.value !== undefined && input.value <= 0) {
    throw conflictError("固定金额折扣值必须大于 0", "DISCOUNT_CODE_INVALID_FIXED");
  }

  const discountCode = await client.discountCode.update({
    where: { id },
    data: {
      code: input.code?.toUpperCase(),
      type: input.type,
      value: input.value,
      minAmount: input.minAmount === null ? null : input.minAmount,
      maxUses: input.maxUses === null ? null : input.maxUses,
      productIds: input.productIds === null ? null : input.productIds,
      expiresAt: input.expiresAt === null ? null : input.expiresAt,
      isActive: input.isActive,
    },
  });

  await logAdminOperation(
    {
      action: "UPDATE_DISCOUNT_CODE",
      targetType: "DiscountCode",
      targetId: String(discountCode.id),
      detail: `code=${discountCode.code}`,
    },
    { prisma: client, adminId },
  );

  return discountCode;
}

export async function deleteDiscountCode(id: number, prisma?: PrismaClient) {
  const client = prisma ?? getDiscountContext().prisma;
  const adminContext = getAdminContext();
  const adminId = Number(adminContext.session?.user?.id);

  const existing = await client.discountCode.findUnique({ where: { id } });
  if (!existing) {
    throw notFoundError("折扣码不存在", "DISCOUNT_CODE_NOT_FOUND");
  }

  await client.discountCode.delete({ where: { id } });

  await logAdminOperation(
    {
      action: "DELETE_DISCOUNT_CODE",
      targetType: "DiscountCode",
      targetId: String(id),
      detail: `code=${existing.code}`,
    },
    { prisma: client, adminId },
  );

  return { success: true };
}
