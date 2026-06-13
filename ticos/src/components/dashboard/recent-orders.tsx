import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants";

interface RecentOrdersProps {
  orders: Array<{
    id: string;
    orderNumber: string;
    platform: string;
    status: string;
    totalAmount: { toNumber: () => number };
    customer: { firstName: string; lastName: string };
    items: Array<{ quantity: number }>;
    createdAt: Date;
  }>;
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">Son Siparişler</h2>
        <Link
          href="/dashboard/orders"
          className="text-sm text-primary hover:underline"
        >
          Tümünü Gör
        </Link>
      </div>
      <div className="divide-y">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/dashboard/orders/${order.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {order.orderNumber}
              </span>
              <span className="text-xs text-muted-foreground">
                {order.customer.firstName} {order.customer.lastName} •{" "}
                {order.items.length} ürün
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
              <span className="text-sm font-medium">
                {formatCurrency(order.totalAmount.toNumber())}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(order.createdAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
