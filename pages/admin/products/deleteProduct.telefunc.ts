import { assertAdminAccess } from "../../../modules/auth/service";
import { deleteProduct } from "../../../modules/catalog/service";

export async function onDeleteProduct(input: { id: number }) {
  assertAdminAccess();
  return deleteProduct(input);
}
