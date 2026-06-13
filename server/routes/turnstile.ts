import type { Hono } from "hono";
import { getTurnstileConfig, TURNSTILE_ACTION } from "../turnstile";

export function registerTurnstileRoutes(app: Hono) {
  app.get("/api/turnstile/config", (c) => {
    const config = getTurnstileConfig();

    return c.json({
      enabled: config.enabled,
      siteKey: config.enabled ? config.siteKey : null,
      action: TURNSTILE_ACTION,
    });
  });
}
