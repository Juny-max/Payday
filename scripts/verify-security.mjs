import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: ["scripts/desktop-harness.cjs"],
  env,
});
try {
  const page = await app.firstWindow();
  await page
    .getByRole("button", { name: "Plan payday", exact: true })
    .waitFor();
  const dir = await app.evaluate(({ app }) => app.getPath("userData"));
  // A real legacy JSON vault, including funds/history, must migrate without losing them.
  const legacy = {
    version: 1,
    plan: {
      month: "2027-01",
      salary: 715,
      daily: 25,
      days: 22,
      data: "company",
      midnight: 0,
      savings: 0,
      bulk: 100,
      outside: 65,
      wardrobe: 0,
      partner: 0,
      wishes: [],
      explanation: "",
    },
    savingsBalance: 1350,
    debt: 0,
    emergencyCash: 0,
    history: [
      {
        month: "2027-01",
        salary: 715,
        savings: 0,
        repaid: 0,
        date: "2027-01-31",
      },
    ],
    activity: [],
  };
  await writeFile(path.join(dir, "payday-vault.json"), JSON.stringify(legacy));
  const loaded = await page.evaluate(() => window.payday.load());
  assert.equal(loaded.vault.savingsBalance, 1350);
  assert.equal(loaded.vault.history.length, 1);
  const encrypted = JSON.parse(
    await readFile(path.join(dir, "payday-vault.json"), "utf8"),
  );
  assert.equal(encrypted.format, "payday.encrypted.v1");
  assert.ok(!JSON.stringify(encrypted).includes("savingsBalance"));
  await page.evaluate(() => window.payday.export());
  const backup = JSON.parse(
    await readFile(path.join(dir, "backup.json"), "utf8"),
  );
  assert.equal(backup.format, "payday.encrypted.v1");
  const restored = await page.evaluate(
    (text) => window.payday.decodeBackup(text),
    JSON.stringify(backup),
  );
  assert.equal(restored.savingsBalance, 1350);
  const legacyRestore = await page.evaluate(
    (text) => window.payday.decodeBackup(text),
    JSON.stringify(legacy),
  );
  assert.equal(legacyRestore.savingsBalance, 1350);
  const error = await page.evaluate(async () => {
    try {
      await window.payday.decodeBackup(
        JSON.stringify({ format: "payday.encrypted.v1", ciphertext: "broken" }),
      );
      return "";
    } catch (e) {
      return e.message;
    }
  });
  assert.match(error, /could not be unlocked/);
  assert.equal(
    (await page.evaluate(() => window.payday.load())).vault.savingsBalance,
    1350,
  );
  console.log(
    "PASS: actual Windows encryption, plaintext vault migration, encrypted backup round-trip, legacy backup compatibility, tamper rejection and preserved history/balances.",
  );
} finally {
  await app.close();
}
