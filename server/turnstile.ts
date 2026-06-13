import { badRequestError, externalServiceError } from "../lib/app-error";
import { logger } from "../lib/logger";

export const TURNSTILE_ACTION = "admin_login" as const;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileConfig = {
  enabled: boolean;
  siteKey: string | null;
  secretKey: string | null;
};

type TurnstileVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
  metadata?: {
    ephemeral_id?: string;
  };
};

export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() || null;
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim() || null;

  if (!siteKey && !secretKey) {
    return {
      enabled: false,
      siteKey: null,
      secretKey: null,
    };
  }

  if (!siteKey || !secretKey) {
    logger.warn("turnstile.config.incomplete", {
      hasSiteKey: Boolean(siteKey),
      hasSecretKey: Boolean(secretKey),
    });

    return {
      enabled: false,
      siteKey,
      secretKey,
    };
  }

  return {
    enabled: true,
    siteKey,
    secretKey,
  };
}

export async function verifyTurnstileToken(input: {
  token: string;
  remoteIp?: string | null;
  expectedAction?: string;
}): Promise<void> {
  const config = getTurnstileConfig();

  if (!config.enabled || !config.secretKey) {
    return;
  }

  const token = input.token.trim();
  if (!token) {
    throw badRequestError("请先完成人机验证", "turnstile_required");
  }

  const body = new URLSearchParams({
    secret: config.secretKey,
    response: token,
  });

  if (input.remoteIp) {
    body.set("remoteip", input.remoteIp);
  }

  let result: TurnstileVerifyResponse;

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    result = (await response.json()) as TurnstileVerifyResponse;

    if (!response.ok) {
      logger.warn("turnstile.verify.http_error", {
        status: response.status,
        result,
      });
      throw externalServiceError("人机验证服务暂时不可用，请稍后再试", "TURNSTILE_HTTP_ERROR");
    }
  } catch (error) {
    logger.error("turnstile.verify.request_failed", { error });
    throw externalServiceError("人机验证服务请求失败，请稍后再试", "TURNSTILE_REQUEST_FAILED", {
      cause: error,
    });
  }

  if (!result.success) {
    logger.warn("turnstile.verify.failed", {
      errorCodes: result["error-codes"],
      action: result.action,
      hostname: result.hostname,
    });
    throw badRequestError("人机验证未通过，请重试", "turnstile_invalid", {
      details: {
        errorCodes: result["error-codes"],
      },
    });
  }

  if (input.expectedAction && result.action && result.action !== input.expectedAction) {
    logger.warn("turnstile.verify.action_mismatch", {
      expectedAction: input.expectedAction,
      actualAction: result.action,
    });
    throw badRequestError("人机验证结果异常，请刷新页面后重试", "turnstile_invalid_action");
  }
}

export function getClientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return request.headers.get("cf-connecting-ip") || forwarded?.split(",")[0]?.trim() || "unknown";
}
