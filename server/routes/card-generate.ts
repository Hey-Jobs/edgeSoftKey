import type { Hono } from "hono";
import type { PrismaClient } from "../../generated/prisma/client";
import { getContext } from "telefunc";
import { badRequestError, notFoundError } from "../../lib/app-error";
import { getAdminContext, logAdminOperation } from "../auth/service";
import { logger } from "../../lib/logger";

interface CardBatchGenerateInput {
  productId: number;
  quantity: number;
  batchNo?: string;
  mode?: "MANUAL" | "AUTO";
}

interface CardBatchGenerateOutput {
  success: boolean;
  message: string;
  cards?: Array<{ id: number; content: string }>;
  batchNo?: string;
  count?: number;
  code?: string;
}

function getCardContext() {
  return getContext<{ prisma: PrismaClient }>();
}

/**
 * 生成随机卡密
 * 使用字母数字组合生成指定长度的随机字符串
 */
function generateRandomCard(length: number = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除易混淆字符
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 卡密批量生成接口
 *
 * 支持两种模式：
 * 1. 手动生成模式（MANUAL）：管理员通过管理后台批量生成卡密
 * 2. 自动生成模式（AUTO）：下单后系统自动生成对应数量的卡密
 *
 * 生成的卡密自动关联到指定商品，状态为 UNUSED
 *
 * @postbody { productId: number, quantity: number, batchNo?: string, mode?: "MANUAL" | "AUTO" }
 * @returns { success: boolean, message: string, cards?: Array<{ id, content }>, batchNo?: string, count?: number, code?: string }
 */
export function registerCardGenerateRoutes(app: Hono) {
  // 管理员手动生成卡密
  app.post("/api/cards/generate", async (c) => {
    try {
      const adminContext = getAdminContext();
      const { prisma } = adminContext;
      const adminId = Number(adminContext.session?.user?.id);

      let body: CardBatchGenerateInput;

      try {
        body = await c.req.json();
      } catch {
        return c.json({
          success: false,
          message: "请求格式错误",
          code: "INVALID_REQUEST",
        } as CardBatchGenerateOutput, 400);
      }

      const { productId, quantity, batchNo, mode } = body;

      // 参数校验
      if (!productId || !quantity) {
        return c.json({
          success: false,
          message: "商品ID和数量不能为空",
          code: "MISSING_PARAMS",
        } as CardBatchGenerateOutput, 400);
      }

      if (quantity <= 0 || quantity > 10000) {
        return c.json({
          success: false,
          message: "生成数量必须在 1-10000 之间",
          code: "QUANTITY_INVALID",
        } as CardBatchGenerateOutput, 400);
      }

      // 验证商品是否存在
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return c.json({
          success: false,
          message: "商品不存在",
          code: "PRODUCT_NOT_FOUND",
        } as CardBatchGenerateOutput, 404);
      }

      // 检查商品是否为卡密类型
      if (product.cardType === "NONE") {
        return c.json({
          success: false,
          message: "该商品不是卡密类型商品，无法生成卡密",
          code: "PRODUCT_NOT_CARD_TYPE",
        } as CardBatchGenerateOutput, 400);
      }

      // 检查生成模式
      const generateMode = mode || product.cardGenerateMode || "MANUAL";
      if (generateMode === "AUTO") {
        return c.json({
          success: false,
          message: "该商品设置为自动生成模式，无法手动生成",
          code: "AUTO_MODE_ONLY",
        } as CardBatchGenerateOutput, 400);
      }

      // 生成卡密内容
      const cardsToCreate: Array<{ productId: number; content: string; batchNo: string | null }> = [];
      const generatedBatchNo = batchNo || `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      for (let i = 0; i < quantity; i++) {
        cardsToCreate.push({
          productId,
          content: generateRandomCard(16),
          batchNo: generatedBatchNo,
        });
      }

      // 开启事务：批量创建卡密 + 记录生成记录
      const result = await prisma.$transaction(async (tx: PrismaClient) => {
        // 批量创建卡密
        await tx.card.createMany({
          data: cardsToCreate,
        });

        // 记录生成记录
        await tx.cardBatchGenerateRecord.create({
          data: {
            productId,
            generateMode: "MANUAL",
            generateBy: String(adminId),
            quantity,
            status: "SUCCESS",
            successCount: quantity,
            cardContents: JSON.stringify(cardsToCreate.map((c) => c.content)),
            batchNo: generatedBatchNo,
          },
        });

        return { count: quantity, batchNo: generatedBatchNo };
      });

      // 记录管理员操作日志
      await logAdminOperation(
        {
          action: "GENERATE_CARDS",
          targetType: "CardBatch",
          targetId: String(productId),
          detail: `quantity=${result.count}, batchNo=${result.batchNo}`,
        },
        {
          prisma,
          adminId,
        },
      );

      logger.info("card_batch_generate", {
        productId,
        quantity: result.count,
        batchNo: result.batchNo,
        adminId,
      });

      return c.json({
        success: true,
        message: `成功生成 ${result.count} 张卡密`,
        batchNo: result.batchNo,
        count: result.count,
      } as CardBatchGenerateOutput);
    } catch (error) {
      logger.error("card_batch_generate_error", error);
      return c.json({
        success: false,
        message: "服务器生成失败，请稍后重试",
        code: "GENERATE_SERVER_ERROR",
      } as CardBatchGenerateOutput, 500);
    }
  });

  // 系统自动生成卡密（用于订单支付后的自动发货）
  app.post("/api/cards/generate/auto", async (c) => {
    try {
      const { prisma } = getCardContext();
      let body: { productId: number; quantity: number; orderId?: number; orderNo?: string };

      try {
        body = await c.req.json();
      } catch {
        return c.json({
          success: false,
          message: "请求格式错误",
          code: "INVALID_REQUEST",
        } as CardBatchGenerateOutput, 400);
      }

      const { productId, quantity, orderId, orderNo } = body;

      // 参数校验
      if (!productId || !quantity) {
        return c.json({
          success: false,
          message: "商品ID和数量不能为空",
          code: "MISSING_PARAMS",
        } as CardBatchGenerateOutput, 400);
      }

      if (quantity <= 0 || quantity > 100) {
        return c.json({
          success: false,
          message: "生成数量必须在 1-100 之间",
          code: "QUANTITY_INVALID",
        } as CardBatchGenerateOutput, 400);
      }

      // 验证商品是否存在
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return c.json({
          success: false,
          message: "商品不存在",
          code: "PRODUCT_NOT_FOUND",
        } as CardBatchGenerateOutput, 404);
      }

      // 检查商品是否为卡密类型且启用了自动生成
      if (product.cardType === "NONE") {
        return c.json({
          success: false,
          message: "该商品不是卡密类型商品",
          code: "PRODUCT_NOT_CARD_TYPE",
        } as CardBatchGenerateOutput, 400);
      }

      if (product.cardGenerateMode !== "AUTO") {
        return c.json({
          success: false,
          message: "该商品未启用自动生成模式",
          code: "AUTO_MODE_DISABLED",
        } as CardBatchGenerateOutput, 400);
      }

      // 生成卡密内容
      const cardsToCreate: Array<{ productId: number; content: string; batchNo: string | null }> = [];
      const generatedBatchNo = `AUTO-${orderNo || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      for (let i = 0; i < quantity; i++) {
        cardsToCreate.push({
          productId,
          content: generateRandomCard(16),
          batchNo: generatedBatchNo,
        });
      }

      // 开启事务
      const result = await prisma.$transaction(async (tx: PrismaClient) => {
        // 批量创建卡密
        await tx.card.createMany({
          data: cardsToCreate,
        });

        // 记录生成记录
        await tx.cardBatchGenerateRecord.create({
          data: {
            productId,
            generateMode: "AUTO",
            generateBy: orderNo || "SYSTEM",
            quantity,
            status: "SUCCESS",
            successCount: quantity,
            cardContents: JSON.stringify(cardsToCreate.map((c) => c.content)),
            batchNo: generatedBatchNo,
          },
        });

        return { count: quantity, batchNo: generatedBatchNo };
      });

      logger.info("card_auto_generate", {
        productId,
        quantity: result.count,
        batchNo: result.batchNo,
        orderNo,
      });

      return c.json({
        success: true,
        message: `成功自动生成 ${result.count} 张卡密`,
        batchNo: result.batchNo,
        count: result.count,
      } as CardBatchGenerateOutput);
    } catch (error) {
      logger.error("card_auto_generate_error", error);
      return c.json({
        success: false,
        message: "服务器自动生成失败，请稍后重试",
        code: "AUTO_GENERATE_SERVER_ERROR",
      } as CardBatchGenerateOutput, 500);
    }
  });
}
