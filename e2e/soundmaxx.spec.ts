import { expect, test } from "@playwright/test";

test("home page renders upload and tool controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Production-grade audio tooling/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload Audio" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Tool" })).toBeVisible();
});
