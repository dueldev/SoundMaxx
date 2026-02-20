import { expect, test } from "@playwright/test";

test("home page renders redesigned sections and actions", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  const openStudioLinks = main.getByRole("link", { name: /^Open Studio$/ });

  await expect(main.getByRole("heading", { level: 1, name: /Professional Audio Tools\.\s*All Signal\.\s*No Noise\./i })).toBeVisible();
  await expect(main.getByRole("heading", { level: 2, name: /Why SoundMaxx/i })).toBeVisible();
  await expect(main.getByRole("heading", { level: 2, name: /The Tools/i })).toBeVisible();
  await expect(openStudioLinks.first()).toBeVisible();
  await expect(openStudioLinks).toHaveCount(2);
  await expect(main.getByRole("link", { name: /^Explore Tools$/ })).toBeVisible();
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
  const mobileToggle = page.getByRole("button", { name: /^Toggle menu$/i });

  await mobileToggle.click();
  await expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /^Home$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Privacy Preferences$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^01 Stem Isolation$/ })).toBeVisible();
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
