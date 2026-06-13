import { previewDiscount } from "../../../modules/discount/service";

export async function onPreviewDiscount(code: string, productId: number, amount: number) {
  return previewDiscount(code, productId, amount);
}
