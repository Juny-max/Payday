import { z } from "zod";
export const money = (n: number) => Math.round(n * 100) / 100;
export const cash = (n: number) =>
  `GH₵ ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const amount = z.number().finite().min(0).max(10000000);
export const itemSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  cost: amount,
  funded: amount,
  contribution: amount,
  bought: z.boolean(),
});
export const planSchema = z.object({
  id: z.string().optional(),
  workWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  salary: amount,
  daily: amount,
  days: z.number().int().min(0).max(31),
  data: z.enum(["company", "full", "half", "custom"]),
  pendingData: z
    .object({ requested: amount, remaining: z.number().int().min(1).max(2) })
    .optional(),
  dataRequested: amount.optional(),
  dataReserve: amount.optional(),
  dataMonthsRemaining: z.number().int().min(0).max(2).optional(),
  midnight: amount.max(50),
  savings: amount,
  bulk: amount,
  outside: amount,
  wardrobe: amount,
  partner: amount,
  wishes: z.array(itemSchema).max(100),
  explanation: z.string().max(4000),
});
export type Plan = z.infer<typeof planSchema>;
export type Wish = z.infer<typeof itemSchema>;
export const accountNamesSchema = z.object({
  gcb: z.string().trim().min(1).max(40),
  telecel: z.string().trim().min(1).max(40),
  momo: z.string().trim().min(1).max(40),
  first: z.string().trim().min(1).max(40),
});
export const defaultAccountNames = {
  gcb: "GCB Bank",
  telecel: "Telecel Cash",
  momo: "MTN MoMo",
  first: "FirstBank",
};
export type AccountNames = z.infer<typeof accountNamesSchema>;
export const currencySchema = z.enum(["GHS", "USD", "GBP"]);
export type Currency = z.infer<typeof currencySchema>;
export const exchangeRatesSchema = z.object({
  USD: z.number().finite().positive().max(1000000),
  GBP: z.number().finite().positive().max(1000000),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const parsed=new Date(value+"T00:00:00Z"); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10)===value; }, "Enter a valid rate date."),
  fetchedAt: z.string().datetime(),
  source: z.enum(["Frankfurter", "Manual"]),
});
export type ExchangeRates = z.infer<typeof exchangeRatesSchema>;
export function displayAmount(n: number, currency: Currency, rates?: ExchangeRates) {
  if(currency === "GHS") return n;
  if(!rates) throw new Error("Save an exchange rate before selecting USD or GBP.");
  exchangeRatesSchema.parse(rates);
  return money(n * rates[currency]);
}
export const stateSchema = z.object({
  displayCurrency: currencySchema.optional(),
  exchangeRates: exchangeRatesSchema.optional(),
  accountNames: accountNamesSchema.optional(),
  version: z.literal(1),
  plan: planSchema,
  savingsBalance: amount,
  debt: amount,
  emergencyCash: amount,
  history: z.array(
    z.object({
      planId: z.string().optional(),
      month: z.string(),
      salary: amount,
      savings: amount,
      repaid: amount,
      date: z.string(),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      date: z.string(),
      kind: z.enum(["save", "borrow", "buy", "repay"]),
    }),
  ),
});
export type Vault = z.infer<typeof stateSchema>;
export const monthNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
};
export function calendarWorkdays(month: string, week: number[]): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 0;
  const [year, m] = month.split("-").map(Number),
    selected = new Set(week);
  let n = 0;
  for (let d = 1; d <= new Date(Date.UTC(year, m, 0)).getUTCDate(); d++)
    if (selected.has(new Date(Date.UTC(year, m - 1, d)).getUTCDay())) n++;
  return n;
}
export const monthlyWorkdays = (p: Plan) =>
  p.workWeek ? calendarWorkdays(p.month, p.workWeek) : p.days;
export const transport = (p: Plan) => money(p.daily * monthlyWorkdays(p));
export const isPlanCommitted = (v: Vault, p: Plan = v.plan) =>
  v.history.some((h) => (p.id ? h.planId === p.id : h.month === p.month));
export const dataRequest = (p: Plan) =>
  p.data === "company"
    ? 0
    : (p.dataRequested ??
      (p.data === "full" ? 399 : p.data === "half" ? 200 : 0));
export const dataCost = (p: Plan) =>
  p.data === "company" ? 0 : (p.dataReserve ?? dataRequest(p));
export const nightCost = (p: Plan) => (p.data === "company" ? 0 : p.midnight);
export const affordablePool = (p: Plan) =>
  money(Math.max(0, p.salary - transport(p) - dataCost(p) - nightCost(p)));
export const transportDeficit = (p: Plan) =>
  money(Math.max(0, transport(p) - p.salary));
export const totals = (p: Plan) => ({
  gcb: p.savings,
  telecel: money(transport(p) + dataCost(p) + nightCost(p)),
  momo: money(p.bulk + p.outside),
  first: money(
    p.wardrobe + p.partner + p.wishes.reduce((s, w) => s + w.contribution, 0),
  ),
});
export const allocated = (p: Plan) =>
  money(Object.values(totals(p)).reduce((a, b) => a + b, 0));
export const remaining = (p: Plan) => money(p.salary - allocated(p));
export function validatePlan(p: Plan) {
  planSchema.parse(p);
  if (p.workWeek && new Set(p.workWeek).size !== p.workWeek.length)
    throw new Error("Select each weekday only once.");
  if (p.salary <= 0) throw new Error("Enter a salary greater than zero.");
  if (dataCost(p) > dataRequest(p))
    throw new Error("The data reserve exceeds the requested amount.");
  if (p.data !== "company" && p.dataMonthsRemaining === 0)
    throw new Error("Choose one or two paydays for data funding.");
  if (remaining(p) < 0)
    throw new Error(
      `Your plan is ${cash(-remaining(p))} over budget. Reduce an allocation first.`,
    );
  if (
    p.wishes.some(
      (w) => w.funded + w.contribution > w.cost + 0.005 && !w.bought,
    )
  )
    throw new Error("A wishlist contribution exceeds its remaining target.");
}
/** Offline heuristic: commute first, protect up to 45% of pay for food,
 * then optional data, affordable savings (up to 15%), and lifestyle goals.
 * This is a transparent starting suggestion, not a cost-of-living estimate. */
export function balancePlan(p: Plan): Plan {
  const available = money(Math.max(0, p.salary - transport(p)));
  const foodFloor = money(Math.min(available, p.salary * 0.45));
  let flexible = money(available - foodFloor);
  const requested = dataRequest(p);
  const dataReserve = money(Math.min(requested, flexible));
  flexible = money(flexible - dataReserve);
  const midnight = money(
    p.data === "company" ? 0 : Math.min(p.midnight, flexible),
  );
  flexible = money(flexible - midnight);
  const savings = money(Math.min(p.salary * 0.15, flexible));
  flexible = money(flexible - savings);
  const foodExtra = money(flexible * 0.25);
  const food = money(foodFloor + foodExtra);
  let lifestyle = money(flexible - foodExtra);
  const partner = money(lifestyle * 0.2);
  lifestyle = money(lifestyle - partner);
  let wishPool = money(
    p.wishes.some((w) => !w.bought && w.cost > w.funded) ? lifestyle * 0.5 : 0,
  );
  const wishes = p.wishes.map((w) => {
    const contribution = money(
      w.bought ? 0 : Math.max(0, Math.min(w.cost - w.funded, wishPool)),
    );
    wishPool = money(wishPool - contribution);
    lifestyle = money(lifestyle - contribution);
    return { ...w, contribution };
  });
  const bulk = money(food * 0.65),
    outside = money(food - bulk);
  const deficit = transportDeficit(p);
  const explanation =
    deficit > 0
      ? `Your commute alone is ${cash(transport(p))}, which exceeds your pay by ${cash(deficit)}. All other pockets are zero. You need a lower commute cost or extra support; this cannot be solved by moving money between pockets.`
      : `Commute: ${cash(transport(p))}. Feeding: ${cash(food)}. Optional data: ${cash(dataReserve + midnight)}. GCB: ${cash(savings)}. Lifestyle and goals share the remaining ${cash(available - food - dataReserve - midnight - savings)}. The offline suggestion protects feeding before data and savings; you can edit the pockets.${requested > dataReserve ? ` Only ${cash(dataReserve)} of your ${cash(requested)} data request fits this pay.` : ""}`;
  return {
    ...p,
    dataRequested: requested,
    dataReserve,
    midnight,
    dataMonthsRemaining:
      p.data === "company"
        ? 0
        : (p.dataMonthsRemaining ?? (p.data === "half" ? 2 : 1)),
    savings,
    bulk,
    outside,
    partner,
    wishes,
    wardrobe: lifestyle,
    explanation,
  };
}
export type AllocationKey =
  "savings" | "bulk" | "outside" | "wardrobe" | "partner" | `wish:${string}`;
/** Keep a manual pocket change within the pay left after commute/data.
 * Reclaim lifestyle first, then savings/feeding. Never alter fixed commute. */
export function adjustAllocation(
  p: Plan,
  key: AllocationKey,
  value: number,
): Plan {
  const next = structuredClone(p);
  const keys: AllocationKey[] = [
    "wardrobe",
    "partner",
    ...p.wishes.filter((w) => !w.bought).map((w) => `wish:${w.id}` as const),
    "savings",
    "outside",
    "bulk",
  ];
  const get = (k: AllocationKey) =>
    k.startsWith("wish:")
      ? (next.wishes.find((w) => w.id === k.slice(5))?.contribution ?? 0)
      : next[k as "savings"];
  const set = (k: AllocationKey, n: number) => {
    if (k.startsWith("wish:")) {
      const w = next.wishes.find((w) => w.id === k.slice(5));
      if (w) w.contribution = money(n);
    } else next[k as "savings"] = money(n);
  };
  const wish = key.startsWith("wish:")
    ? next.wishes.find((w) => w.id === key.slice(5))
    : undefined;
  const cap = Math.min(
    affordablePool(p),
    wish ? Math.max(0, wish.cost - wish.funded) : Infinity,
  );
  set(key, Math.max(0, Math.min(Number.isFinite(value) ? value : 0, cap)));
  let over = money(Math.max(0, allocated(next) - next.salary));
  for (const k of keys) {
    if (k === key) continue;
    const cut = Math.min(get(k), over);
    set(k, get(k) - cut);
    over = money(over - cut);
  }
  return {
    ...next,
    explanation:
      "You adjusted a pocket manually. Increases use unallocated money first, then balance other flexible pockets. Reductions leave money unallocated; transport and data stay reserved.",
  };
}
export function nextPaydayPlan(p: Plan, now = new Date()): Plan {
  const empty = initialVault().plan;
  return {
    ...empty,
    id: crypto.randomUUID(),
    month: monthNow(now),
    wishes: p.wishes.map((w) => ({ ...w, contribution: 0 })),
    dataMonthsRemaining: 0,
    pendingData:
      (p.dataMonthsRemaining ?? 0) > 0 && p.data !== "company"
        ? { requested: dataRequest(p), remaining: p.dataMonthsRemaining! }
        : p.pendingData,
  };
}
export function continueDataPlan(p: Plan): Plan {
  if (!p.pendingData) return p;
  return balancePlan({
    ...p,
    data: "custom",
    dataRequested: p.pendingData.requested,
    dataMonthsRemaining: p.pendingData.remaining,
    pendingData: undefined,
  });
}
export const initialVault = (): Vault => ({
  version: 1,
  plan: {
    id: crypto.randomUUID(),
    workWeek: [],
    month: monthNow(),
    salary: 0,
    daily: 0,
    days: 0,
    data: "company",
    dataRequested: 0,
    dataReserve: 0,
    dataMonthsRemaining: 0,
    midnight: 0,
    savings: 0,
    bulk: 0,
    outside: 0,
    wardrobe: 0,
    partner: 0,
    wishes: [],
    explanation: "",
  },
  savingsBalance: 0,
  debt: 0,
  emergencyCash: 0,
  history: [],
  activity: [],
});
const event = (text: string, kind: Vault["activity"][number]["kind"]) => ({
  id: crypto.randomUUID(),
  text,
  kind,
  date: new Date().toISOString(),
});
export function commitPayday(v: Vault): Vault {
  if (isPlanCommitted(v))
    throw new Error(
      "This payday is already saved. Start a new month for your next salary.",
    );
  validatePlan(v.plan);
  const repaid = money(Math.min(v.debt, v.plan.savings));
  return {
    ...v,
    savingsBalance: money(v.savingsBalance + v.plan.savings),
    debt: money(v.debt - repaid),
    plan: {
      ...v.plan,
      dataMonthsRemaining: Math.max(
        0,
        (v.plan.dataMonthsRemaining ??
          (v.plan.data === "half" ? 2 : v.plan.data === "company" ? 0 : 1)) - 1,
      ),
      wishes: v.plan.wishes.map((w) => ({
        ...w,
        funded: money(w.funded + w.contribution),
      })),
    },
    history: [
      {
        planId: v.plan.id,
        month: v.plan.month,
        salary: v.plan.salary,
        savings: v.plan.savings,
        repaid,
        date: new Date().toISOString(),
      },
      ...v.history,
    ],
    activity: [
      event(
        `Payday saved · ${cash(v.plan.savings)} to GCB${repaid ? `, including ${cash(repaid)} self-debt repaid` : ""}`,
        "save",
      ),
      ...v.activity,
    ],
  };
}
export function borrow(v: Vault, n: number): Vault {
  if (!Number.isFinite(n) || n <= 0 || n > v.savingsBalance)
    throw new Error("Enter an amount within your available GCB savings.");
  return {
    ...v,
    savingsBalance: money(v.savingsBalance - n),
    debt: money(v.debt + n),
    emergencyCash: money(v.emergencyCash + n),
    activity: [
      event(`Borrowed ${cash(n)} from GCB → emergency pocket`, "borrow"),
      ...v.activity,
    ],
  };
}
export function buyWish(v: Vault, id: string): Vault {
  const w = v.plan.wishes.find((w) => w.id === id);
  if (!w || w.bought || w.funded < w.cost)
    throw new Error(
      "Save enough payday contributions to fully fund this item first.",
    );
  return {
    ...v,
    plan: {
      ...v.plan,
      wishes: v.plan.wishes.map((w) =>
        w.id === id ? { ...w, bought: true } : w,
      ),
    },
    activity: [
      event(`Bought ${w.name} · ${cash(w.cost)}`, "buy"),
      ...v.activity,
    ],
  };
}
