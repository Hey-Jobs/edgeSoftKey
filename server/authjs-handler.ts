import { Auth, type AuthConfig, createActionURL, setEnvDefaults } from "@auth/core";
import { CredentialsSignin } from "@auth/core/errors";
import CredentialsProvider from "@auth/core/providers/credentials";
import type { Session } from "@auth/core/types";
import { enhance, type UniversalHandler, type UniversalMiddleware } from "@universal-middleware/core";
import { PrismaClient } from "../generated/prisma/client";
import { badRequestError, internalServerError, rateLimitError } from "../lib/app-error";
import { logger } from "../lib/logger";
import { verifyAdminPassword, hashAdminPassword } from "../modules/auth/crypto";
import { verifyTotpCode } from "../modules/auth/totp";
import { getSiteSetting } from "../modules/site/service";
import { getClientIpFromRequest, TURNSTILE_ACTION, verifyTurnstileToken } from "./turnstile";

const ADMIN_ROLE = "admin" as const;
const loginAttemptStore = new Map<string, { count: number; expiresAt: number }>();

interface AuthContext {
  prisma: PrismaClient;
  session?: Session | null;
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw internalServerError("认证配置缺失", "AUTH_SECRET_MISSING", {
      details: {
        envKeys: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
      },
    });
  }

  return secret;
}

async function resolveAuthUrl(prisma: PrismaClient): Promise<string | undefined> {
  try {
    const site = await getSiteSetting(prisma);
    const siteUrl = site.siteUrl?.trim().replace(/\/+$/, "");
    if (siteUrl) {
      return siteUrl;
    }
  } catch {
    // ignore, fallback to default behavior
  }
}

function rewriteRequestUrl(request: Request, origin: string): Request {
  const url = new URL(request.url);
  const newUrl = `${origin}${url.pathname}${url.search}`;
  return new Request(newUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-expect-error CF Workers specific
    duplex: "half",
  });
}

function getLoginRateLimitConfig() {
  // 登录尝试次数限制配置,默认 10 次/10 分钟
  const maxAttempts = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 10);
  const windowMs = Number(process.env.ADMIN_LOGIN_WINDOW_MS || 10 * 60 * 1000);

  return {
    maxAttempts: Number.isFinite(maxAttempts) ? maxAttempts : 10,
    windowMs: Number.isFinite(windowMs) ? windowMs : 10 * 60 * 1000,
  };
}

function isCredentialsCallbackRequest(request: Request) {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname.endsWith("/api/auth/callback/credentials");
}

async function assertTurnstileValid(request: Request) {
  const clonedRequest = request.clone();
  const contentType = clonedRequest.headers.get("content-type") || "";

  if (!contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) {
    throw badRequestError("登录请求格式不正确", "AUTH_INVALID_CONTENT_TYPE");
  }

  const formData = await clonedRequest.formData();
  const tokenValue = formData.get("cf-turnstile-response");
  const token = typeof tokenValue === "string" ? tokenValue : "";

  await verifyTurnstileToken({
    token,
    remoteIp: getClientIpFromRequest(request),
    expectedAction: TURNSTILE_ACTION,
  });
}

function isRateLimited(request: Request) {
  const { maxAttempts, windowMs } = getLoginRateLimitConfig();
  const now = Date.now();
  const key = getClientIpFromRequest(request);
  const current = loginAttemptStore.get(key);

  if (!current || current.expiresAt <= now) {
    loginAttemptStore.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  current.count += 1;
  loginAttemptStore.set(key, current);
  return current.count > maxAttempts;
}

async function findAdminByCredentials(prisma: PrismaClient, username: string, password: string, twoFactorCode?: string) {
  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return null;
  }

  const valid = await verifyAdminPassword(password, admin.passwordHash);
  if (!valid) {
    return null;
  }

  if (admin.twoFactorEnabled) {
    if (!admin.twoFactorSecret) {
      const err = new CredentialsSignin("双重认证配置异常，请联系管理员");
      err.code = "two_factor_config_invalid";
      throw err;
    }

    const codeValid = await verifyTotpCode({ secret: admin.twoFactorSecret, code: twoFactorCode ?? "" });
    if (!codeValid) {
      const err = new CredentialsSignin("请输入正确的双重认证验证码");
      err.code = twoFactorCode ? "two_factor_invalid" : "two_factor_required";
      throw err;
    }
  }

  // 旧 SHA-256 哈希自动升级为 bcrypt
  if (!admin.passwordHash.startsWith("$2b$") && !admin.passwordHash.startsWith("$2a$")) {
    try {
      const newHash = await hashAdminPassword(password);
      await prisma.admin.update({ where: { username }, data: { passwordHash: newHash } });
    } catch (e) {
      logger.error("auth.password_upgrade.failed", { error: e });
      const err = new CredentialsSignin("哈希字符串升级失败，请参考官网文档重置管理员密码");
      err.code = "password_upgrade_failed";
      throw err;
    }
  }

  return {
    id: String(admin.id),
    name: admin.nickname || admin.username,
    username: admin.username,
    role: ADMIN_ROLE,
  };
}

