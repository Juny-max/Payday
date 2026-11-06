import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({
  args: ["scripts/desktop-harness.cjs"],
  env,
});
try {
  const page = await desktop.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Start payday allocation" }).waitFor();
  assert.equal(
    await page.evaluate(() => typeof window.payday.load),
    "function",
  );
  await page.getByRole("button", { name: "Start payday allocation", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Take-home salary" }).fill("3000");
  await page
    .getByRole("spinbutton", { name: "Daily in & out fare" })
    .fill("25");
  await page.getByRole("spinbutton", { name: "Days per week" }).fill("5");
  await page.getByRole("button", { name: "Save payday", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Payday saved." }).waitFor();
  const dir = await desktop.evaluate(({ app }) => app.getPath("userData"));
  const v = JSON.parse(
    await readFile(path.join(dir, "payday-vault.json"), "utf8"),
  );
  assert.equal(v.format, "payday.encrypted.v1");
  assert.ok(!JSON.stringify(v).includes("savingsBalance"));

  await page.reload();
  await page.getByRole("button", { name: "Start payday allocation" }).waitFor();
  const loaded = await page.evaluate(() => window.payday.load());
  assert.equal(loaded.vault.savingsBalance, 450);
  const aiError = await page.evaluate(async () => {
    try {
      await window.payday.ai(
        "Plan my month",
        (await window.payday.load()).vault.plan,
      );
      return "";
    } catch (e) {
      return e.message;
    }
  });
  assert.match(aiError, /API key/);
  await page.evaluate(() =>
    window.payday.setKey("test-key-not-a-real-google-key"),
  );
  const keyFile = await readFile(path.join(dir, "payday-key.json"), "utf8");
  assert.ok(!keyFile.includes("test-key-not-a-real-google-key"));
  assert.equal((await page.evaluate(() => window.payday.load())).hasKey, true);
  await page.evaluate(() => window.payday.export());
  const backup = JSON.parse(
    await readFile(path.join(dir, "backup.json"), "utf8"),
  );
  assert.equal(backup.format, "payday.encrypted.v1");
  const decoded = await page.evaluate(
    (text) => window.payday.decodeBackup(text),
    JSON.stringify(backup),
  );
  assert.equal(decoded.savingsBalance, 450);
  assert.equal(backup.encrypted, undefined);
  await page.evaluate(() => window.payday.setKey(""));
  assert.equal((await page.evaluate(() => window.payday.load())).hasKey, false);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "Borrow from savings" }).click();
  await page
    .getByRole("spinbutton", { name: "How much do you need?" })
    .fill("100");
  await page.getByRole("button", { name: "Record borrowing" }).click();
  await page.locator(".debt-banner").waitFor();
  assert.equal(
    (await page.evaluate(() => window.payday.load())).vault.debt,
    100,
  );
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Electron production renderer → isolated preload IPC → atomic vault file → reload; encrypted key save/removal; key-free backup; missing-key AI error; emergency self-debt.",
  );
} finally {
  await desktop.close();
}
