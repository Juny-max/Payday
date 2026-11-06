import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balancePlan,
  calendarWorkdays,
  monthlyWorkdays,
  monthNow,
  isPlanCommitted,
  continueDataPlan,
  adjustAllocation,
  dataCost,
  dataRequest,
  nextPaydayPlan,
  transportDeficit,
  stateSchema,
  borrow,
  buyWish,
  commitPayday,
  initialVault,
  remaining,
  totals,
  validatePlan,
} from "../src/model";
function exampleVault() {
  const v = initialVault();
  v.plan = balancePlan({
    ...v.plan,
    salary: 3000,
    workWeek: undefined,
    days: 22,
    daily: 25,
    wishes: [
      {
        id: "led",
        name: "Room LED lights",
        cost: 80,
        funded: 0,
        contribution: 0,
        bought: false,
      },
      {
        id: "powerbank",
        name: "Jumia power bank",
        cost: 615,
        funded: 0,
        contribution: 0,
        bought: false,
      },
    ],
  });
  return v;
}

test("sample budget reconciles and commute is fully reserved", () => {
  const v = exampleVault();
  assert.equal(remaining(v.plan), 0);
  assert.equal(totals(v.plan).telecel, 550);
  validatePlan(v.plan);
});
test("payday increases savings and wishlist funding exactly once", () => {
  const v = commitPayday(exampleVault());
  assert.equal(v.savingsBalance, 450);
  assert.equal(v.plan.wishes[0].funded, 80);
  assert.equal(remaining(v.plan), 0);
  assert.throws(() => commitPayday(v), /already saved/);
});
test("borrowing preserves money and next payday repays internal debt", () => {
  let v = commitPayday(exampleVault());
  v = borrow(v, 125);
  assert.equal(v.savingsBalance, 325);
  assert.equal(v.debt, 125);
  assert.equal(v.emergencyCash, 125);
  v.plan = {
    ...v.plan,
    id: crypto.randomUUID(),
    month: "2099-02",
    wishes: v.plan.wishes.map((w) => ({ ...w, contribution: 0 })),
  };
  v = commitPayday(v);
  assert.equal(v.debt, 0);
  assert.equal(v.savingsBalance, 775);
  assert.equal(v.history[0].repaid, 125);
});
test("rejects invalid borrowing without changing the vault", () => {
  const v = exampleVault();
  for (const n of [0, -1, NaN, Infinity, 100])
    assert.throws(() => borrow(v, n));
  assert.equal(v.debt, 0);
});
test("bought items archive without erasing the saved monthly allocation", () => {
  const v = commitPayday(exampleVault());
  assert.throws(() => buyWish(v, "powerbank"), /fully fund/);
  const result = buyWish(v, "led");
  assert.equal(result.plan.wishes[0].bought, true);
  assert.equal(remaining(result.plan), 0);
  assert.throws(() => buyWish(result, "led"));
});
test("offline planner respects essentials and never exceeds salary", () => {
  for (const salary of [800, 1500, 3000, 7000]) {
    const p = balancePlan({ ...exampleVault().plan, salary });
    validatePlan(p);
    assert.equal(remaining(p), 0);
  }
  const deficit = balancePlan({ ...exampleVault().plan, salary: 200 });
  assert.equal(remaining(deficit), -350);
  assert.throws(() => validatePlan(deficit), /over budget/);
});
test("blocks overspending and overfunded wishlist targets", () => {
  const p = exampleVault().plan;
  assert.throws(() => validatePlan({ ...p, salary: 100 }), /over budget/);
  assert.throws(
    () =>
      validatePlan({
        ...p,
        salary: 10000,
        wishes: [{ ...p.wishes[0], contribution: 100 }],
      }),
    /exceeds/,
  );
});

