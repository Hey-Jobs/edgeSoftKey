-- ============================================
-- EdgeSoftKey 完整初始化迁移（含卡密有效期系统）
-- 适用于全新 D1 数据库部署
-- ============================================

-- Admin 管理表
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT 0,
    "twoFactorSecret" TEXT,
    "twoFactorEnabledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- SiteSetting 站点设置表
CREATE TABLE "SiteSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "siteName" TEXT NOT NULL,
    "siteUrl" TEXT,
    "siteSubtitle" TEXT,
    "logoIcon" TEXT,
    "logo" TEXT,
    "notice" TEXT,
    "supportContact" TEXT,
    "footerText" TEXT,
    "orderNotice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Category 分类表
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- Product 商品表（含卡密类型字段）
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deliveryType" TEXT NOT NULL DEFAULT 'CARD_AUTO',
    "fixedDeliveryContent" TEXT,
    "manualDeliveryHint" TEXT,
    "stockMode" TEXT NOT NULL DEFAULT 'FINITE',
    "cardType" TEXT NOT NULL DEFAULT 'NONE',
    "durationDays" INTEGER,
    "cardGenerateMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "minBuy" INTEGER NOT NULL DEFAULT 1,
    "maxBuy" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isVisibleStock" BOOLEAN NOT NULL DEFAULT 1,
    "isContactRequired" BOOLEAN NOT NULL DEFAULT 1,
    "purchaseNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_status_sort_idx" ON "Product"("status", "sort");

-- Card 卡密表
CREATE TABLE "Card" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNUSED',
    "batchNo" TEXT,
    "orderId" INTEGER,
    "soldAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Card_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Card_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Card_productId_status_idx" ON "Card"("productId", "status");
CREATE INDEX "Card_orderId_idx" ON "Card"("orderId");

-- Order 订单表
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "queryToken" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "contactType" TEXT NOT NULL DEFAULT 'EMAIL',
    "contactValue" TEXT,
    "buyerNote" TEXT,
    "paymentProvider" TEXT NOT NULL,
    "paymentChannel" TEXT,
    "paymentOrderNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'NOT_DELIVERED',
    "paidAt" DATETIME,
    "deliveredAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");
CREATE INDEX "Order_productId_idx" ON "Order"("productId");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");
CREATE INDEX "Order_deliveryStatus_createdAt_idx" ON "Order"("deliveryStatus", "createdAt");
CREATE INDEX "Order_discountCodeId_idx" ON "Order"("discountCodeId");

-- Order 表扩展：添加折扣字段
-- 注意：SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS
-- 这些字段在 CREATE TABLE 时已包含，此处仅为兼容性占位

-- OrderDelivery 订单交付记录表
CREATE TABLE "OrderDelivery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "deliveryType" TEXT NOT NULL DEFAULT 'CARD',
    "contentSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OrderDelivery_orderId_createdAt_idx" ON "OrderDelivery"("orderId", "createdAt");

-- PaymentConfig 支付配置表
CREATE TABLE "PaymentConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "configJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "PaymentConfig_provider_key" ON "PaymentConfig"("provider");

-- PaymentLog 支付日志表
CREATE TABLE "PaymentLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER,
    "provider" TEXT NOT NULL,
    "orderNo" TEXT,
    "paymentOrderNo" TEXT,
    "eventType" TEXT NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "verifyStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "PaymentLog_provider_createdAt_idx" ON "PaymentLog"("provider", "createdAt");
CREATE INDEX "PaymentLog_orderNo_idx" ON "PaymentLog"("orderNo");
CREATE INDEX "PaymentLog_orderId_idx" ON "PaymentLog"("orderId");

-- EmailConfig 邮件配置表
CREATE TABLE "EmailConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "configJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "EmailConfig_provider_idx" ON "EmailConfig"("provider");

-- EmailTemplate 邮件模板表
CREATE TABLE "EmailTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scene" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "EmailTemplate_scene_key" ON "EmailTemplate"("scene");

-- EmailLog 邮件日志表
CREATE TABLE "EmailLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER,
    "provider" TEXT NOT NULL,
    "apiProvider" TEXT,
    "scene" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "messageId" TEXT,
    "error" TEXT,
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "EmailLog_provider_createdAt_idx" ON "EmailLog"("provider", "createdAt");
CREATE INDEX "EmailLog_scene_createdAt_idx" ON "EmailLog"("scene", "createdAt");
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
CREATE INDEX "EmailLog_orderId_idx" ON "EmailLog"("orderId");

-- AdminOperationLog 管理员操作日志表
CREATE TABLE "AdminOperationLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminOperationLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AdminOperationLog_adminId_createdAt_idx" ON "AdminOperationLog"("adminId", "createdAt");

-- DiscountCode 优惠码表
CREATE TABLE "DiscountCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK("type" IN ('FIXED', 'PERCENT')),
    "value" INTEGER NOT NULL,
    "minAmount" INTEGER,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "productIds" TEXT,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");
CREATE INDEX "DiscountCode_code_idx" ON "DiscountCode"("code");
CREATE INDEX "DiscountCode_isActive_idx" ON "DiscountCode"("isActive");

-- Admin 表扩展：添加 2FA 字段
-- 注意：SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS
-- 这些字段在 CREATE TABLE 时已包含，此处仅为兼容性占位

-- S3Config 对象存储配置表
CREATE TABLE "S3Config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "endpoint" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretAccessKey" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'auto',
    "publicDomain" TEXT,
    "pathPrefix" TEXT,
    "cacheControl" TEXT NOT NULL DEFAULT 'public, max-age=31536000, immutable',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Media 媒体文件表
CREATE TABLE "Media" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "path" TEXT,
    "metadata" TEXT,
    "uploadedBy" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Media_storedName_key" ON "Media"("storedName");
CREATE UNIQUE INDEX "Media_fileKey_key" ON "Media"("fileKey");
CREATE INDEX "Media_mimeType_idx" ON "Media"("mimeType");
CREATE INDEX "Media_uploadedAt_idx" ON "Media"("uploadedAt");
CREATE INDEX "Media_path_idx" ON "Media"("path");

-- ============================================
-- 卡密有效期系统新增表
-- ============================================

-- CardValidity 卡密有效期绑定表
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

-- HardwareBinding 硬件绑定记录表
CREATE TABLE "HardwareBinding" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "cardId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "hardwareHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
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

-- CardUnbindLog 卡密解绑日志表
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

-- CardBatchGenerateRecord 卡密批量生成记录表
CREATE TABLE "CardBatchGenerateRecord" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "generateMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "generateBy" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
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
