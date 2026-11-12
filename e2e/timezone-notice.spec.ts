import { expect, test } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  localStackIsRunning,
  readRows,
  setTimezone,
  signIn,
  type TestUser,
} from "./support/test-users";

/**
 * The device time zone offer (AUTH-3): shown only when the device and the
 * profile disagree, and the profile changes only after the user taps.
 */

let stackUp = false;
const created: TestUser[] = [];

test.beforeAll(async () => {
  stackUp = await localStackIsRunning();
});

test.afterAll(async () => {
  await Promise.all(created.map(deleteTestUser));
});

async function userWithZone(label: string, timezone: string): Promise<TestUser> {
  const user = await createTestUser(label, true);
  created.push(user);
  await setTimezone(user, timezone);

  return user;
}

test.describe("device at Asia/Makassar", () => {
  test.use({ timezoneId: "Asia/Makassar" });

  test("zona sama: banner tidak muncul", async ({ page }) => {
    test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

    await signIn(page.context(), await userWithZone("tz-sama", "Asia/Makassar"));
    await page.goto("/today");

    // The offer is decided after hydration, so wait for it before asserting absence.
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByRole("region", { name: "Timezone perangkat" })).toHaveCount(0);
  });

  test("zona beda: banner muncul, Nanti menyembunyikan tanpa mengubah profil", async ({ page }) => {
    test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

    const user = await userWithZone("tz-nanti", "Asia/Jakarta");
    await signIn(page.context(), user);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/today");

    const notice = page.getByRole("region", { name: "Timezone perangkat" });
    await expect(notice).toContainText("Asia/Makassar");
    await expect(notice).toContainText("Asia/Jakarta");

    await notice.getByRole("button", { name: "Nanti" }).click();
    await expect(notice).toHaveCount(0);

    expect(await readRows("profiles", `id=eq.${user.id}&select=timezone`)).toEqual([{ timezone: "Asia/Jakarta" }]);
  });

  test("zona beda: Ganti timezone menyimpan zona perangkat dan banner hilang", async ({ page }) => {
    test.skip(!stackUp, "Supabase lokal belum jalan (npx supabase start)");

    const user = await userWithZone("tz-ganti", "Asia/Jakarta");
    await signIn(page.context(), user);
    await page.goto("/today");

    const notice = page.getByRole("region", { name: "Timezone perangkat" });
    await notice.getByRole("button", { name: "Ganti timezone" }).click();
    await expect(notice).toHaveCount(0);

    expect(await readRows("profiles", `id=eq.${user.id}&select=timezone`)).toEqual([{ timezone: "Asia/Makassar" }]);
  });
});
