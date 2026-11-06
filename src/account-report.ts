import {
  cash,
  totals,
  transport,
  monthlyWorkdays,
  dataCost,
  nightCost,
  type Vault,
} from "./model";
export type AccountKey = "gcb" | "telecel" | "momo" | "first";
export function accountReport(v: Vault, key: AccountKey) {
  const p = v.plan;
  const purposes = {
    gcb: "Savings set aside for your future and emergencies.",
    telecel: "Your monthly commute and optional internet reserves.",
    momo: "Your feeding money for cooking and buying meals.",
    first: "Clothes, social plans, partner gifts and one-time upgrades.",
  };
  const rows: { label: string; value: number; note?: string }[] =
    key === "gcb"
      ? [
          { label: "This payday’s savings", value: p.savings },
          { label: "Current savings balance", value: v.savingsBalance },
          { label: "Owed back to yourself", value: v.debt },
        ]
      : key === "telecel"
        ? [
            {
              label: "Monthly transport",
              value: transport(p),
              note: `${cash(p.daily)} per workday × ${monthlyWorkdays(p)} calendar workdays`,
            },
            {
              label: "Data reserve",
              value: dataCost(p),
              note:
                p.data === "company"
                  ? "Data funding is off"
                  : "The amount that fits this payday",
            },
            { label: "Midnight buffer", value: nightCost(p) },
          ]
        : key === "momo"
          ? [
              { label: "Bulk cooking foodstuffs", value: p.bulk },
              { label: "Buying food outside", value: p.outside },
            ]
          : [
              { label: "Wardrobe & upkeep", value: p.wardrobe },
              { label: "Partner & social buffer", value: p.partner },
              ...p.wishes
                .filter((w) => w.contribution > 0)
                .map((w) => ({
                  label: w.name,
                  value: w.contribution,
                  note: w.bought
                    ? "Bought this payday"
                    : "This payday’s contribution",
                })),
            ];
  return { purpose: purposes[key], total: totals(p)[key], rows };
}
