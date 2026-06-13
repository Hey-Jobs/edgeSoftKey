/** Local order cache stored in the buyer's browser. */
const STORAGE_KEY = "local_orders";

export type LocalOrder = {
  orderNo: string;
  queryToken: string;
  productName: string;
  amount: number;
  createdAt: string;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  updatedAt?: string;
};

export function getLocalOrders(): LocalOrder[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveLocalOrders(orders: LocalOrder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, 50)));
}

export function saveLocalOrder(order: LocalOrder) {
  const orders = getLocalOrders().filter((o) => o.orderNo !== order.orderNo);
  orders.unshift(order);
  saveLocalOrders(orders);
}

export function updateLocalOrder(order: Partial<LocalOrder> & Pick<LocalOrder, "orderNo">) {
  const orders = getLocalOrders();
  const index = orders.findIndex((item) => item.orderNo === order.orderNo);

  if (index === -1) {
    return;
  }

  orders[index] = {
    ...orders[index],
    ...order,
    queryToken: order.queryToken ?? orders[index].queryToken,
    updatedAt: new Date().toISOString(),
  };
  saveLocalOrders(orders);
}
