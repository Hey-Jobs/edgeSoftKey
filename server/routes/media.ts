import type { Hono } from "hono";
import { getPrismaForD1 } from "../prisma-factory";
import { getSession, createAuthjsConfig } from "../authjs-handler";
import { handleUpload } from "../../modules/media/service";
import { getMediaByKey } from "../../modules/media/repository";
import { getS3ConfigRecord } from "../../modules/media/repository";
import { createS3ClientFromConfig } from "../../lib/s3/client";
import { toErrorResponsePayload } from "../../lib/app-error";
import { logger } from "../../lib/logger";

export function registerMediaRoutes(app: Hono) {
  /**
   * POST /api/media/upload
   * File upload endpoint using multipart form data
   * Requires admin authentication (checked via Auth.js session)
   */
  app.post("/api/media/upload", async (c) => {
    try {
      const database = (c.env as { DB?: D1Database } | undefined)?.DB;
      if (!database) {
        return c.json({ message: "数据库绑定缺失", code: "D1_BINDING_MISSING" }, 500);
      }
      const prisma = getPrismaForD1(database);

      // Verify admin session using Auth.js
      const authConfig = createAuthjsConfig(prisma);
      const session = await getSession(c.req.raw, authConfig);

      if (!session?.user || (session.user as any).role !== "admin") {
        return c.json({ message: "请先登录管理员账号", code: "UNAUTHORIZED" }, 401);
      }

      const adminId = Number(session.user.id);
      if (!Number.isFinite(adminId) || adminId <= 0) {
        return c.json({ message: "会话无效", code: "INVALID_SESSION" }, 401);
      }

      // Parse multipart form data
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;
      const path = (formData.get("path") as string) || undefined;

      if (!file) {
        return c.json({ message: "请选择要上传的文件", code: "FILE_REQUIRED" }, 400);
      }

      // Upload file
      const media = await handleUpload(prisma, adminId, file, path);

      return c.json({
        success: true,
        message: "文件上传成功",
        data: media,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        event: "media.upload.failed",
      });
      const payload = toErrorResponsePayload(error);
      return c.json(payload, payload.statusCode as any);
    }
  });

  /**
   * GET /media/proxy/*
   * Proxy media file from S3 through Worker domain.
   * Uses /media/ prefix (not /api/) so Cloudflare treats it as static
   * content and caches it at the edge.
   * This endpoint is public - no auth required (files are served publicly).
   */
  app.get("/media/proxy/*", async (c) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cache: Cache = (caches as any).default;

      // 1. Check edge cache first — skip S3 and D1 entirely on hit
      const cached = await cache.match(c.req.raw);
      if (cached) {
        return cached;
      }

      const database = (c.env as { DB?: D1Database } | undefined)?.DB;
      if (!database) {
        return c.json({ message: "数据库绑定缺失", code: "D1_BINDING_MISSING" }, 500);
      }
      const prisma = getPrismaForD1(database);

      // Extract the key from the URL path
      const fullPath = c.req.path;
      const keyPrefix = "/media/proxy/";
      const fileKey = fullPath.substring(fullPath.indexOf(keyPrefix) + keyPrefix.length);

      if (!fileKey) {
        return c.json({ message: "文件路径无效", code: "INVALID_KEY" }, 400);
      }

      // Look up the media record
      const media = await getMediaByKey(prisma, fileKey);
      if (!media) {
        return c.json({ message: "文件不存在", code: "NOT_FOUND" }, 404);
      }

      // Get S3 config
      const s3Config = await getS3ConfigRecord(prisma);
      if (!s3Config) {
        return c.json({ message: "S3 配置缺失", code: "S3_CONFIG_MISSING" }, 500);
      }

      // Fetch from S3 with retry for transient errors
      const s3Client = createS3ClientFromConfig(s3Config);
      const MAX_RETRIES = 2;
      const RETRY_DELAY_MS = 500;

      let lastError: Error | null = null;
      let s3Response: Response | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          s3Response = await s3Client.getObject(fileKey);

          // Success - break out of retry loop
          if (s3Response.ok) break;

          // 404 is not retryable - file doesn't exist in S3
          if (s3Response.status === 404) {
            logger.warn("S3 文件不存在", {
              event: "media.proxy.s3_not_found",
              fileKey,
              mediaId: media.id,
            });
            return c.json({ message: "文件不存在于存储中", code: "S3_NOT_FOUND" }, 404);
          }

          // 403 is not retryable - credentials issue
          if (s3Response.status === 403) {
            logger.warn("S3 认证失败", {
              event: "media.proxy.s3_forbidden",
              fileKey,
              status: s3Response.status,
            });
            return c.json({ message: "存储服务认证失败", code: "S3_FORBIDDEN" }, 502);
          }

          // Other errors (500, 503, 429 etc.) are retryable
          const errorText = await s3Response.text().catch(() => "");
          lastError = new Error(`S3 返回 ${s3Response.status}: ${errorText}`);

          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          }
        }
      }

      // All retries exhausted
      if (!s3Response || !s3Response.ok) {
        logger.error(lastError || new Error("S3 request failed after retries"), {
          event: "media.proxy.s3_failed",
          fileKey,
          mediaId: media.id,
          attempts: MAX_RETRIES + 1,
        });
        return c.json({ message: "存储服务暂时不可用，请稍后重试", code: "S3_ERROR" }, 502);
      }

      // Buffer the entire S3 response body before returning.
      // If we return the raw ReadableStream and the S3 connection drops
      // mid-transfer, the stream error propagates to the Worker runtime
      // (outside Hono's try-catch), causing "Worker threw exception".
      // Buffering first ensures all errors are caught here.
      let body: ArrayBuffer;
      try {
        body = await s3Response.arrayBuffer();
      } catch (err) {
        logger.error(err instanceof Error ? err : new Error(String(err)), {
          event: "media.proxy.stream_error",
          fileKey,
          mediaId: media.id,
        });
        return c.json({ message: "读取文件内容失败", code: "STREAM_ERROR" }, 502);
      }

      if (body.byteLength === 0) {
        logger.warn("S3 返回空响应体", {
          event: "media.proxy.empty_body",
          fileKey,
          mediaId: media.id,
        });
        return c.json({ message: "文件内容为空", code: "EMPTY_BODY" }, 502);
      }

      // Build response with Cache-Control header
      const headers = new Headers();
      headers.set("Content-Type", media.mimeType);
      headers.set("Content-Length", String(body.byteLength));
      headers.set("Cache-Control", s3Config.cacheControl);
      headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(media.originalName)}"`);

      const etag = s3Response.headers.get("ETag");
      if (etag) {
        headers.set("ETag", etag);
      }

      const response = new Response(body, {
        status: 200,
        headers,
      });

      // 2. Write to edge cache (clone because put() consumes the body)
      // Only cache successful responses with cacheable Cache-Control
      c.executionCtx.waitUntil(cache.put(c.req.raw, response.clone()));

      return response;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        event: "media.proxy.failed",
      });
      return c.json({ message: "获取文件失败", code: "INTERNAL_ERROR" }, 500);
    }
  });
}
