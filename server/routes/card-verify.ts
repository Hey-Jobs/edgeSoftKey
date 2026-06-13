import type { Hono } from "hono";
import type { PrismaClient } from "../../generated/prisma/client";
import { getContext } from "telefunc";
import { badRequestError, notFoundError, conflictError, internalServerError } from "../../lib/app-error";
import { logger } from "../../lib/logger";

interface CardVerifyInput {
  card: string;
  hardwareHash: string;
  cpuInfo?: string;
  memoryInfo?: string;
  gpuInfo?: string;
  motherboardInfo?: string;
}

interface CardVerifyOutput {
  success: boolean;
  message: string;
  expireAt?: string;
  code?: string;
}

function getCardContext() {
  return getContext<{ prisma: PrismaClient }>();
}

/**
 * 卡密验证接口
 *
 * 接收软件端传递的硬件加密信息和卡密，执行以下验证逻辑：
 * 1. 验证卡密是否存在且状态可用（UNUSED 或 SOLD）
 * 2. 如果卡密已绑定硬件（SOLD 状态），检查硬件信息是否匹配
 * 3. 首次验证（UNUSED 状态）：激活卡密，绑定硬件信息，计算并记录到期时间
 * 4. 非首次验证（SOLD 状态）：验证硬件信息匹配性
 * 5. 返回到期时间或错误信息
 *
 * @postbody { card: string, hardwareHash: string, cpuInfo?: string, memoryInfo?: string, gpuInfo?: string, motherboardInfo?: string }
 * @returns { success: boolean, message: string, expireAt?: string, code?: string }
 */
export function registerCardVerifyRoutes(app: Hono) {
  app.post("/api/card/verify", async (c) => {
    try {
      const { prisma } = getCardContext();
      let body: CardVerifyInput;

      try {
        body = await c.req.json();
      } catch {
        return c.json({ success: false, message: "请求格式错误", code: "INVALID_REQUEST" } as CardVerifyOutput, 400);
      }

      const { card: cardContent, hardwareHash, cpuInfo, memoryInfo, gpuInfo, motherboardInfo } = body;

      // 参数校验
      if (!cardContent || !hardwareHash) {
        return c.json({
          success: false,
          message: "卡密和硬件信息不能为空",
          code: "MISSING_PARAMS",
        } as CardVerifyOutput, 400);
      }

      // 查找卡密
      const card = await prisma.card.findFirst({
        where: {
          content: cardContent.trim(),
        },
        include: {
          product: true,
        },
      });

      if (!card) {
        return c.json({
          success: false,
          message: "卡密不存在，请检查后重试",
          code: "CARD_NOT_FOUND",
        } as CardVerifyOutput, 400);
      }

      // 检查卡密状态
      if (card.status === "DISABLED") {
        return c.json({
          success: false,
          message: "该卡密已被禁用，请联系客服",
          code: "CARD_DISABLED",
        } as CardVerifyOutput, 403);
      }

      if (card.status === "LOCKED") {
        return c.json({
          success: false,
          message: "该卡密正在使用中，请稍后再试",
          code: "CARD_LOCKED",
        } as CardVerifyOutput, 409);
      }

      const product = card.product;

      // 检查商品是否为卡密类型
      if (product.cardType === "NONE") {
        return c.json({
          success: false,
          message: "该商品不支持卡密验证",
          code: "PRODUCT_NOT_CARD_TYPE",
        } as CardVerifyOutput, 400);
      }

      const durationDays = product.durationDays || 30;

      // 情况1：首次验证（UNUSED 状态）
      if (card.status === "UNUSED") {
        // 计算到期时间
        const expireAt = new Date();
        expireAt.setDate(expireAt.getDate() + durationDays);

        // 开启事务：更新卡密状态 + 创建有效期记录 + 创建硬件绑定
        const result = await prisma.$transaction(async (tx: PrismaClient) => {
          // 更新卡密状态为已售出
          await tx.card.update({
            where: { id: card.id },
            data: {
              status: "SOLD",
              orderId: null, // 卡密验证不关联订单
              soldAt: new Date(),
            },
          });

          // 创建有效期绑定记录
          await tx.cardValidity.create({
            data: {
              cardId: card.id,
              productId: product.id,
              expireAt,
            },
          });

          // 创建硬件绑定记录
          await tx.hardwareBinding.create({
            data: {
              cardId: card.id,
              productId: product.id,
              hardwareHash,
              cpuInfo: cpuInfo || null,
              memoryInfo: memoryInfo || null,
              gpuInfo: gpuInfo || null,
              motherboardInfo: motherboardInfo || null,
            },
          });

          return { expireAt };
        });

        logger.info("card_verify_first_time", {
          cardId: card.id,
          productId: product.id,
          durationDays,
        });

        return c.json({
          success: true,
          message: "卡密激活成功",
          expireAt: result.expireAt.toISOString(),
        } as CardVerifyOutput);
      }

      // 情况2：非首次验证（SOLD 状态）
      if (card.status === "SOLD") {
        // 查找硬件绑定记录
        const bindings = await prisma.hardwareBinding.findMany({
          where: {
            cardId: card.id,
            productId: product.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        });

        const latestBinding = bindings[0];

        if (!latestBinding) {
          // 异常情况：卡密已售出但无硬件绑定记录
          return c.json({
            success: false,
            message: "卡密状态异常，请联系客服",
            code: "CARD_STATUS_EXCEPTION",
          } as CardVerifyOutput, 500);
        }

        // 检查硬件信息是否匹配
        if (latestBinding.hardwareHash !== hardwareHash) {
          return c.json({
            success: false,
            message: "硬件信息不匹配，该卡密已绑定其他设备",
            code: "HARDWARE_MISMATCH",
          } as CardVerifyOutput, 403);
        }

        // 查找有效期记录
        const validity = await prisma.cardValidity.findFirst({
          where: {
            cardId: card.id,
          },
        });

        if (!validity) {
          return c.json({
            success: false,
            message: "卡密有效期信息缺失，请联系客服",
            code: "CARD_VALIDITY_MISSING",
          } as CardVerifyOutput, 500);
        }

        // 更新最后验证时间
        await prisma.hardwareBinding.update({
          where: { id: latestBinding.id },
          data: { lastVerifiedAt: new Date() },
        });

        // 检查是否过期
        const now = new Date();
        if (now > validity.expireAt) {
          // 更新硬件绑定状态为过期
          await prisma.hardwareBinding.update({
            where: { id: latestBinding.id },
            data: { status: "EXPIRED" },
          });

          return c.json({
            success: false,
            message: "卡密已过期，请续费后使用",
            code: "CARD_EXPIRED",
            expireAt: validity.expireAt.toISOString(),
          } as CardVerifyOutput);
        }

        // 验证通过
        return c.json({
          success: true,
          message: "验证通过",
          expireAt: validity.expireAt.toISOString(),
        } as CardVerifyOutput);
      }

      // 其他状态
      return c.json({
        success: false,
        message: `卡密状态异常: ${card.status}`,
        code: "CARD_STATUS_INVALID",
      } as CardVerifyOutput, 400);
    } catch (error) {
      logger.error("card_verify_error", error);
      return c.json({
        success: false,
        message: "服务器验证失败，请稍后重试",
        code: "VERIFY_SERVER_ERROR",
      } as CardVerifyOutput, 500);
    }
  });
}
