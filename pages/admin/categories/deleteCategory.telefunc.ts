import { assertAdminAccess } from "../../../modules/auth/service";
import { deleteCategory } from "../../../modules/catalog/service";

export async function onDeleteCategory(input: { id: number }) {
  assertAdminAccess();
  return deleteCategory(input);
}