test("fresh installs contain no pretend salary, balances or goals", () => {
  const v = initialVault();
  assert.equal(v.plan.salary, 0);
  assert.equal(v.savingsBalance, 0);
  assert.equal(v.debt, 0);
  assert.equal(v.plan.wishes.length, 0);
  assert.equal(dataCost(v.plan), 0);
});
test("600 pay with 550 commute gives 50 food and zero optional spending", () => {
  const p = balancePlan({ ...exampleVault().plan, salary: 600 });
  assert.equal(p.savings, 0);
  assert.equal(p.bulk + p.outside, 50);
  assert.equal(totals(p).first, 0);
  assert.equal(remaining(p), 0);
});
test("715 pay with 550 commute gives all remaining 165 to feeding", () => {
  const p = balancePlan({ ...exampleVault().plan, salary: 715 });
  assert.equal(p.savings, 0);
  assert.equal(totals(p).momo, 165);
  assert.equal(totals(p).first, 0);
  assert.equal(remaining(p), 0);
});
test("higher pay can save, but transport-only deficits remain honest", () => {
  for (const salary of [1500, 3000]) {
    const p = balancePlan({ ...exampleVault().plan, salary });
    assert.equal(p.savings, salary * 0.15);
    assert.equal(remaining(p), 0);
  }
  const p = balancePlan({ ...exampleVault().plan, salary: 600, daily: 50 });
  assert.equal(transportDeficit(p), 500);
  assert.equal(remaining(p), -500);
  assert.equal(p.bulk + p.outside + p.savings + totals(p).first, 0);
  assert.match(p.explanation, /exceeds your pay/);
});
test("data off ignores old bundle and night amounts; on is capped to affordability", () => {
  const base = exampleVault().plan;
  const off = balancePlan({
    ...base,
    data: "company",
    dataRequested: 399,
    midnight: 30,
  });
  assert.equal(dataCost(off), 0);
  assert.equal(off.midnight, 0);
  const tight = balancePlan({
    ...base,
    salary: 600,
    data: "half",
    dataRequested: 200,
    dataMonthsRemaining: 2,
    midnight: 30,
  });
  assert.equal(dataRequest(tight), 200);
  assert.equal(dataCost(tight), 0);
  assert.equal(totals(tight).momo, 50);
  assert.equal(tight.midnight, 0);
  assert.equal(remaining(tight), 0);
  const custom = balancePlan({ ...base, data: "custom", dataRequested: 73.25 });
  assert.equal(dataCost(custom), 73.25);
  assert.equal(remaining(custom), 0);
});
test("data schedules resume only by explicit choice on a blank new payday", () => {
  let v = exampleVault();
  v.plan = balancePlan({
    ...v.plan,
    data: "half",
    dataRequested: 200,
    dataMonthsRemaining: 2,
  });
  v = commitPayday(v);
  const next = nextPaydayPlan(v.plan, new Date("2026-11-06T10:00:00Z"));
  assert.equal(next.salary, 0);
  assert.equal(next.daily, 0);
  assert.equal(dataCost(next), 0);
  assert.equal(next.pendingData?.remaining, 1);
  let resumed = continueDataPlan(next);
  resumed = balancePlan({
    ...resumed,
    salary: 3000,
    daily: 25,
    workWeek: [1, 2, 3, 4, 5],
  });
  assert.equal(dataCost(resumed), 200);
  v = commitPayday({ ...v, plan: resumed });
  assert.equal(v.plan.dataMonthsRemaining, 0);
  assert.equal(nextPaydayPlan(v.plan).pendingData, undefined);
});
test("manual changes cannot retain stale oversized savings or overspend", () => {
  const p = balancePlan({ ...exampleVault().plan, salary: 600 });
  const edited = adjustAllocation(p, "savings", 450);
  assert.equal(edited.savings, 50);
  assert.equal(remaining(edited), 0);
  for (const key of [
    "savings",
    "bulk",
    "outside",
    "wardrobe",
    "partner",
    "wish:led",
  ] as const) {
    const next = adjustAllocation(exampleVault().plan, key, 99999);
    assert.ok(remaining(next) >= 0);
    assert.ok(
      next.wishes[0].funded + next.wishes[0].contribution <=
        next.wishes[0].cost,
    );
  }
  const reset = balancePlan({ ...edited, salary: 715 });
  assert.equal(reset.savings, 0);
  assert.equal(totals(reset).momo, 165);
});
test("old vaults without data schedule fields still load without losing balances", () => {
  const old = exampleVault();
  delete old.plan.dataRequested;
  delete old.plan.dataReserve;
  delete old.plan.dataMonthsRemaining;
  old.plan.data = "half";
  assert.equal(dataCost(old.plan), 200);
  const loaded = stateSchema.parse(old);
  assert.equal(loaded.savingsBalance, old.savingsBalance);
  assert.equal(loaded.plan.salary, 3000);
});
test("rounding reconciles varied salaries and commute amounts to the pesewa", () => {
  for (const salary of [0.01, 600.01, 715.25, 1500.99, 3000.05])
    for (const daily of [0, 12.75, 25.2, 50]) {
      const p = balancePlan({
        ...exampleVault().plan,
        salary,
        daily,
        data: "custom",
        dataRequested: 21.33,
        dataMonthsRemaining: 1,
        midnight: 5,
      });
      assert.equal(remaining(p), -transportDeficit(p) || 0);
      for (const n of [
        p.savings,
        p.bulk,
        p.outside,
        p.wardrobe,
        p.partner,
        dataCost(p),
      ])
        assert.ok(n >= 0);
    }
});

