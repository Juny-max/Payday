import { test } from "node:test";
import assert from "node:assert/strict";
import { accountReport } from "../src/account-report";
import { initialVault, balancePlan, totals } from "../src/model";
test("account breakdowns reconcile to actual monthly allocations", () => {
  const v = initialVault();
  v.plan = balancePlan({
    ...v.plan,
    month: "2026-11",
    salary: 3000,
    daily: 46,
    workWeek: [1, 2, 3, 4, 5],
  });
  for (const key of ["telecel", "momo", "first"] as const) {
    const r = accountReport(v, key);
    assert.equal(
      Math.round(r.rows.reduce((s, r) => s + r.value, 0) * 100) / 100,
      totals(v.plan)[key],
    );
  }
  const commute = accountReport(v, "telecel");
  assert.equal(commute.total, 966);
  assert.match(commute.rows[0].note!, /21 calendar workdays/);
  assert.equal(accountReport(v, "momo").total, 1408.5);
});
test("savings reports distinguish monthly contribution, balance and debt", () => {
  const v = initialVault();
  v.plan.savings = 450;
  v.savingsBalance = 1800;
  v.debt = 100;
  const r = accountReport(v, "gcb");
  assert.equal(r.total, 450);
  assert.deepEqual(
    r.rows.map((r) => r.value),
    [450, 1800, 100],
  );
});
test("wishlist report includes this payday contributions even if bought", () => {
  const v = initialVault();
  v.plan.wishes = [
    {
      id: "x",
      name: "LED lights",
      cost: 80,
      funded: 80,
      contribution: 80,
      bought: true,
    },
  ];
  const r = accountReport(v, "first");
  assert.equal(r.total, 80);
  assert.equal(r.rows[2].value, 80);
  assert.equal(r.rows[2].note, "Bought this payday");
});
