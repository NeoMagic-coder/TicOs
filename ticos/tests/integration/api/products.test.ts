import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSession = {
  user: {
    id: "user-1",
    tenantId: "tenant-1",
    role: "ADMIN",
    email: "test@ticos.com",
    name: "Test User",
  },
};

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("Products API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/products", () => {
    it("returns products list with pagination", async () => {
      const mockProducts = [
        { id: "1", name: "Test Product", price: 100, stock: 10 },
      ];

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any);
      vi.mocked(prisma.product.count).mockResolvedValue(1);

      const { GET } = await import("@/app/api/products/route");
      const req = new Request("http://localhost:3000/api/products");
      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it("filters by search query", async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.product.count).mockResolvedValue(0);

      const { GET } = await import("@/app/api/products/route");
      const req = new Request("http://localhost:3000/api/products?search=test");
      await GET(req);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.anything() }),
            ]),
          }),
        })
      );
    });
  });

  describe("POST /api/products", () => {
    it("creates a new product", async () => {
      const newProduct = {
        id: "new-id",
        name: "New Product",
        sku: "SKU-001",
        price: 150,
        stock: 20,
        tenantId: "tenant-1",
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.product.create).mockResolvedValue(newProduct as any);

      const { POST } = await import("@/app/api/products/route");
      const req = new Request("http://localhost:3000/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Product",
          sku: "SKU-001",
          price: 150,
          stock: 20,
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it("rejects duplicate SKU", async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: "existing",
      } as any);

      const { POST } = await import("@/app/api/products/route");
      const req = new Request("http://localhost:3000/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Product",
          sku: "SKU-001",
          price: 150,
          stock: 20,
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(409);
    });

    it("validates required fields", async () => {
      const { POST } = await import("@/app/api/products/route");
      const req = new Request("http://localhost:3000/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });
});
