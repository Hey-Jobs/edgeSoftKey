import { assertAdminAccess } from "../../../modules/auth/service";
import { saveEmailTemplate, resetEmailTemplateToDefault } from "../../../modules/email/service";
import type { EmailScene } from "../../../modules/email/types";

export async function onSaveEmailTemplate(input: {
  scene: "TEST" | "ORDER_PAID" | "DELIVERY_SUCCESS" | "DELIVERY_FAILED";
  name: string;
  subject: string;
  content: string;
  isEnabled: boolean;
}) {
  assertAdminAccess();
  return saveEmailTemplate(input);
}

export async function onResetEmailTemplate(scene: EmailScene) {
  assertAdminAccess();
  return resetEmailTemplateToDefault(scene);
}
