import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PLATFORM_LABELS } from "@/lib/constants";

async function getOrders(tenantId: string) {
  return prisma.order.findMany({
    where: { tenantId },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const orders = await getOrders(session.user.tenantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Siparişler</h1>
        <p className="text-sm text-muted-foreground">
          Tüm siparişleri görüntüleyin ve yönetin
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Sipariş No</th>
              <th className="px-4 py-3">Müşteri</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Tutar</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id} className="text-sm">
                <td className="px-4 py-3 font-medium">
                  {order.orderNumber}
                </td>
                <td className="px-4 py-3">
                  {order.customer.firstName} {order.customer.lastName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {PLATFORM_LABELS[order.platform] ?? order.platform}
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(order.totalAmount.toNumber())}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(order.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
