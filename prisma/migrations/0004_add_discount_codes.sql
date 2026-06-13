-- CreateTable
CREATE TABLE IF NOT EXISTS "DiscountCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK("type" IN ('FIXED', 'PERCENT')),
    "value" INTEGER NOT NULL,
    "minAmount" INTEGER,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "productIds" TEXT,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DiscountCode_code_idx" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DiscountCode_isActive_idx" ON "DiscountCode"("isActive");

-- AlterTable: Add discount fields to Order
ALTER TABLE "Order" ADD COLUMN "discountCodeId" INTEGER;
ALTER TABLE "Order" ADD COLUMN "discountCodeStr" TEXT;
ALTER TABLE "Order" ADD COLUMN "originalAmount" INTEGER;
ALTER TABLE "Order" ADD COLUMN "discountAmount" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_discountCodeId_idx" ON "Order"("discountCodeId");

-- AddForeignKey (SQLite 不支持 ALTER TABLE ADD CONSTRAINT，需要重建表)
-- 由于 D1/SQLite 限制，外键关系通过 Prisma schema 定义，应用层维护一致性
