import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { formatCurrency } from "@/lib/utils";

async function getDashboardStats(tenantId: string) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrders,
    monthlyOrders,
    totalCustomers,
    totalProducts,
    pendingOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { tenantId } }),
    prisma.order.count({
      where: { tenantId, createdAt: { gte: firstOfMonth } },
    }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.order.count({
      where: { tenantId, status: "PENDING" },
    }),
  ]);

  const revenueResult = await prisma.order.aggregate({
    where: { tenantId },
    _sum: { totalAmount: true },
  });

  const monthlyRevenueResult = await prisma.order.aggregate({
    where: { tenantId, createdAt: { gte: firstOfMonth } },
    _sum: { totalAmount: true },
  });

  return {
    totalOrders,
    totalRevenue: revenueResult._sum.totalAmount?.toNumber() ?? 0,
    totalCustomers,
    totalProducts,
    pendingOrders,
    monthlyRevenue: monthlyRevenueResult._sum.totalAmount?.toNumber() ?? 0,
  };
}

async function getRecentOrders(tenantId: string) {
  return prisma.order.findMany({
    where: { tenantId },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [stats, recentOrders] = await Promise.all([
    getDashboardStats(session.user.tenantId),
    getRecentOrders(session.user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Hoş geldiniz, {session.user.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Toplam Sipariş"
          value={stats.totalOrders.toString()}
          description="Tüm zamanlar"
        />
        <StatsCard
          title="Aylık Gelir"
          value={formatCurrency(stats.monthlyRevenue)}
          description="Bu ay"
        />
        <StatsCard
          title="Müşteri"
          value={stats.totalCustomers.toString()}
          description="Kayıtlı müşteri"
        />
        <StatsCard
          title="Bekleyen Sipariş"
          value={stats.pendingOrders.toString()}
          description="Aksiyon bekliyor"
        />
      </div>

      <RecentOrders orders={recentOrders} />
    </div>
  );
}
