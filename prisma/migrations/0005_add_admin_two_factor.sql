-- AlterTable: Add administrator two-factor authentication fields
ALTER TABLE "Admin" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Admin" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "Admin" ADD COLUMN "twoFactorEnabledAt" DATETIME;
