<template>
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4">
    <section class="card w-full max-w-md bg-base-100 shadow-sm">
      <div class="card-body space-y-4">
        <div>
          <p class="text-sm uppercase tracking-[0.2em] text-primary">EdgeKey Admin</p>
          <h1 class="text-2xl font-bold">后台登录</h1>
        </div>
        <p class="text-sm text-base-content/70">
          使用管理员账号登录后台，进行商品、库存、订单和支付配置管理。
        </p>
        <div v-if="errorMsg" class="alert alert-error text-sm">{{ errorMsg }}</div>
        <div v-else-if="turnstileConfigError" class="alert alert-warning text-sm">{{ turnstileConfigError }}</div>
        <form class="space-y-4" method="post" :action="formAction">
          <input type="hidden" name="csrfToken" :value="csrfToken" />
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">用户名</span>
            <input name="username" class="input input-bordered w-full" placeholder="admin" required />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">密码</span>
            <input name="password" type="password" class="input input-bordered w-full" placeholder="请输入密码" required />
          </label>
          <label v-if="showTwoFactorCode" class="flex flex-col gap-1.5">
            <span class="label-text font-medium">双重认证验证码</span>
            <input
              name="twoFactorCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]{6}"
              maxlength="6"
              class="input input-bordered w-full"
              placeholder="请输入验证器 App 中的 6 位验证码"
              required
            />
          </label>
          <div v-if="turnstileEnabled" class="space-y-2">
            <div
              ref="turnstileContainerRef"
              class="cf-turnstile"
              :data-sitekey="turnstileSiteKey"
              :data-action="turnstileAction"
              data-theme="auto"
            ></div>
            <p class="text-xs text-base-content/60">请先完成人机验证后再登录。</p>
          </div>
          <AppButton type="submit" variant="primary" :loading="loading" :disabled="submitDisabled" block>
            登录后台
          </AppButton>
        </form>
        <div class="rounded-box bg-base-200 p-3 text-xs text-base-content/70">
          首次初始化完成后，请立即前往“个人资料”修改管理员密码。
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppButton from "../../../components/AppButton.vue";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

type TurnstileConfigResponse = {
  enabled?: boolean;
  siteKey?: string | null;
  action?: string | null;
};

type TwoFactorConfigResponse = {
  enabled?: boolean;
};

const csrfToken = ref("");
const loading = ref(true);
const errorMsg = ref("");
const turnstileConfigError = ref("");
const turnstileEnabled = ref(false);
const turnstileSiteKey = ref("");
const turnstileAction = ref("admin_login");
const turnstileToken = ref("");
const turnstileWidgetId = ref<string | null>(null);
const turnstileContainerRef = ref<HTMLElement | null>(null);
const redirectPath = ref("/admin");
const showTwoFactorCode = ref(false);

const ERROR_MAP: Record<string, string> = {
  CredentialsSignin: "用户名或密码错误",
  password_upgrade_failed: "登录成功但密码升级失败，请重置密码后重试",
  turnstile_required: "请先完成人机验证",
  turnstile_invalid: "人机验证未通过，请重试",
  turnstile_invalid_action: "人机验证结果异常，请刷新页面后重试",
  two_factor_required: "账号已启用双重认证，请输入验证码后重新登录",
  two_factor_invalid: "双重认证验证码不正确，请重试",
  two_factor_config_invalid: "双重认证配置异常，请联系管理员",
  AUTH_RATE_LIMITED: "登录过于频繁，请稍后再试",
};

const formAction = computed(() => `/api/auth/callback/credentials?callbackUrl=${encodeURIComponent(redirectPath.value)}`);
const submitDisabled = computed(() => !csrfToken.value || (turnstileEnabled.value && !turnstileToken.value));

function ensureTurnstileScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("TURNSTILE_SCRIPT_LOAD_FAILED")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("TURNSTILE_SCRIPT_LOAD_FAILED")), { once: true });
    document.head.appendChild(script);
  });
}

function renderTurnstileWidget() {
  if (!turnstileEnabled.value || !turnstileSiteKey.value || !turnstileContainerRef.value || !window.turnstile) {
    return;
  }

  if (turnstileWidgetId.value) {
    window.turnstile.remove(turnstileWidgetId.value);
    turnstileWidgetId.value = null;
  }

  turnstileWidgetId.value = window.turnstile.render(turnstileContainerRef.value, {
    sitekey: turnstileSiteKey.value,
    action: turnstileAction.value,
    callback(token: unknown) {
      turnstileToken.value = typeof token === "string" ? token : "";
    },
    "expired-callback"() {
      turnstileToken.value = "";
    },
    "error-callback"() {
      turnstileToken.value = "";
      turnstileConfigError.value = "人机验证加载失败，请刷新页面后重试";
    },
  });
}

async function loadPageData() {
  const params = new URLSearchParams(window.location.search);
  redirectPath.value = params.get("redirect") || "/admin";
  const code = params.get("code") ?? params.get("error");
  if (code) {
    errorMsg.value = ERROR_MAP[code] ?? "登录失败，请重试";
    showTwoFactorCode.value = code === "two_factor_required" || code === "two_factor_invalid";
  }

  const [csrfResponse, turnstileResponse, twoFactorResponse] = await Promise.all([
    fetch("/api/auth/csrf", { credentials: "same-origin" }),
    fetch("/api/turnstile/config", { credentials: "same-origin" }),
    fetch("/api/auth/two-factor-config", { credentials: "same-origin" }),
  ]);

  const csrfData = (await csrfResponse.json()) as { csrfToken?: string };
  csrfToken.value = csrfData.csrfToken ?? "";

  const turnstileData = (await turnstileResponse.json()) as TurnstileConfigResponse;
  turnstileEnabled.value = Boolean(turnstileData.enabled && turnstileData.siteKey);
  turnstileSiteKey.value = turnstileData.siteKey ?? "";
  turnstileAction.value = turnstileData.action || "admin_login";

  const twoFactorData = (await twoFactorResponse.json()) as TwoFactorConfigResponse;
  showTwoFactorCode.value = showTwoFactorCode.value || Boolean(twoFactorData.enabled);

  if (turnstileEnabled.value) {
    await ensureTurnstileScript();
    renderTurnstileWidget();
  }
}

onMounted(async () => {
  try {
    await loadPageData();
  } catch {
    turnstileConfigError.value = "登录页初始化失败，请刷新页面后重试";
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  if (turnstileWidgetId.value && window.turnstile) {
    window.turnstile.remove(turnstileWidgetId.value);
  }
});
</script>