export function createAuthjsConfig(prisma: PrismaClient) {
  return {
    basePath: "/api/auth",
    trustHost: true,
    secret: getAuthSecret(),
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/admin/login",
    },
    providers: [
      CredentialsProvider({
        name: "Credentials",
        credentials: {
          username: { label: "Username", type: "text", placeholder: "admin" },
          password: { label: "Password", type: "password" },
          twoFactorCode: { label: "Two-factor code", type: "text" },
        },
        async authorize(credentials) {
          const usernameRaw = credentials?.username;
          const passwordRaw = credentials?.password;
          const twoFactorCodeRaw = credentials?.twoFactorCode;
          const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
          const password = typeof passwordRaw === "string" ? passwordRaw : "";
          const twoFactorCode = typeof twoFactorCodeRaw === "string" ? twoFactorCodeRaw.trim() : "";

          if (!username || !password) {
            return null;
          }

          return findAdminByCredentials(prisma, username, password, twoFactorCode);
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.username = user.username;
          token.role = user.role;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = typeof token.id === "string" ? token.id : undefined;
          session.user.username = typeof token.username === "string" ? token.username : undefined;
          session.user.role = token.role === ADMIN_ROLE ? ADMIN_ROLE : undefined;
        }
        return session;
      },
    },
  } satisfies Omit<AuthConfig, "raw">;
}

/**
 * Retrieve Auth.js session from Request
 */
export async function getSession(req: Request, config: Omit<AuthConfig, "raw">): Promise<Session | null> {
  setEnvDefaults(process.env, config);
  const requestURL = new URL(req.url);
  const url = createActionURL("session", requestURL.protocol, req.headers, process.env, config);

  const response = await Auth(new Request(url, { headers: { cookie: req.headers.get("cookie") ?? "" } }), config);

  const { status = 200 } = response;

  const data = await response.json();

  if (!data || !Object.keys(data).length) return null;
  if (status === 200) return data as Session;
  throw internalServerError(typeof data === "object" && "message" in data ? (data.message as string) : undefined, "AUTH_SESSION_REQUEST_FAILED", {
    details: {
      status,
    },
  });
}

// Note: You can directly define a server middleware instead of defining a Universal Middleware. (You can remove @universal-middleware/* — Vike's scaffolder uses it only to simplify its internal logic, see https://github.com/vikejs/vike/discussions/3116)
/**
 * Add Auth.js session to the context.
 * @link {@see https://authjs.dev/getting-started/session-management/get-session}
 */
export const authjsSessionMiddleware: UniversalMiddleware = enhance(
  // The context we add here is automatically merged into pageContext
  async (request, context) => {
    try {
      const authContext = context as unknown as AuthContext;
      const siteOrigin = await resolveAuthUrl(authContext.prisma);
      const req = siteOrigin ? rewriteRequestUrl(request, siteOrigin) : request;
      const config = createAuthjsConfig(authContext.prisma);
      return {
        ...authContext,
        // Sets pageContext.session
        session: await getSession(req, config),
      };
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), {
        event: "auth.session.middleware_failed",
      });
      return {
        ...context,
        session: null,
      };
    }
  },
  {
    name: "my-app:authjs-middleware",
    immutable: false,
  },
);

function isAdminPageContextRequest(url: string): boolean {
  const parsed = new URL(url);
  return /^\/admin\/.*\.pageContext\.json$/.test(parsed.pathname);
}

export const adminAuthMiddleware: UniversalMiddleware = enhance(
  async (request, context) => {
    const ctx = context as unknown as AuthContext & { url?: string };
    const url = ctx.url ?? request.url;

    if (!isAdminPageContextRequest(url)) {
      return context;
    }

    if (ctx.session?.user?.role === "admin") {
      return context;
    }

    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  },
  {
    name: "my-app:admin-auth",
    immutable: false,
  },
);

// Note: You can directly define a server middleware instead of defining a Universal Middleware. (You can remove @universal-middleware/* — Vike's scaffolder uses it only to simplify its internal logic, see https://github.com/vikejs/vike/discussions/3116)
/**
 * Auth.js route
 * @link {@see https://authjs.dev/getting-started/installation}
 **/
export const authjsHandler = enhance(
  async (request, context) => {
    const authContext = context as unknown as AuthContext;
    const siteOrigin = await resolveAuthUrl(authContext.prisma);
    const req = siteOrigin ? rewriteRequestUrl(request, siteOrigin) : request;

    if (isCredentialsCallbackRequest(req)) {
      if (isRateLimited(req)) {
        const error = rateLimitError("Too Many Requests", "AUTH_RATE_LIMITED");
        return new Response(error.message, {
          status: error.statusCode,
        });
      }

      try {
        await assertTurnstileValid(req);
      } catch (error) {
        const appError = error instanceof Error ? error : new Error(String(error));
        logger.warn(appError, {
          event: "auth.turnstile.validation_failed",
        });

        const url = new URL(req.url);
        const callbackUrl = url.searchParams.get("callbackUrl") || "/admin";
        const redirectUrl = new URL("/admin/login", siteOrigin ?? url.origin);
        redirectUrl.searchParams.set("error", error instanceof Error && "code" in error && typeof (error as { code?: unknown }).code === "string"
          ? String((error as { code?: string }).code)
          : "turnstile_invalid");
        redirectUrl.searchParams.set("redirect", callbackUrl);
        return Response.redirect(redirectUrl.toString(), 302);
      }
    }

    return Auth(req, createAuthjsConfig(authContext.prisma));
  },
  {
    name: "my-app:authjs-handler",
    path: "/api/auth/**",
    method: ["GET", "POST"],
    immutable: false,
  },
) satisfies UniversalHandler;
