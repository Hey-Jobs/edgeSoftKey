import { assertAdminAccess, createAdminTwoFactorSetup, disableAdminTwoFactor, enableAdminTwoFactor } from "../../../modules/auth/service";

export async function onCreateTwoFactorSetup() {
  assertAdminAccess();
  return createAdminTwoFactorSetup();
}

export async function onEnableTwoFactor(input: { secret: string; code: string }) {
  assertAdminAccess();
  return enableAdminTwoFactor(input);
}

export async function onDisableTwoFactor(input: { currentPassword: string; code?: string }) {
  assertAdminAccess();
  return disableAdminTwoFactor(input);
}
