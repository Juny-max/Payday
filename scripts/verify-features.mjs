import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: ["scripts/desktop-harness.cjs"],
  env,
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Plan payday", exact: true }).click();
  await page.getByLabel("Payday month", { exact: true }).fill("2026-11");
  await page.getByRole("spinbutton", { name: "Take-home salary" }).fill("3000");
  await page.getByRole("spinbutton", { name: "Days per week" }).fill("5");
  await page
    .getByRole("spinbutton", { name: "Daily in & out fare" })
    .fill("46");
  await page.getByRole("button", { name: "Save payday", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Details for Telecel Cash" }).click();
  assert.match(await page.getByRole("dialog").innerText(), /966\.00/);
  assert.match(
    await page.locator(".report-row").first().innerText(),
    /21 calendar workdays/,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "Open MTN MoMo" }).click();
  assert.match(await page.getByRole("dialog").innerText(), /1,408\.50/);
  assert.match(
    await page.getByRole("dialog").innerText(),
    /Bulk cooking foodstuffs/,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Open FirstBank" }).click();
  assert.match(await page.getByRole("dialog").innerText(), /175\.50/);
  assert.match(
    await page.getByRole("dialog").innerText(),
    /Partner & social buffer/,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Open GCB Bank" }).click();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /Current savings balance/,
  );
  assert.match(await page.getByRole("dialog").innerText(), /Request borrowing/);
  await page
    .getByRole("spinbutton", { name: "How much do you need?" })
    .fill("100");
  await page.getByRole("button", { name: "Record borrowing" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.evaluate(() => window.payday.setKey("not-a-real-key-reset-test"));
  const dir = await app.evaluate(({ app }) => app.getPath("userData")),
    sentinel = dir + "-unrelated.txt";
  await writeFile(sentinel, "Keep this unrelated file");
  await page.getByRole("button", { name: "Wishlist", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Wishlist item name" })
    .fill("Practice goal");
  await page.getByRole("spinbutton", { name: "Target price" }).fill("100");
  await page.getByRole("button", { name: "Add to wishlist" }).click();
  await page
    .locator(".wish-card")
    .filter({ hasText: "Practice goal" })
    .waitFor();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", {name:"Reset & uninstall",exact:true}).click();
  await page
    .getByRole("textbox", { name: "first account name" })
    .fill("Practice bank");
  await page.getByRole("button", { name: "Save account names" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Account names updated." })
    .waitFor();

  await page
    .getByRole("button", { name: "Reset everything", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => window.payday.load())).vault.savingsBalance,
    350,
  );
  assert.equal(
    await page.getByRole("button", { name: "Open uninstall wizard" }).count(),
    1,
  );
  await page
    .getByRole("button", { name: "Reset everything", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, reset everything", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const { vault, hasKey } = await page.evaluate(() => window.payday.load());
  assert.equal(vault.accountNames, undefined);
  assert.equal(vault.emergencyCash, 0);
  assert.equal(vault.plan.salary, 0);
  assert.equal(vault.savingsBalance, 0);
  assert.equal(vault.debt, 0);
  assert.equal(vault.history.length, 0);
  assert.equal(vault.activity.length, 0);
  assert.equal(vault.plan.wishes.length, 0);
  assert.equal(hasKey, false);
  assert.equal(
    JSON.parse(await readFile(path.join(dir, "payday-key.json"), "utf8"))
      .encrypted,
    null,
  );
  assert.equal(await readFile(sentinel, "utf8"), "Keep this unrelated file");
  await page.reload();
  await page
    .getByRole("button", { name: "Plan payday", exact: true })
    .waitFor();
  assert.equal(
    (await page.evaluate(() => window.payday.load())).vault.history.length,
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: matching account reports on both screens, exact category totals, savings borrowing in same modal, reset cancel/confirm, cleared key/history/balances, encrypted persistence and unrelated file preserved. Uninstaller was not executed.",
  );
} finally {
  await app.close();
}