test("calendar counts exact weekdays including leap years and five-week spans", () => {
  assert.equal(calendarWorkdays("2024-02", [1, 2, 3, 4, 5]), 21);
  assert.equal(calendarWorkdays("2025-02", [1, 2, 3, 4, 5]), 20);
  assert.equal(calendarWorkdays("2027-03", [1, 2, 3, 4, 5]), 23);
  assert.equal(calendarWorkdays("2027-03", [1, 2, 3]), 15);
  assert.equal(calendarWorkdays("2024-02", [0, 1, 2, 3, 4, 5, 6]), 29);
  assert.equal(calendarWorkdays("2027-03", []), 0);
});
test("weekly schedule, not entered monthly estimate, determines calendar transport", () => {
  const p = {
    ...initialVault().plan,
    month: "2027-03",
    salary: 715,
    daily: 25,
    days: 5,
    workWeek: [1, 2, 3, 4, 5],
  };
  assert.equal(monthlyWorkdays(p), 23);
  assert.equal(totals(balancePlan(p)).telecel, 575);
});
test("new paydays use the current Accra month and zero all new monetary inputs", () => {
  const old = commitPayday(exampleVault());
  const p = nextPaydayPlan(
    { ...old.plan, month: "2027-01" },
    new Date("2026-11-06T00:00:00Z"),
  );
  assert.equal(p.month, "2026-11");
  assert.equal(monthNow(new Date("2026-12-01T00:00:00Z")), "2026-12");
  for (const key of [
    "salary",
    "daily",
    "days",
    "savings",
    "bulk",
    "outside",
    "wardrobe",
    "partner",
    "midnight",
  ] as const)
    assert.equal(p[key], 0);
  assert.deepEqual(p.workWeek, []);
  assert.notEqual(p.id, old.plan.id);
  assert.equal(p.wishes[0].funded, old.plan.wishes[0].funded);
});
test("late/multiple payments in the same calendar month have separate identities", () => {
  let v = commitPayday(exampleVault());
  const p = balancePlan({
    ...nextPaydayPlan(v.plan),
    month: v.plan.month,
    salary: 715,
    daily: 0,
    workWeek: [],
  });
  assert.equal(isPlanCommitted(v, p), false);
  v = commitPayday({ ...v, plan: p });
  assert.equal(v.history.length, 2);
  assert.throws(() => commitPayday(v), /already saved/);
});
test("manual reductions leave money unallocated instead of hiding it in feeding", () => {
  const p = exampleVault().plan;
  const adjusted = adjustAllocation(p, "savings", 100);
  assert.equal(remaining(adjusted), 350);
  assert.equal(adjusted.bulk, p.bulk);
  assert.equal(adjusted.outside, p.outside);
});
