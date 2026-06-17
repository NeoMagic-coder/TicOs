import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /ticos/i })).toBeVisible();
    await expect(page.getByLabel(/e-posta/i)).toBeVisible();
    await expect(page.getByLabel(/şifre/i)).toBeVisible();
  });

  test("shows validation error on invalid email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill("invalid");
    await page.getByLabel(/şifre/i).fill("123");
    await page.getByRole("button", { name: /giriş/i }).click();
    await expect(page.getByText(/geçerli/i)).toBeVisible();
  });

  test("redirects to dashboard on successful login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill("admin@ticos.com");
    await page.getByLabel(/şifre/i).fill("password123");
    await page.getByRole("button", { name: /giriş/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("redirects authenticated user from login to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta/i).fill("admin@ticos.com");
    await page.getByLabel(/şifre/i).fill("password123");
    await page.getByRole("button", { name: /giriş/i }).click();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
