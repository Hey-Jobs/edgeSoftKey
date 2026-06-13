-- Add delivery configuration fields for fixed-content and manual-delivery products.
ALTER TABLE "Product" ADD COLUMN "fixedDeliveryContent" TEXT;
ALTER TABLE "Product" ADD COLUMN "manualDeliveryHint" TEXT;
