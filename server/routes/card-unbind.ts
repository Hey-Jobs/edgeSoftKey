import type { Hono } from "hono";
import type { PrismaClient } from "../../generated/prisma/client";
import { getContext } from "telefunc";
import { badRequestError } from "../../lib/app-error";
import { logger } from "../../lib/logger";

interface CardUnbindInput {
  card: string;
}

interface CardUnbindOutput {
  success: boolean;
  message: string;
  code?: string;
  remainingDays?: number;
}

function getCardContext() {
  return getContext<{ prisma: PrismaClient }>();
}

/**
 * 卡密解绑接口
 *
 * 接收卡密信息，执行解绑操作：
 * 1. 验证卡密是否存在且为已售出状态
 * 2. 验证卡密关联的硬件绑定记录
 * 3. 从卡密总有效期中扣除一天时长
 * 4. 删除当前硬件绑定记录（允许重新绑定）
 * 5. 记录解绑操作日志
 *
 * 注意：此接口的"解绑"指的是解除硬件绑定，让卡密可以重新绑定新设备。
 *
 * @postbody { card: string }
 * @returns { success: boolean, message: string, remainingDays?: number, code?: string }
 */
export function registerCardUnbindRoutes(app: Hono) {
  app.post("/api/card/unbind", async (c) => {
    try {
      const { prisma } = getCardContext();
      let body: CardUnbindInput;

      try {
        body = await c.req.json();
      } catch {
        return c.json({
          success: false,
          message: "请求格式错误",
          code: "INVALID_REQUEST",
        } as CardUnbindOutput, 400);
      }

      const { card: cardContent } = body;

      // 参数校验
      if (!cardContent) {
        return c.json({
          success: false,
          message: "卡密不能为空",
          code: "MISSING_PARAMS",
        } as CardUnbindOutput, 400);
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
          message: "卡密不存在",
          code: "CARD_NOT_FOUND",
        } as CardUnbindOutput, 400);
      }

      // 检查卡密状态
      if (card.status !== "SOLD") {
        return c.json({
          success: false,
          message: "该卡密未激活，无需解绑",
          code: "CARD_NOT_SOLD",
        } as CardUnbindOutput, 400);
      }

      // 检查商品是否为卡密类型
      if (card.product.cardType === "NONE") {
        return c.json({
          success: false,
          message: "该商品不支持卡密验证",
          code: "PRODUCT_NOT_CARD_TYPE",
        } as CardUnbindOutput, 400);
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
          message: "卡密有效期信息缺失",
          code: "CARD_VALIDITY_MISSING",
        } as CardUnbindOutput, 500);
      }

      // 查找硬件绑定记录
      const bindings = await prisma.hardwareBinding.findMany({
        where: {
          cardId: card.id,
          productId: card.product.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (bindings.length === 0) {
        return c.json({
          success: false,
          message: "未找到硬件绑定记录",
          code: "NO_BINDING_FOUND",
        } as CardUnbindOutput, 400);
      }

      // 获取客户端IP地址
      const requestIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";

      // 开启事务
      const unbindDays = 1; // 每次解绑扣除一天
      const result = await prisma.$transaction(async (tx: PrismaClient) => {
        // 计算新的到期时间（扣除一天）
        const newExpireAt = new Date(validity.expireAt.getTime() - unbindDays * 24 * 60 * 60 * 1000);

        // 更新有效期记录
        await tx.cardValidity.update({
          where: { id: validity.id },
          data: { expireAt: newExpireAt },
        });

        // 删除硬件绑定记录（解除绑定）
        for (const binding of bindings) {
          await tx.hardwareBinding.delete({
            where: { id: binding.id },
          });
        }

        // 记录解绑日志
        await tx.cardUnbindLog.create({
          data: {
            cardId: card.id,
            unbindDays,
            operatorIp: requestIp,
          },
        });

        // 计算剩余天数
        const now = new Date();
        const remainingMs = newExpireAt.getTime() - now.getTime();
        const remainingDays = Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)));

        return {
          newExpireAt,
          remainingDays,
        };
      });

      logger.info("card_unbind", {
        cardId: card.id,
        productId: card.product.id,
        ip: requestIp,
      });

      return c.json({
        success: true,
        message: "解绑成功，有效期已扣除一天",
        remainingDays: result.remainingDays,
      } as CardUnbindOutput);
    } catch (error) {
      logger.error("card_unbind_error", error);
      return c.json({
        success: false,
        message: "服务器解绑失败，请稍后重试",
        code: "UNBIND_SERVER_ERROR",
      } as CardUnbindOutput, 500);
    }
  });
}
