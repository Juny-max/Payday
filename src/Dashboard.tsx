import {useCurrency} from "./Currency";
import { useState } from "react";
import {
  Bank,
  Bus,
  ForkKnife,
  Heart,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  LockKey,
  Check,
  PencilSimple,
  ChartDonut,
  Wallet,
  CalendarBlank,
} from "@phosphor-icons/react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  totals,
  remaining,
  monthlyWorkdays,
  defaultAccountNames,
  type AccountNames,
  type Vault,
  type Plan,
} from "./model";
import type { AccountKey } from "./account-report";

const accounts = [
  {
    key: "gcb",
    name: "GCB Bank",
    category: "Savings vault",
    color: "#386c51",
    icon: Bank,
  },
  {
    key: "telecel",
    name: "Telecel Cash",
    category: "Commute & data",
    color: "#c14650",
    icon: Bus,
  },
  {
    key: "momo",
    name: "MTN MoMo",
    category: "Monthly feeding",
    color: "#bd861d",
    icon: ForkKnife,
  },
  {
    key: "first",
    name: "FirstBank",
    category: "Lifestyle & upgrades",
    color: "#4e6fc4",
    icon: Heart,
  },
] as const;
export function AllocationCard({
  plan,
  onEdit,
  names = defaultAccountNames,
}: {
  plan: Plan;
  onEdit: () => void;
  names?: AccountNames;
}) {
  const {cash}=useCurrency();
  const [hovered, setHovered] = useState<string | null>(null);
  const t = totals(plan),
    left = remaining(plan);
  const data: { name: string; value: number; color: string }[] = accounts.map(
    (a) => ({ name: names[a.key], value: t[a.key], color: a.color }),
  );
  if (left > 0)
    data.push({ name: "Unallocated", value: left, color: "#e5e8e2" });
  return (
    <section className="allocation-card panel">
      <div className="panel-title">
        <h2>
          <ChartDonut size={19} />
          Your allocation
        </h2>
        <button
          className="icon-button"
          aria-label="Edit allocation chart"
          onClick={onEdit}
        >
          <ArrowUpRight size={19} />
        </button>
      </div>
      <div
        className="donut-wrap"
        role="img"
        aria-label={`Monthly allocation: ${data.map((d) => `${d.name} ${cash(d.value)}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={
                data.some((d) => d.value > 0)
                  ? data
                  : [{ name: "No allocation", value: 1, color: "#e5e8e2" }]
              }
              dataKey="value"
              innerRadius="81%"
              outerRadius="96%"
              paddingAngle={4}
              cornerRadius={5}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_entry, index) =>
                setHovered(data[index]?.name ?? null)
              }
              onMouseLeave={() => setHovered(null)}
              onClick={(_entry, index) => setHovered(data[index]?.name ?? null)}
            >
              {(data.some((d) => d.value > 0)
                ? data
                : [{ name: "No allocation", value: 1, color: "#e5e8e2" }]
              ).map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <span>
            {plan.salary === 0
              ? "Not planned yet"
              : left === 0
                ? "All planned"
                : left < 0
                  ? "Over budget"
                  : "Allocated"}
          </span>
          <strong>
            {plan.salary === 0
              ? "0%"
              : left < 0
                ? ">100%"
                : `${Math.round(((plan.salary - left) / plan.salary) * 100)}%`}
          </strong>
          <small>
            {plan.salary === 0 ? "Enter your pay to start" : "of this payday"}
          </small>
        </div>
      </div>
      <div className="allocation-hover-detail" role="status">
        {hovered && data.find((d) => d.name === hovered) ? (
          <>
            <strong>{hovered}</strong>
            <span>{cash(data.find((d) => d.name === hovered)!.value)}</span>
          </>
        ) : (
          <span>
            {left > 0
              ? `${cash(left)} unallocated`
              : "Hover or select a segment for its amount"}
          </span>
        )}
      </div>
      <div className="donut-legend">
        {data.map((d) => (
          <button
            type="button"
            key={d.name}
            onFocus={() => setHovered(d.name)}
            onBlur={() => setHovered(null)}
            onMouseEnter={() => setHovered(d.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setHovered(d.name)}
          >
            <span>
              <i style={{ background: d.color }} />
              {d.name}
            </span>
            <strong>
              {plan.salary
                ? Math.round((d.value / plan.salary) * 1000) / 10
                : 0}
              %
            </strong>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AccountBreakdown({
  plan,
  onAccounts,
  onAccount,
  names = defaultAccountNames,
}: {
  plan: Plan;
  onAccounts: () => void;
  onAccount: (key: AccountKey) => void;
  names?: AccountNames;
}) {
  const {cash}=useCurrency();
  const t = totals(plan);
  return (
    <section className="breakdown-card panel">
      <div className="panel-title">
        <h2>
          <Wallet size={19} />
          Account breakdown
        </h2>
        <button
          className="icon-button"
          aria-label="View all accounts"
          onClick={onAccounts}
        >
          <ArrowUpRight size={19} />
        </button>
      </div>
      <p className="breakdown-subtitle">Your money, with a purpose.</p>
      <div className="breakdown-rows">
        {accounts.map((a) => (
          <button
            type="button"
            key={a.key}
            className="breakdown-row"
            onClick={() => onAccount(a.key)}
            aria-label={`Details for ${names[a.key]}`}
          >
            <span
              className={`breakdown-icon bank-${a.key}`}
              style={{ color: a.color }}
            >
              <a.icon size={18} />
            </span>
            <span className="breakdown-info">
              <span>
                <strong>{names[a.key]}</strong>
                <b>{cash(t[a.key])}</b>
              </span>
              <span className="breakdown-track">
                <i
                  style={{
                    width: `${plan.salary ? Math.min((t[a.key] / plan.salary) * 100, 100) : 0}%`,
                    background: a.color,
                  }}
                />
              </span>
              <small>{a.category}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard({
  names = defaultAccountNames,
  vault,
  committed,
  onPlan,
  onNext,
  onAccounts,
  onAccount,
  showAccounts,
}: {
  names?: AccountNames;
  vault: Vault;
  committed: boolean;
  onPlan: () => void;
  onNext: () => void;
  onAccounts: () => void;
  onAccount: (key: AccountKey) => void;
  showAccounts: boolean;
}) {
  const {cash,symbol,label,number}=useCurrency();
  const p = vault.plan,
    t = totals(p),
    left = remaining(p);
  const month = new Date(p.month + "-02").toLocaleDateString("en-GH", {
    month: "long",
    year: "numeric",
  });
  return (
    <>
      <section className="balance-grid">
        <article className="balance-card panel">
          <div className="balance-top">
            <span className="currency-label">
              <Wallet size={15} />
              {symbol} <span>{label}</span>
            </span>
            <span className={`plan-status ${committed ? "saved" : ""}`}>
              <i />
              {committed ? "Payday saved" : "Draft plan"}
            </span>
          </div>
          <p className="balance-caption">Your monthly payday</p>
          <h2 className="balance-value">
            <span>{symbol}</span>
            {number(p.salary).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="balance-context">
            <CalendarBlank size={14} />
            {month}
            <span>•</span>
            <span>
              {p.salary === 0
                ? "Enter your pay to start"
                : left === 0
                  ? "Fully allocated"
                  : `${cash(Math.max(0, left))} unallocated`}
            </span>
          </div>
          <div className="balance-actions">
            <button className="primary" onClick={committed ? onNext : onPlan}>
              {committed ? (
                <ArrowRight size={16} />
              ) : (
                <PencilSimple size={16} />
              )}{" "}
              {committed ? "Plan next payday" : "Allocate payday"}
            </button>
            <button className="secondary" onClick={onAccounts}>
              View accounts <ArrowUpRight size={15} />
            </button>
            <button
              className="balance-circle"
              aria-label="Review payday plan"
              onClick={onPlan}
            >
              <ArrowUpRight size={25} />
            </button>
          </div>
        </article>
        <article className="savings-card">
          <div className="savings-top">
            <span>
              <ShieldCheck size={14} />
              YOUR SAFETY NET
            </span>
            <button
              className="icon-button"
              aria-label={`Manage ${names.gcb} savings`}
              onClick={() => onAccount("gcb")}
            >
              <ArrowUpRight size={21} />
            </button>
          </div>
          <div className="savings-brand">
            <Bank size={18} />
            <span>{names.gcb}</span>
          </div>
          <h2>{cash(vault.savingsBalance)}</h2>
          <p>Small steps. A stronger tomorrow.</p>
          <div className="savings-metrics">
            <div>
              <span>This payday</span>
              <strong>
                {cash(p.savings)}
                <ArrowUpRight size={15} />
              </strong>
            </div>
            <div>
              <span>Owed to yourself</span>
              <strong>
                {vault.debt ? cash(vault.debt) : "All clear"}
                {!vault.debt && <Check size={15} />}
              </strong>
            </div>
          </div>
        </article>
      </section>
      {showAccounts && (
        <>
          <div className="accounts-heading">
            <div>
              <h2>
                Your accounts <span>4 pockets, one plan</span>
              </h2>
            </div>
            <button onClick={onPlan}>
              Manage allocation <ArrowUpRight size={15} />
            </button>
          </div>
          <section className="bank-grid">
            {accounts.map((a) => (
              <article
                key={a.key}
                className={`bank-card bank-${a.key}`}
                onClick={() => onAccount(a.key)}
              >
                <div className="bank-card-head">
                  <span className="bank-symbol" style={{ color: a.color }}>
                    <a.icon size={20} />
                  </span>
                  <h3>{names[a.key]}</h3>
                  <button
                    aria-label={`Open ${names[a.key]}`}
                    onClick={() => onAccount(a.key)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <p className="bank-category">{a.category}</p>
                <div className="bank-amount">{cash(t[a.key])}</div>
                <div className="bank-meta">
                  <span>
                    {a.key === "gcb" ? (
                      <>
                        <LockKey size={12} />
                        Protected savings
                      </>
                    ) : a.key === "telecel" ? (
                      <>
                        {monthlyWorkdays(p)} workdays ·{" "}
                        {p.data === "company"
                          ? "data off"
                          : p.data === "half"
                            ? "data funding on"
                            : "data funding on"}
                      </>
                    ) : a.key === "momo" ? (
                      <>Cooking + eating out</>
                    ) : (
                      <>Room, tech & a little living</>
                    )}
                  </span>
                  <strong>
                    {p.salary ? Math.round((t[a.key] / p.salary) * 100) : 0}%
                  </strong>
                </div>
                <button
                  className="bank-action"
                  onClick={() => onAccount(a.key)}
                >
                  {a.key === "gcb"
                    ? "Borrow from savings"
                    : a.key === "telecel"
                      ? "View commute & data"
                      : a.key === "momo"
                        ? "View feeding split"
                        : "View lifestyle split"}
                  <ArrowRight size={13} />
                </button>
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}
