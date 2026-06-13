import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";

async function getProducts(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId },
    include: {
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export default async function ProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const products = await getProducts(session.user.tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ürünler</h1>
          <p className="text-sm text-muted-foreground">
            Tüm ürünlerinizi yönetin
          </p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Ürün Ekle
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Stok</th>
              <th className="px-4 py-3">Fiyat</th>
              <th className="px-4 py-3">Sipariş</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((product) => (
              <tr key={product.id} className="text-sm">
                <td className="px-4 py-3 font-medium">{product.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {product.sku}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      product.stock <= 5
                        ? "font-medium text-destructive"
                        : ""
                    }
                  >
                    {product.stock}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(product.price.toNumber())}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {product._count.orderItems}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      product.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {product.isActive ? "Aktif" : "Pasif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
