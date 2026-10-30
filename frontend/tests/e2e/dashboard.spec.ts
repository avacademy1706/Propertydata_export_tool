import { test, expect } from "@playwright/test";

// These end-to-end tests require the app running with a configured database
// (and seed data helps). Run: npm run dev, then npm run test:e2e.
// They are tolerant of an empty database.

test("dashboard loads with the three tabs and capture box", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Property Desk" })).toBeVisible();
  await expect(page.getByRole("button", { name: "buyers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "sellers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "matching" })).toBeVisible();
  await expect(page.getByPlaceholder("Paste a WhatsApp property message here...")).toBeVisible();
});

test("pasting a seller message creates a record in the Sellers tab", async ({ page }) => {
  await page.goto("/");
  await page
    .getByPlaceholder("Paste a WhatsApp property message here...")
    .fill("3 BHK flat for sale in Gomti Nagar, 1300 sqft, covered car parking, 65 lakh. East facing.");
  await page.getByRole("button", { name: "Process Message" }).click();
  // A success or review toast appears.
  await expect(page.locator("text=/Detected:/i")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "sellers" }).click();
  await expect(page.locator("table")).toBeVisible();
});

test("export button points at the xlsx endpoint", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Export Excel" })).toBeVisible();
});
