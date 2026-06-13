import { getOrdersForLocalCache } from "../../modules/order/service";

export async function onSyncLocalOrders(input: { orders: Array<{ orderNo: string; queryToken: string }> }) {
  return getOrdersForLocalCache(input.orders);
}
