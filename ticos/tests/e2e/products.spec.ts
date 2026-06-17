import { test, expect } from "@playwright/test";

test.describe("Product Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill("admin@ticos.com");
    await page.getByLabel(/şifre/i).fill("password123");
    await page.getByRole("button", { name: /giriş/i }).click();
  });

  test("shows product list", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(
      page.getByRole("heading", { name: /ürünler/i })
    ).toBeVisible();
  });

  test("can navigate to new product form", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.getByRole("link", { name: /ürün ekle/i }).click();
    await expect(page).toHaveURL(/\/products\/new/);
  });

  test("creates a new product", async ({ page }) => {
    await page.goto("/dashboard/products/new");

    await page.getByLabel(/ürün adı/i).fill("Test Ürünü");
    await page.getByLabel(/sku/i).fill("TEST-001");
    await page.getByLabel(/fiyat/i).fill("199.99");
    await page.getByLabel(/stok/i).fill("50");

    await page.getByRole("button", { name: /kaydet/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/products/);
  });

  test("shows validation error for empty form", async ({ page }) => {
    await page.goto("/dashboard/products/new");
    await page.getByRole("button", { name: /kaydet/i }).click();
    await expect(page.getByText(/zorunludur/i)).toBeVisible();
  });
});
