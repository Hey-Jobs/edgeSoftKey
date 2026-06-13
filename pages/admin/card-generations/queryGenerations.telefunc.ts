import { assertAdminAccess } from "../../../../modules/auth/service";
import { getAdminContext } from "../../../../modules/auth/service";
import type { PrismaClient } from "../../../../generated/prisma/client";

export async function onGetCardGenerationRecords(params: {
  productId?: number;
  batchNo?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  assertAdminAccess();
  const { prisma } = getAdminContext();

  const where: any = {};
  if (params.productId) where.productId = params.productId;
  if (params.batchNo) where.batchNo = { contains: params.batchNo };
  if (params.status) where.status = params.status;

  const skip = (params.page - 1) * params.pageSize;
  const [records, total] = await Promise.all([
    prisma.cardBatchGenerateRecord.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            cardType: true,
            durationDays: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize,
    }),
    prisma.cardBatchGenerateRecord.count({ where }),
  ]);

  return {
    total,
    items: records.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product.name,
      cardType: r.product.cardType,
      generateMode: r.generateMode,
      generateBy: r.generateBy,
      quantity: r.quantity,
      status: r.status,
      successCount: r.successCount,
      failCount: r.failCount,
      batchNo: r.batchNo,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
