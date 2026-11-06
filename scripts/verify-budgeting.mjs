import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
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
  await page
    .getByRole("button", { name: "Plan payday", exact: true })
    .waitFor();
  assert.equal((await page.evaluate(() => window.payday.load())).vault, null);
  await page.getByRole("button", { name: "Plan payday", exact: true }).click();
  const salary = page.getByRole("spinbutton", { name: "Take-home salary" }),
    daily = page.getByRole("spinbutton", { name: "Daily in & out fare" }),
    saving = () => page.getByRole("spinbutton", { name: /^Savings/ });
  const food = async () =>
    Number(
      await page
        .getByRole("spinbutton", {
          name: "Bulk cooking foodstuffs",
          exact: true,
        })
        .inputValue(),
    ) +
    Number(
      await page
        .getByRole("spinbutton", { name: "Buying food outside", exact: true })
        .inputValue(),
    );
  await page.getByLabel("Payday month", { exact: true }).fill("2026-11");
  await page.getByRole("spinbutton", { name: "Days per week" }).fill("5");
  await salary.fill("3000");
  await daily.fill("25");
  assert.equal(Number(await saving().inputValue()), 450);
  await salary.fill("600");
  assert.equal(Number(await saving().inputValue()), 0);
  assert.equal(await food(), 75);
  assert.equal(
    await page
      .getByRole("button", { name: "Save payday", exact: true })
      .isEnabled(),
    true,
  );
  await page.locator(".budget-reality").scrollIntoViewIfNeeded();
  await saving().fill("450");
  assert.equal(Number(await saving().inputValue()), 75);
  await salary.fill("715");
  assert.equal(Number(await saving().inputValue()), 0);
  assert.equal(await food(), 190);
  await salary.fill("600");
  await daily.fill("50");
  assert.match(await page.locator(".budget-reality").innerText(), /450\.00/);
  assert.equal(
    await page
      .getByRole("button", { name: "Save payday", exact: true })
      .isDisabled(),
    true,
  );
  await daily.fill("25");
  await page.getByRole("switch", { name: "Fund data this month" }).click();
  assert.match(await page.locator(".data-actual").innerText(), /0\.00/);
  assert.equal(await food(), 75);
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Requested monthly data reserve" })
      .inputValue(),
    "0",
  );
  await page
    .getByRole("spinbutton", { name: "Requested monthly data reserve" })
    .fill("200");
  await salary.fill("1500");
  assert.match(await page.locator(".data-actual").innerText(), /200\.00/);
  assert.equal(Number(await saving().inputValue()), 100);
  assert.equal(await food(), 675);
  await page.getByRole("switch", { name: "Fund data this month" }).click();
  assert.equal(Number(await saving().inputValue()), 225);
  assert.equal(await page.locator(".data-funding-options").count(), 0);
  await salary.fill("3000");
  await page.getByRole("switch", { name: "Fund data this month" }).click();
  await page
    .getByRole("spinbutton", { name: "Requested monthly data reserve" })
    .fill("73.25");
  assert.match(await page.locator(".data-actual").innerText(), /73\.25/);
  await page.getByRole("button", { name: "Request 200 for 2 paydays" }).click();
  await page.getByRole("button", { name: "Save payday", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  let v = (await page.evaluate(() => window.payday.load())).vault;
  assert.equal(v.plan.dataReserve, 200);
  assert.equal(v.plan.dataMonthsRemaining, 1);
  assert.equal(v.history.length, 1);
  await page.getByRole("button", { name: "Next payday", exact: true }).click();
  assert.equal(await salary.inputValue(), "0");
  assert.equal(await daily.inputValue(), "0");
  assert.equal(
    await page.getByRole("spinbutton", { name: "Days per week" }).inputValue(),
    "0",
  );
  await page
    .getByRole("button", { name: /Continue previous data plan/ })
    .click();
  await salary.fill("3000");
  await daily.fill("25");
  await page.getByRole("spinbutton", { name: "Days per week" }).fill("5");
  await page.getByRole("button", { name: "Save payday", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  v = (await page.evaluate(() => window.payday.load())).vault;
  assert.equal(v.history.length, 2);
  assert.equal(v.plan.dataMonthsRemaining, 0);
  await page.getByRole("button", { name: "Next payday", exact: true }).click();
  assert.equal(await salary.inputValue(), "0");
  assert.equal(
    await page
      .getByRole("switch", { name: "Fund data this month" })
      .getAttribute("aria-checked"),
    "false",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Electron UI → salary/commute auto-recalculation → affordable manual edits → real deficit warning → custom optional data → persisted two-payday schedule → automatic off; no renderer errors.",
  );
} finally {
  await app.close();
}
