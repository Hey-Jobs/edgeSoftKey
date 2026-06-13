-- 新增卡密类型枚举
CREATE TYPE "ProductCardType" AS ENUM ('NONE', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM');
CREATE TYPE "CardGenerateMode" AS ENUM ('MANUAL', 'AUTO');
CREATE TYPE "HardwareBindingStatus" AS ENUM ('ACTIVE', 'EXPIRED');
CREATE TYPE "CardGenerateStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- 扩展 Product 表
ALTER TABLE "Product" ADD COLUMN "cardType" "ProductCardType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Product" ADD COLUMN "durationDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN "cardGenerateMode" "CardGenerateMode" NOT NULL DEFAULT 'MANUAL';

-- 卡密有效期绑定表
CREATE TABLE "CardValidity" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "cardId" INTEGER UNIQUE NOT NULL,
  "productId" INTEGER NOT NULL,
  "expireAt" DATETIME NOT NULL,
  "boundAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_cardvalidity_product" FOREIGN KEY ("productId") REFERENCES "Product"("id"),
  CONSTRAINT "fk_cardvalidity_card" FOREIGN KEY ("cardId") REFERENCES "Card"("id")
);
CREATE INDEX "idx_cardvalidity_product_expire" ON "CardValidity"("productId", "expireAt");
CREATE INDEX "idx_cardvalidity_card" ON "CardValidity"("cardId");

-- 硬件绑定记录表
CREATE TABLE "HardwareBinding" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "cardId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "hardwareHash" TEXT NOT NULL,
  "status" "HardwareBindingStatus" NOT NULL DEFAULT 'ACTIVE',
  "cpuInfo" TEXT,
  "memoryInfo" TEXT,
  "gpuInfo" TEXT,
  "motherboardInfo" TEXT,
  "lastVerifiedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "fk_hardwarebinding_product" FOREIGN KEY ("productId") REFERENCES "Product"("id")
);
CREATE INDEX "idx_hardwarebinding_card" ON "HardwareBinding"("cardId");
CREATE INDEX "idx_hardwarebinding_product_hash" ON "HardwareBinding"("productId", "hardwareHash");
CREATE INDEX "idx_hardwarebinding_status" ON "HardwareBinding"("status");

-- 卡密解绑日志表
CREATE TABLE "CardUnbindLog" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "cardId" INTEGER NOT NULL,
  "unbindDays" INTEGER NOT NULL DEFAULT 1,
  "operatorIp" TEXT,
  "operatorId" INTEGER,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_cardunbindlog_card" FOREIGN KEY ("cardId") REFERENCES "Card"("id")
);
CREATE INDEX "idx_cardunbindlog_card_created" ON "CardUnbindLog"("cardId", "createdAt");
CREATE INDEX "idx_cardunbindlog_created" ON "CardUnbindLog"("createdAt");

-- 卡密批量生成记录表
CREATE TABLE "CardBatchGenerateRecord" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "productId" INTEGER NOT NULL,
  "generateMode" "CardGenerateMode" NOT NULL DEFAULT 'MANUAL',
  "generateBy" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "CardGenerateStatus" NOT NULL DEFAULT 'PENDING',
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failCount" INTEGER NOT NULL DEFAULT 0,
  "cardContents" TEXT,
  "batchNo" TEXT,
  "expireAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_cardbatchgenrecord_product" FOREIGN KEY ("productId") REFERENCES "Product"("id")
);
CREATE INDEX "idx_cardbatchgenrecord_product_created" ON "CardBatchGenerateRecord"("productId", "createdAt");
CREATE INDEX "idx_cardbatchgenrecord_batchno" ON "CardBatchGenerateRecord"("batchNo");
CREATE INDEX "idx_cardbatchgenrecord_status" ON "CardBatchGenerateRecord"("status");
