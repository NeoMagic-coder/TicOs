"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { productSchema, type ProductInput } from "@/lib/validations";

export default function NewProductPage() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: ProductInput = {
      name: form.get("name") as string,
      description: form.get("description") as string,
      sku: form.get("sku") as string,
      barcode: form.get("barcode") as string,
      price: Number(form.get("price")),
      cost: form.get("cost") ? Number(form.get("cost")) : undefined,
      stock: Number(form.get("stock")),
      category: form.get("category") as string,
      brand: form.get("brand") as string,
      isActive: true,
    };

    const result = productSchema.safeParse(data);
    if (!result.success) {
      setError(result.error.errors[0].message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      router.push("/dashboard/products");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Yeni Ürün</h1>
        <p className="text-sm text-muted-foreground">
          Ürün bilgilerini girin
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium">Ürün Adı</label>
            <input
              name="name"
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium">Açıklama</label>
            <textarea
              name="description"
              rows={3}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">SKU</label>
            <input
              name="sku"
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Barkod</label>
            <input
              name="barcode"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Fiyat (₺)</label>
            <input
              name="price"
              type="number"
              step="0.01"
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Maliyet (₺)</label>
            <input
              name="cost"
              type="number"
              step="0.01"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Stok</label>
            <input
              name="stock"
              type="number"
              defaultValue={0}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Kategori</label>
            <input
              name="category"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Marka</label>
            <input
              name="brand"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
