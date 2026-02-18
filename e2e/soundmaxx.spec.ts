import { expect, test } from "@playwright/test";

test("home page renders redesigned sections and actions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Release-ready audio workflows without hidden states/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /A control surface built for speed and trust/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Pick a workflow and start processing now/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Open Tool$/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^View Ops$/ })).toBeVisible();
});

test("desktop header exposes tools navigation", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /^Tools$/ }).click();
  await expect(page.getByRole("link", { name: /Stem Isolation/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mastering/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Key \+ BPM/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Loudness Report/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /MIDI Extraction/i })).toBeVisible();
});

test("mobile navigation exposes route set", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: /toggle menu/i }).click();
  await expect(page.getByRole("link", { name: /^Home$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Ops$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Stem Isolation/i })).toBeVisible();
});

test("tool pages render dedicated controls", async ({ page }) => {
  const scenarios = [
    { path: "/tools/stem-isolation", heading: "Stem Isolation", controlText: /Stem count/i },
    { path: "/tools/mastering", heading: "Mastering", controlText: /Mastering profile/i },
    { path: "/tools/key-bpm", heading: "Key \+ BPM Detection", controlText: /Include chord hints/i },
    { path: "/tools/loudness-report", heading: "Loudness Report", controlText: /Target LUFS/i },
    { path: "/tools/midi-extract", heading: "MIDI Extraction", controlText: /Sensitivity/i },
  ];

  for (const scenario of scenarios) {
    await page.goto(scenario.path);
    await expect(page.getByRole("main").getByRole("heading", { level: 1, name: scenario.heading })).toBeVisible();
    await expect(page.getByRole("main").getByText(scenario.controlText)).toBeVisible();
    await expect(page.getByRole("button", { name: /Run /i })).toBeDisabled();
  }
});

test("invalid tool slug returns not found", async ({ page }) => {
  await page.goto("/tools/not-a-real-tool");
  await expect(page.getByText(/not found|could not be found/i)).toBeVisible();
});
