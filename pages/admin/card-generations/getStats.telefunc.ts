import { assertAdminAccess, getAdminContext } from "../../../modules/auth/service";

export async function onGetCardGenerationStats() {
  assertAdminAccess();
  const { prisma } = getAdminContext();

  const [totalGenerated, totalSuccess, totalPending] = await Promise.all([
    prisma.cardBatchGenerateRecord.aggregate({
      _sum: { quantity: true },
    }),
    prisma.cardBatchGenerateRecord.aggregate({
      where: { status: "SUCCESS" },
      _sum: { successCount: true },
    }),
    prisma.cardBatchGenerateRecord.count({
      where: { status: "PENDING" },
    }),
  ]);

  return {
    totalGenerated: totalGenerated._sum.quantity || 0,
    totalSuccess: totalSuccess._sum.successCount || 0,
    totalPending,
  };
}
