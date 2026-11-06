import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CaretDown as ChevronDown,
  Question as CircleHelp,
  DownloadSimple as Download,
  Heart,
  ClockCounterClockwise as History,
  SquaresFour as LayoutDashboard,
  LockKey as LockKeyhole,
  Plus,
  GearSix as Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkle as Sparkles,
  Train as TrainFront,
  ForkKnife as Utensils,
  Wallet,
  X,
  Lightning as Zap,
  CircleNotch as LoaderCircle,
  ArrowsClockwise as RefreshCw,
  CheckCircle as CircleCheck,
  Money as Banknote,
  Archive,
  CalendarBlank,
} from "@phosphor-icons/react";
import {CurrencyProvider,CurrencySettings,currencyPresentation,useCurrency} from "./Currency";
import { storage, type UpdateState } from "./bridge";
import { accountReport, type AccountKey } from "./account-report";
import Dashboard, { AllocationCard, AccountBreakdown } from "./Dashboard";
import "@fontsource-variable/manrope";
import {
  balancePlan,
  continueDataPlan,
  monthlyWorkdays,
  isPlanCommitted,
  defaultAccountNames,
  accountNamesSchema,
  type AccountNames,
  adjustAllocation,
  dataRequest,
  dataCost,
  affordablePool,
  nextPaydayPlan,
  transportDeficit,
  borrow,
  buyWish,
  commitPayday,
  initialVault,
  money,
  remaining,
  stateSchema,
  transport,
  validatePlan,
  type Plan,
  type Vault,
} from "./model";
type View = "overview" | "accounts" | "wishlist" | "history" | "copilot" | "settings";
type Modal =
  | "payday"
  | "borrow"
  | "help"
  | "copilot"
  | "account"
  | "reset"
  | null;
const dateLabel = (month: string) =>
  new Date(month + "-02").toLocaleDateString("en-GH", {
    month: "long",
    year: "numeric",
  });
function Field({
  label,
  value,
  onChange,
  max = 1000000,
  step = 1,
  disabled = false,
  hint,
  sliderMax,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  step?: number;
  disabled?: boolean;
  hint?: string;
  sliderMax?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-input">
        <span>GH₵</span>
        <input
          aria-label={label}
          type="number"
          min="0"
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              Math.max(0, Math.min(max, money(Number(e.target.value) || 0))),
            )
          }
        />
      </div>
      {sliderMax !== undefined && (
        <input
          className="allocation-slider"
          aria-label={`${label} slider`}
          type="range"
          min={0}
          max={Math.max(1, sliderMax)}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ModalFrame({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current;
    const focusable = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button,input,textarea,select,[tabindex="0"]',
        ) || [],
      ).filter((x) => !(x as HTMLInputElement).disabled);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = focusable();
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal glass ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          aria-label="Close dialog"
          className="icon-button close"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
function AccountSettings({
  names,
  disabled,
  onSave,
}: {
  names: AccountNames;
  disabled: boolean;
  onSave: (names: AccountNames) => Promise<void>;
}) {
  const [edited, setEdited] = useState(names);
  useEffect(() => setEdited(names), [names]);
  return (
    <section className="setting-section account-preferences" role="tabpanel" id="settings-panel-accounts" aria-labelledby="settings-tab-accounts">
      <div className="settings-card-icon"><Wallet size={23}/></div>
      <h2>Account names</h2>
      <p className="settings-note">
        Rename the accounts without changing what each pocket is used for.
      </p>
      {(["gcb", "telecel", "momo", "first"] as const).map((key, i) => (
        <label className="field" key={key}>
          <span>
            {
              [
                "Savings account",
                "Commute & data account",
                "Feeding account",
                "Lifestyle & upgrades account",
              ][i]
            }
          </span>
          <input
            aria-label={`${key} account name`}
            value={edited[key]}
            maxLength={40}
            onChange={(e) => setEdited({ ...edited, [key]: e.target.value })}
          />
        </label>
      ))}
      <button
        className="secondary"
        disabled={disabled || Object.values(edited).some((n) => !n.trim())}
        onClick={() => onSave(edited)}
      >
        Save account names
      </button>
    </section>
  );
}
function AccountReportDetails({
  vault,
  account,
}: {
  vault: Vault;
  account: AccountKey;
}) {
  const {cash}=useCurrency();
  const r = accountReport(vault, account);
  return (
    <div className="account-report">
      <div className="report-total">
        <span>Allocated this payday</span>
        <strong>{cash(r.total)}</strong>
      </div>
      <dl>
        {r.rows.map((row, i) => (
          <div className="report-row" key={`${row.label}-${i}`}>
            <dt>
              {row.label}
              {row.note && <small>{row.note}</small>}
            </dt>
            <dd>{cash(row.value)}</dd>
          </div>
        ))}
      </dl>
      {account === "first" && r.rows.length === 2 && (
        <p className="settings-note">
          No room or tech contributions in this payday.
        </p>
      )}
    </div>
  );
}
export default function App() {
  const [vault, setVault] = useState<Vault>(initialVault),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState(""),
    [hasKey, setHasKey] = useState(false),
    [view, setView] = useState<View>("overview"),
    [modal, setModal] = useState<Modal>(null),
    [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [preparingBudget, setPreparingBudget] = useState(false),
    [waitingLong, setWaitingLong] = useState(false),
    [prompt, setPrompt] = useState(""),
    [conversation, setConversation] = useState<{ role: string; text: string }[]>([]),
    [apiKey, setApiKey] = useState(""),
    [borrowAmount, setBorrowAmount] = useState(0),
    [draft, setDraft] = useState<Plan>(vault.plan),
    [newName, setNewName] = useState(""),
    [newCost, setNewCost] = useState(0),
    [showArchive, setShowArchive] = useState(false);
  const [settingsTab,setSettingsTab]=useState("accounts");
  const display=useMemo(()=>currencyPresentation(vault.displayCurrency ?? "GHS",vault.exchangeRates),[vault.displayCurrency,vault.exchangeRates]);
  const cash=display.cash;
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  useEffect(() => {
    if(!window.payday) return;
    let mounted=true;
    const unsubscribe=window.payday.onUpdate(state => {if(mounted) setUpdateState(state);});
    window.payday.updateStatus().then(state => {if(mounted) setUpdateState(state);}).catch(()=>{});
    return () => { mounted=false; unsubscribe(); };
  }, []);
  async function updateAction(action: "checkUpdates"|"downloadUpdate"|"installUpdate") {
    try { if(window.payday) setUpdateState(await window.payday[action]()); } catch(error) { notify((error as Error).message, true); }
  }
  const [keyVerified, setKeyVerified] = useState(false),
    [testingKey, setTestingKey] = useState(false),
    [keyTestError, setKeyTestError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountKey>("gcb");
  function openAccount(key: AccountKey) {
    setSelectedAccount(key);
    setBorrowAmount(0);
    setModal(key === "gcb" ? "borrow" : "account");
  }
  const [aiInDraft, setAiInDraft] = useState(false);
  function openCopilot(fromDraft = false) {
    setAiInDraft(fromDraft);
    setModal(null);
    setView("copilot");
  }
  useEffect(() => {
    setWaitingLong(false);
    if (!busy) return;
    const timer = setTimeout(() => setWaitingLong(true), 12000);
    return () => clearTimeout(timer);
  }, [busy]);
  const [proposedPlan, setProposedPlan] = useState<Plan | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [conversation, busy, view]);
  function openSettings(tab = "accounts") { setSettingsTab(tab); setModal(null); setView("settings"); }
  const saveQueue = useRef(Promise.resolve());
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const latestVault = useRef(vault);
  latestVault.current = vault;
  useEffect(() => {
    storage
      .load()
      .then(({ vault, hasKey }) => {
        if (vault) setVault(stateSchema.parse(vault));
        setHasKey(hasKey);
        setReady(true);
      })
      .catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  const notify = (text: string, error = false) =>
    setToast({
      text: text.replace(/^Error invoking remote method [\s\S]*?: Error: /, ""),
      error,
    });
  async function persist(next: Vault) {
    setSaving(true);
    const task = saveQueue.current.then(() => storage.save(next));
    saveQueue.current = task.catch(() => {});
    try {
      await task;
      setVault(next);
      return true;
    } catch (e) {
      notify(`Could not save: ${(e as Error).message}`, true);
      return false;
    } finally {
      setSaving(false);
    }
  }
  const p = vault.plan,
    committed = isPlanCommitted(vault),
    draftLocked = isPlanCommitted(vault, draft),
    accountNames = vault.accountNames ?? defaultAccountNames;
  const active = p.wishes.filter((w) => !w.bought),
    archived = p.wishes.filter((w) => w.bought);
  function openPayday() {
    setDraft(
      committed || p.dataRequested !== undefined
        ? structuredClone(p)
        : balancePlan(p),
    );
    setModal("payday");
  }
  function updateDraft<K extends keyof Plan>(key: K, value: Plan[K]) {
    setDraft((d) => {
      if (["savings", "bulk", "outside", "wardrobe", "partner"].includes(key))
        return adjustAllocation(d, key as "savings", value as number);
      if (key === "wishes") {
        const wishes = value as Plan["wishes"];
        const changed = wishes.find(
          (w) =>
            w.contribution !==
            d.wishes.find((old) => old.id === w.id)?.contribution,
        );
        return changed
          ? adjustAllocation(d, `wish:${changed.id}`, changed.contribution)
          : { ...d, wishes };
      }
      const next = {
        ...d,
        [key]: value,
        ...(key === "dataRequested" ? { data: "custom" as const } : {}),
      };
      return [
        "salary",
        "daily",
        "days",
        "month",
        "workWeek",
        "data",
        "dataRequested",
        "midnight",
      ].includes(key)
        ? balancePlan(next)
        : next;
    });
  }
  async function saveDraft(commit: boolean) {
    try {
      if (draftLocked)
        throw new Error(
          "This month is saved. Start the next payday to make a new allocation.",
        );
      validatePlan(draft);
      let next = { ...vault, plan: draft };
      if (commit) next = commitPayday(next);
      if (await persist(next)) {
        setModal(null);
        notify(
          commit
            ? "Payday saved. Every cedi has a purpose."
            : "Your draft is saved locally.",
        );
      }
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  function nextMonth() {
    setDraft(nextPaydayPlan(p));
    setModal("payday");
  }
  async function runAI() {
    const baseline = JSON.stringify(vault);
    const draftBaseline = JSON.stringify(draft);
    if (!prompt.trim() || busy) return;
    const text = prompt.trim();
    setConversation(previous => [...previous, { role: "You", text }]);
    setPrompt("");

    setPreparingBudget(aiInDraft || /budget|allocat|plan|salary|paid|payday|split|cedis|spend|transport|fare|saving|food|balance|money/i.test(text));
    setBusy(true);
    try {
      const plan = await storage.ai(
        [...conversation.slice(-8), { role: "user", text }].map(m => `${m.role}: ${m.text}`).join("\n").slice(-6000),
        aiInDraft ? draft : p,
      );
      setKeyVerified(true);
      if ("reply" in plan) {
        setConversation(previous => [...previous, { role: "Co-pilot", text: plan.reply }]);
        setPrompt("");
        return;
      }
      setConversation(previous => [...previous, { role: "Co-pilot", text: plan.explanation }]);
      setPrompt("");
      if (
        JSON.stringify(latestVault.current) !== baseline ||
        (aiInDraft && JSON.stringify(latestDraft.current) !== draftBaseline)
      ) {
        notify(
          "Your plan changed while Gemini was thinking. Try again with your updated plan.",
          true,
        );
        return;
      }
      validatePlan(plan);
      setKeyVerified(true);
      setKeyTestError("");
      setProposedPlan(plan);
      notify("Your proposed budget is ready to review.");
    } catch (e) {
      setConversation(previous => [...previous, { role: "Co-pilot", text: "I could not send that request. Your budget is unchanged. Please try again." }]);
      setPrompt(text);
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function addWish() {
    if (!newName.trim() || newCost <= 0) {
      notify("Enter a name and a target price.", true);
      return;
    }
    if (
      await persist({
        ...vault,
        plan: {
          ...p,
          wishes: [
            ...p.wishes,
            {
              id: crypto.randomUUID(),
              name: newName.trim(),
              cost: newCost,
              contribution: 0,
              funded: 0,
              bought: false,
            },
          ],
        },
      })
    ) {
      setNewName("");
      notify("Added to your wishlist. Fund it on your next payday.");
    }
  }
  if (loadError)
    return (
      <div className="load-state glass">
        <ShieldCheck size={36} />
        <h2>Your vault needs attention</h2>
        <p>{loadError}</p>
        <p>Your existing data has not been overwritten.</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!ready)
    return (
      <div className="load-state">
        <LoaderCircle className="spin" />
        <p>Opening your local vault…</p>
      </div>
    );
  return (
    <CurrencyProvider currency={vault.displayCurrency ?? "GHS"} rates={vault.exchangeRates}>
      <div className="ambient one" />
      <div className="ambient two" />
      <div className="ambient three" />
      <header className="topbar">
        <div className="workspace-greeting">
          <span className="greeting-avatar">
            <Wallet size={19} />
          </span>
          <span>
            Hello, welcome back <span className="greeting-period">.</span>
            <small>Let's make this payday count.</small>
          </span>
        </div>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("overview");
          }}
        >
          <img src="./icon.svg" alt="" />
          <span>
            payday<span className="brand-dot">.</span>
          </span>
        </a>
        {view === "overview" ? (
          <div className="topbar-plan-actions">
            <button className="month-pill glass" onClick={openPayday}>
              <CalendarBlank size={15} />
              {dateLabel(p.month)}
              <ChevronDown size={14} />
            </button>
            <button
              className="primary"
              aria-label="Start payday allocation"
              onClick={committed ? nextMonth : openPayday}
            >
              <Plus size={16} />
              {committed ? "Next payday" : "Plan payday"}
            </button>
          </div>
        ) : null}
        <div className="header-right">
          <button
            className="icon-button"
            aria-label="Help"
            onClick={() => setModal("help")}
          >
            <CircleHelp size={19} />
          </button>
          <button
            className="avatar"
            aria-label="Open settings"
            onClick={() => openSettings()}
          >
            P
          </button>
        </div>
      </header>
      <main className={view === "copilot" ? "chat-main" : view === "overview" ? "overview-layout" : undefined}>
        {display.currency !== "GHS" && <div className="currency-view-notice"><span>{display.currency} estimates using {vault.exchangeRates?.source} rates dated {vault.exchangeRates?.asOf}. Inputs and original notes remain in GHS.</span><button onClick={()=>openSettings("currency")}>Currency settings</button></div>}
        {view !== "copilot" && view !== "settings" && <section
          className={`page-heading ${view === "overview" ? "overview-heading" : ""}`}
        >
          <div>
            <div className="eyebrow">YOUR PERSONAL MONEY SPACE</div>
            <h1>
              {view === "overview"
                ? "Overview"
                : view === "accounts"
                  ? "Your accounts"
                  : view === "wishlist"
                    ? "Your wishlist"
                    : "Payday history"}
            </h1>
            <p className="subtitle">
              {view === "overview"
                ? "A clear plan for your money. More room for your life."
                : view === "accounts"
                  ? "Your monthly essentials and the things you’re building towards."
                  : view === "wishlist"
                    ? "Save for it. Buy it. Make room for the next thing."
                    : "No daily logging. Just the moments that move you forward."}
            </p>
          </div>
          {view !== "overview" && (
            <>
              <button className="month-pill glass" onClick={openPayday}>
                <CalendarBlank size={15} />
                {dateLabel(p.month)}
                <ChevronDown size={15} />
              </button>
              <button
                aria-label="Start payday allocation"
                className="primary heading-payday"
                onClick={committed ? nextMonth : openPayday}
              >
                <Plus size={16} />
                {committed ? "Next payday" : "Plan payday"}
              </button>
            </>
          )}
        </section>}
        {vault.debt > 0 && view !== "settings" && view !== "copilot" && (
          <div className="debt-banner tinted red">
            <div className="banner-icon">
              <Bell size={21} />
            </div>
            <div>
              <strong>A little reminder from future you</strong>
              <p>
                You owe your {accountNames.gcb} savings {cash(vault.debt)}. Your
                next payday savings will repay this first.
              </p>
            </div>
            <button onClick={committed ? nextMonth : openPayday}>
              Plan repayment <ArrowRight size={16} />
            </button>
          </div>
        )}
        {(view === "overview" || view === "accounts") && (
          <Dashboard
            showAccounts={view === "accounts"}
            names={accountNames}
            vault={vault}
            committed={committed}
            onPlan={openPayday}
            onNext={nextMonth}
            onAccounts={() => setView("accounts")}
            onAccount={openAccount}
          />
        )}
        {view === "overview" && (
          <section className="bottom-grid">
            <AllocationCard names={accountNames} plan={p} onEdit={openPayday} />
            <AccountBreakdown
              names={accountNames}
              plan={p}
              onAccounts={() => setView("accounts")}
              onAccount={openAccount}
            />
            <div className="wish-preview glass">
              <div className="mini-section">
                <div>
                  <h2>Your next little upgrades</h2>
                  <p>Room & tech wishlist</p>
                </div>
                <button
                  aria-label="Open wishlist"
                  className="icon-button"
                  onClick={() => setView("wishlist")}
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
              {active.slice(0, 2).map((w, i) => (
                <div key={w.id} className="preview-item">
                  <div className={`wish-icon wish-${i}`}>
                    {i === 0 ? <Zap size={21} /> : <Banknote size={21} />}
                  </div>
                  <div>
                    <strong>{w.name}</strong>
                    <span>
                      {cash(w.funded)} of {cash(w.cost)}
                    </span>
                    <div className="wish-progress">
                      <span
                        style={{
                          width: `${w.cost ? Math.min((w.funded / w.cost) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="progress-number">
                    {w.cost ? Math.round((w.funded / w.cost) * 100) : 0}%
                  </span>
                </div>
              ))}
              {!active.length && (
                <p className="empty-small">
                  A clean slate for your next little upgrade.
                </p>
              )}
              <button className="text-link" onClick={() => setView("wishlist")}>
                See your wishlist <ArrowRight size={14} />
              </button>
              <button
                className="wishlist-copilot"
                onClick={() => openCopilot()}
              >
                <span className="spark-icon">
                  <Sparkles size={18} />
                </span>
                <span>
                  <strong>Your payday, simplified</strong>
                  <small>Make a plan with your AI co-pilot</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </div>
          </section>
        )}
        {view === "wishlist" && (
          <>
            <section className="glass wishlist-add">
              <div>
                <h2>What’s on your list?</h2>
                <p className="muted">
                  One-time purchases, funded a little at a time.
                </p>
              </div>
              <input
                aria-label="Wishlist item name"
                placeholder="e.g. A study table"
                value={newName}
                maxLength={100}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Field
                label="Target price"
                value={newCost}
                onChange={setNewCost}
              />
              <button className="primary" disabled={saving} onClick={addWish}>
                <Plus size={17} />
                Add to wishlist
              </button>
            </section>
            <div className="section-heading">
              <h2>
                {showArchive ? "Bought & enjoyed" : "Room & tech upgrades"}{" "}
                <span>{showArchive ? archived.length : active.length}</span>
              </h2>
              <button
                className="secondary"
                onClick={() => setShowArchive(!showArchive)}
              >
                <Archive size={15} />
                {showArchive ? "Active wishlist" : "Bought archive"}
              </button>
            </div>
            <section className="wishlist-grid">
              {(showArchive ? archived : active).map((w, i) => (
                <article className="glass wish-card" key={w.id}>
                  <div className="wish-top">
                    <div className={`wish-icon wish-${i % 2}`}>
                      <ShoppingBag size={23} />
                    </div>
                    <span className="soft-tag">
                      {w.bought
                        ? "Bought ✓"
                        : `${accountNames.first} · Room & tech`}
                    </span>
                  </div>
                  <h2>{w.name}</h2>
                  <p className="wish-price">{cash(w.cost)}</p>
                  <div className="wish-progress">
                    <span
                      style={{
                        width: `${w.cost ? Math.min((w.funded / w.cost) * 100, 100) : 100}%`,
                      }}
                    />
                  </div>
                  <div className="wish-funding">
                    <span>{cash(w.funded)} saved</span>
                    <span>
                      {Math.max(
                        0,
                        Math.round((w.cost - w.funded) * 100) / 100,
                      ) === 0
                        ? "Ready to buy"
                        : `${cash(w.cost - w.funded)} to go`}
                    </span>
                  </div>
                  {!w.bought && (
                    <button
                      className={w.funded >= w.cost ? "primary" : "secondary"}
                      disabled={saving}
                      onClick={async () => {
                        try {
                          if (await persist(buyWish(vault, w.id)))
                            notify(
                              `${w.name} is bought and archived. Enjoy it!`,
                            );
                        } catch (e) {
                          notify((e as Error).message, true);
                        }
                      }}
                    >
                      <Check size={16} />
                      Mark as bought
                    </button>
                  )}
                  {!w.bought && w.funded === 0 && (
                    <button
                      className="text-link full-width"
                      disabled={saving}
                      onClick={async () => {
                        if (
                          await persist({
                            ...vault,
                            plan: {
                              ...p,
                              wishes: p.wishes.filter(
                                (item) => item.id !== w.id,
                              ),
                            },
                          })
                        )
                          notify("Unfunded item removed from your wishlist.");
                      }}
                    >
                      Remove from wishlist
                    </button>
                  )}
                </article>
              ))}
            </section>
            {!(showArchive ? archived : active).length && (
              <div className="empty-state glass">
                <ShoppingBag size={32} />
                <h2>
                  {showArchive
                    ? "Your next good thing is on its way."
                    : "Make space for something good."}
                </h2>
                <p>
                  {showArchive
                    ? "Fully funded purchases appear here when marked as bought."
                    : "Add a room or tech upgrade above to start saving."}
                </p>
              </div>
            )}
          </>
        )}
        {view === "history" && (
          <section className="history-layout">
            <div className="glass history-panel">
              <div className="section-heading">
                <h2>Payday history</h2>
                <span className="soft-tag">{vault.history.length} paydays</span>
              </div>
              {vault.history.map((h) => (
                <div
                  className="history-row"
                  key={h.planId ?? `${h.month}-${h.date}`}
                >
                  <div className="history-icon">
                    <ArrowDownLeft size={21} />
                  </div>
                  <div>
                    <strong>{dateLabel(h.month)}</strong>
                    <p>
                      {cash(h.savings)} saved
                      {h.repaid > 0 ? ` · ${cash(h.repaid)} debt repaid` : ""}
                    </p>
                  </div>
                  <strong>{cash(h.salary)}</strong>
                </div>
              ))}
              {!vault.history.length && (
                <div className="empty-state">
                  <History size={30} />
                  <h3>Your first chapter starts on payday.</h3>
                  <p>Save your allocation to begin your history.</p>
                  <button className="primary" onClick={openPayday}>
                    Plan my payday
                  </button>
                </div>
              )}
            </div>
            <div className="glass history-panel">
              <h2>The meaningful moments</h2>
              {vault.activity.slice(0, 30).map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className={`activity-dot ${a.kind}`} />
                  <div>
                    <p>{a.text}</p>
                    <small>
                      {new Date(a.date).toLocaleDateString("en-GH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </small>
                  </div>
                </div>
              ))}
              {!vault.activity.length && (
                <p className="muted">
                  Savings, emergency borrowing, and wishlist wins will appear
                  here.
                </p>
              )}
            </div>
          </section>
        )}
        {view === "copilot" && (
          <section className="chat-page" aria-label="Payday co-pilot chat">
            <header className="chat-header">
              <div className="chat-avatar"><Sparkles size={25} /></div>
              <div><h1>Payday co-pilot</h1><p>{busy ? (preparingBudget ? "Preparing your budget..." : waitingLong ? "Thinking..." : "Typing...") : hasKey ? "Here to help you plan" : "Connect Gemini in Settings to chat"}</p></div>
              <span className="soft-tag">{dateLabel((aiInDraft ? draft : p).month)}{aiInDraft ? " draft" : " budget"}</span>
            </header>
            <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation">
              <div className="chat-bubble assistant"><p>Hi! Ask about your saved budget, talk through an expense, or tell me what you need this payday.</p></div>
              {conversation.map((message, index) => <div key={index} className={`chat-bubble ${message.role === "You" ? "user" : "assistant"}`}><small>{message.role}</small><p>{message.text}</p></div>)}
              {busy && (preparingBudget ? (
                <div className="chat-bubble assistant budget-working" role="status" aria-label="Co-pilot is preparing your budget">
                  <div className="budget-working-top"><div className="budget-orbit"><Sparkles size={22}/><i/></div><div><strong>Working on your budget</strong><p>Putting your request and selected budget together.</p></div></div>
                  <div className="budget-preview" aria-hidden="true"><span/><span/><span/><span/></div>
                  <small>{waitingLong ? "Still waiting for Gemini's response. This can take a moment." : "Your saved allocations stay unchanged until you review."}</small>
                </div>
              ) : <div className="chat-bubble assistant chat-typing" role="status" aria-label="Co-pilot is typing"><span /><span /><span /><small>{waitingLong ? "Still thinking ? waiting for Gemini" : "Typing"}</small></div>)}
              {proposedPlan && <div className="chat-bubble assistant"><strong>Budget proposal ready</strong><p>Your saved allocations stay unchanged until you review and save.</p><button className="primary" onClick={() => { setDraft(committed && !aiInDraft ? {...proposedPlan, id: nextPaydayPlan(p).id} : proposedPlan); setProposedPlan(null); setModal("payday"); }}>Review proposed budget <ArrowRight size={16}/></button></div>}
              <div ref={chatEnd} />
            </div>
            <form className="chat-composer" onSubmit={e => { e.preventDefault(); if(hasKey) void runAI(); else openSettings("gemini"); }}>
              <p className="chat-context"><LockKeyhole size={13}/> When you send: your message, recent chat, selected budget, savings balance and self-debt go to Gemini. No bank login or API key is included in the chat.</p>
              <div className="chat-input-row"><textarea aria-label="Tell your payday co-pilot about your month" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={6000} placeholder="Message your co-pilot..." rows={2} onKeyDown={e => { if(e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if(!busy && prompt.trim()) { if(hasKey) void runAI(); else openSettings("gemini"); } } }}/><button type="submit" className="primary" disabled={busy || saving || (hasKey && !prompt.trim())} aria-label={hasKey ? "Send message" : "Connect Gemini"}>{busy ? <LoaderCircle className="spin" size={20}/> : <ArrowUpRight size={22}/>}<span>{hasKey ? "Send" : "Connect Gemini"}</span></button></div>
            </form>
          </section>
        )}
        {view === "settings" && (
          <div className="settings-page">
            <header className="settings-page-heading">
              <div><span className="settings-eyebrow">MAKE IT YOURS</span><h1>Settings</h1><p>Your accounts, your assistant, and your data.</p></div>
              <span className="settings-version">Payday {updateState?.currentVersion ?? "1.5.1"}</span>
            </header>
            <nav className="settings-links" aria-label="Settings sections" role="tablist">
              {[{id:"accounts",name:"Accounts",Icon:Wallet},{id:"currency",name:"Currency",Icon:Banknote},{id:"gemini",name:"AI co-pilot",Icon:Sparkles},{id:"backup",name:"Backups & storage",Icon:ShieldCheck},{id:"updates",name:"Updates",Icon:Download},{id:"reset",name:"Reset & uninstall",Icon:RefreshCw}].map(({id,name,Icon},index)=><button key={id} type="button" id={`settings-tab-${id}`} role="tab" aria-selected={settingsTab===id} aria-controls={`settings-panel-${id}`} tabIndex={settingsTab===id?0:-1} onClick={()=>setSettingsTab(id)} onKeyDown={event=>{const tabs=["accounts","currency","gemini","backup","updates","reset"];let next=index;if(event.key==="ArrowRight")next=(index+1)%tabs.length;else if(event.key==="ArrowLeft")next=(index+tabs.length-1)%tabs.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=tabs.length-1;else return;event.preventDefault();setSettingsTab(tabs[next]);document.getElementById(`settings-tab-${tabs[next]}`)?.focus();}}><Icon size={16}/>{name}</button>)}
            </nav>
            <div className="settings-grid settings-panels">
          <div hidden={settingsTab!=="accounts"}>
          <AccountSettings
            names={accountNames}
            disabled={saving}
            onSave={async (names) => {
              if (
                await persist({
                  ...vault,
                  accountNames: accountNamesSchema.parse(names),
                })
              )
                notify("Account names updated.");
            }}
          />
          </div>
          {settingsTab==="currency" && <CurrencySettings key={`${vault.displayCurrency}-${vault.exchangeRates?.fetchedAt}`} currency={vault.displayCurrency ?? "GHS"} rates={vault.exchangeRates} disabled={saving||busy} onSave={async(currency,rates)=>{const saved=await persist({...vault,displayCurrency:currency,exchangeRates:rates});if(saved)notify("Currency preferences saved.");return saved;}}/>}
          <section hidden={settingsTab!=="gemini"} role="tabpanel" aria-labelledby="settings-tab-gemini" className="setting-section" id="settings-panel-gemini">
            <div className="setting-title">
              <Sparkles size={21} />
              <div>
                <h2>AI co-pilot</h2>
                <p>Optional. Your manual planner always works offline.</p>
              </div>
              <span className={`connection ${hasKey ? "connected" : ""}`}>
                {hasKey ? (keyVerified ? "Verified" : "Key saved") : "No key"}
              </span>
            </div>
            <label className="field">
              <span>Google AI Studio API key</span>
              <input
                type="password"
                disabled={testingKey || busy}
                autoComplete="off"
                placeholder={
                  hasKey
                    ? "A key is saved securely"
                    : "Paste your GEMINI_API_KEY"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                maxLength={500}
              />
            </label>
            <p className="settings-note">
              Your key is encrypted using Windows credential protection. When you send a chat message, Gemini receives your selected budget, recent conversation and relevant savings figures.
            </p>
            <div className="button-row">
              <button
                className="primary"
                disabled={!apiKey.trim() || saving || testingKey || busy}
                onClick={async () => {
                  try {
                    await storage.setKey(apiKey);
                    setHasKey(true);
                    setKeyVerified(false);
                    setKeyTestError("");
                    setApiKey("");
                    notify("Gemini key saved securely on this device.");
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                <Check size={16} />
                Save key
              </button>
              {hasKey && (
                <button
                  className="secondary"
                  disabled={testingKey || busy || saving || !!apiKey.trim()}
                  onClick={async () => {
                    setTestingKey(true);
                    setKeyTestError("");
                    try {
                      await storage.checkKey();
                      setKeyVerified(true);
                      notify(
                        "Google accepted the key and replied successfully.",
                      );
                    } catch (e) {
                      setKeyVerified(false);
                      setKeyTestError((e as Error).message);
                      notify((e as Error).message, true);
                    } finally {
                      setTestingKey(false);
                    }
                  }}
                >
                  {testingKey ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <ShieldCheck size={15} />
                  )}{" "}
                  {testingKey ? "Testing Google..." : "Test connection"}
                </button>
              )}
              {hasKey && (
                <button
                  className="secondary"
                  disabled={testingKey || busy || saving}
                  onClick={async () => {
                    try {
                      await storage.setKey("");
                      setHasKey(false);
                      setKeyVerified(false);
                      setKeyTestError("");
                      setApiKey("");
                      notify("Gemini key removed.");
                    } catch (e) {
                      notify((e as Error).message, true);
                    }
                  }}
                >
                  Remove key
                </button>
              )}
            </div>
            <p className="settings-note">
              Key saved means stored locally, not verified by Google. Test
              connection sends a small test message only; it does not send your
              budget. Model: Gemini 3.5 Flash.
            </p>
            {keyTestError && (
              <p className="danger-text settings-note">{keyTestError}</p>
            )}
          </section>
          <section hidden={settingsTab!=="backup"} role="tabpanel" aria-labelledby="settings-tab-backup" className="setting-section" id="settings-panel-backup">
            <div className="setting-title">
              <ShieldCheck size={21} />
              <div>
                <h2>Backups & storage</h2>
                <p>
                  {window.payday
                    ? "payday-vault.json · Windows app data"
                    : "Temporary preview: memory only"}
                </p>
              </div>
            </div>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  if (await storage.export(vault))
                    notify(
                      "Encrypted backup exported. It opens only under this Windows account.",
                    );
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            >
              <Download size={16} />
              Export encrypted backup
            </button>
            <label className="secondary import-label">
              <RefreshCw size={16} />
              Restore backup
              <input
                aria-label="Restore JSON backup"
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    if (f.size > 5000000)
                      throw new Error("Backup is too large.");
                    const restored = await storage.decodeBackup(await f.text());
                    if (await persist(restored)) {
                      setModal(null);
                      notify("Vault restored from your backup.");
                    }
                  } catch (err) {
                    notify(
                      `Could not restore: ${(err as Error).message}`,
                      true,
                    );
                  }
                }}
              />
            </label>
            <p className="settings-note">
              Restoring replaces the current plan and history with the selected
              backup. Backups are encrypted to this Windows account; API keys
              are never included. Keep Windows account recovery available.
            </p>
          </section>
          <section hidden={settingsTab!=="updates"} role="tabpanel" aria-labelledby="settings-tab-updates" className="setting-section settings-updates" id="settings-panel-updates">
            <div className="setting-title"><Download size={21}/><div><h2>App updates</h2><p>New versions from Juny-max / Payday on GitHub.</p></div></div>
            <p className="settings-note" role="status">{updateState?.message ?? "Open the installed Windows app to check for updates."}</p>
            {updateState?.status === "downloading" && <div className="update-progress"><progress aria-label="Update download progress" max="100" value={updateState.percent}/><span>{Math.round(updateState.percent)}%</span></div>}
            <div className="button-row">
              <button className="secondary" disabled={!updateState || ["unavailable","checking","downloading","ready","installing"].includes(updateState.status) || saving || busy} onClick={() => void updateAction("checkUpdates")}><RefreshCw size={16} className={updateState?.status === "checking" ? "spin" : ""}/>{updateState?.status === "checking" ? "Checking..." : "Check for updates"}</button>
              {updateState?.status === "available" && <button className="primary" disabled={saving||busy} onClick={() => void updateAction("downloadUpdate")}><Download size={16}/>Download {updateState.version}</button>}
              {updateState?.status === "ready" && <button className="primary" disabled={saving||busy||testingKey} onClick={() => void updateAction("installUpdate")}><RefreshCw size={16}/>Restart and install</button>}
            </div>
            <p className="settings-note">Nothing downloads until you choose. Updating keeps your saved budgets and API key. Finish any unsaved edits before restarting.</p>
          </section>
          <section hidden={settingsTab!=="reset"} role="tabpanel" aria-labelledby="settings-tab-reset" className="setting-section settings-danger" id="settings-panel-reset">
            <div className="settings-card-icon"><RefreshCw size={23}/></div>
            <h2>Reset or uninstall</h2>
            <p className="settings-note">
              Clear practice data to start again, or open the installed app's
              Windows uninstall wizard.
            </p>
            <p className="settings-danger-note">Reset permanently clears your records and API key. You will be asked to confirm. Uninstall opens the Windows wizard; keep data deletion selected to remove saved files too.</p>
            <div className="button-row">
              <button
                className="danger-outline"
                disabled={saving || busy}
                onClick={() => setModal("reset")}
              >
                Reset everything
              </button>
              <button
                className="secondary"
                disabled={saving}
                onClick={async () => {
                  try {
                    await storage.uninstall();
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                Open uninstall wizard
              </button>
            </div>
          </section>
            </div>
          </div>
        )}
      </main>
      <nav className="dock glass" aria-label="Main navigation">
        <a
          className="sidebar-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("overview");
          }}
        >
          <img src="./icon.svg" alt="" />
          <span>
            payday<span>.</span>
          </span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        {(
          [
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "accounts", label: "Accounts", icon: Wallet },
            { id: "wishlist", label: "Wishlist", icon: ShoppingBag },
            { id: "history", label: "History", icon: History },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            aria-current={view === item.id ? "page" : undefined}
            className={view === item.id ? "selected" : ""}
            onClick={() => setView(item.id)}
          >
            <item.icon size={19} />
            <span>{item.label}</span>
          </button>
        ))}
        <button className={`sidebar-copilot ${view === "copilot" ? "selected" : ""}`} aria-current={view === "copilot" ? "page" : undefined} onClick={() => openCopilot()}>
          <Sparkles size={19} />
          <span>Payday co-pilot</span>
        </button>
        <div className="dock-separator" />
        <button className="sidebar-help" onClick={() => setModal("help")}>
          <CircleHelp size={19} />
          <span>Help & getting started</span>
        </button>
        <button aria-label="Settings" aria-current={view === "settings" ? "page" : undefined} className={view === "settings" ? "selected" : ""} onClick={() => openSettings()}>
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button
          className="dock-payday"
          onClick={committed ? nextMonth : openPayday}
        >
          <Plus size={19} />
          <span>{committed ? "Next payday" : "Plan payday"}</span>
        </button>
      </nav>
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast tinted ${toast.error ? "red" : "green"}`}
        >
          {toast.error ? <Bell size={19} /> : <CircleCheck size={19} />}
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "help" && (
        <ModalFrame
          title="A calmer kind of budgeting."
          subtitle="Two moments. That’s all you need."
          onClose={() => setModal(null)}
        >
          <div className="help-step">
            <div>01</div>
            <section>
              <h3>On payday, give every cedi a home.</h3>
              <p>
                Enter your salary, lock in commute and data, then split savings,
                feeding and a little living. Save payday after reviewing your
                plan, then make the real transfers yourself.
              </p>
            </section>
          </div>
          <div className="help-step">
            <div>02</div>
            <section>
              <h3>Come back when life happens.</h3>
              <p>
                Record emergency borrowing from GCB or mark a funded wishlist
                item as bought. Your next savings deposit pays your internal
                debt first. No daily expense logging.
              </p>
            </section>
          </div>
          <p className="settings-note">
            Fresh paydays start at zero. Existing savings and history are
            retained. The savings vault grows when you save a payday. Wishlist
            contributions roll forward; bought items stay archived.
          </p>
        </ModalFrame>
      )}
      {modal === "account" && (
        <ModalFrame
          title={accountNames[selectedAccount]}
          subtitle={accountReport(vault, selectedAccount).purpose}
          onClose={() => setModal(null)}
        >
          <AccountReportDetails vault={vault} account={selectedAccount} />
        </ModalFrame>
      )}
      {modal === "reset" && (
        <ModalFrame
          title="Reset all Payday data?"
          subtitle="This clears all local financial records and starts from zero."
          onClose={() => {setModal(null);setView("settings");setSettingsTab("reset");}}
        >
          <div className="reset-warning">
            <strong>This will clear:</strong>
            <p>
              Payday history, balances, self-debt, wishlist items, account names
              and your saved Gemini API key.
            </p>
            <p>
              Only Payday data is affected. Export an encrypted backup first if
              you might need these records later.
            </p>
          </div>
          <button
            className="secondary"
            disabled={saving}
            onClick={async () => {
              try {
                if (await storage.export(vault))
                  notify("Encrypted backup exported.");
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            <Download size={16} />
            Export backup first
          </button>
          <div className="button-row reset-actions">
            <button
              className="secondary"
              disabled={saving}
              onClick={() => {setModal(null);setSettingsTab("reset");}}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              disabled={saving || busy}
              onClick={async () => {
                setSaving(true);
                try {
                  const fresh = await storage.reset();
                  setVault(fresh);
                  setDraft(fresh.plan);
                  setHasKey(false);
                  setKeyVerified(false);
                  setKeyTestError("");
                  setApiKey("");
                  setPrompt("");
                  setConversation([]);
                  setBorrowAmount(0);
                  setNewName("");
                  setNewCost(0);
                  setShowArchive(false);
                  setProposedPlan(null);
                  setView("overview");
                  setModal(null);
                  notify(
                    "Payday has been reset. All balances and history are zero.",
                  );
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Resetting..." : "Yes, reset everything"}
            </button>
          </div>
        </ModalFrame>
      )}
      {modal === "borrow" && (
        <ModalFrame
          title={accountNames.gcb}
          subtitle={accountReport(vault, "gcb").purpose}
          onClose={() => setModal(null)}
        >
          <AccountReportDetails vault={vault} account="gcb" />
          <h3 className="borrow-heading">Request borrowing</h3>
          <Field
            label="How much do you need?"
            value={borrowAmount}
            onChange={setBorrowAmount}
            max={vault.savingsBalance}
          />
          <div className="warning-note">
            <Bell size={18} />
            <p>
              This becomes a debt to yourself. It moves into your recorded
              emergency pocket, and your next payday savings repay it first.
            </p>
          </div>
          <button
            className="primary full-width"
            disabled={saving || borrowAmount <= 0}
            onClick={async () => {
              try {
                if (await persist(borrow(vault, borrowAmount))) {
                  setModal(null);
                  notify(
                    `${cash(borrowAmount)} borrowing recorded. Remember to make the bank transfer.`,
                  );
                }
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            Record borrowing <ArrowRight size={16} />
          </button>
        </ModalFrame>
      )}
      {modal === "payday" && (
        <ModalFrame
          wide
          title={
            draftLocked
              ? "Your payday, all planned."
              : "Let’s give your money a plan."
          }
          subtitle="Enter your actual pay and commute. The offline split updates automatically."
          onClose={() => setModal(null)}
        >
          <fieldset
            disabled={saving || draftLocked}
            className="planner-fieldset"
          >
            <button
              type="button"
              className="secondary"
              disabled={draftLocked}
              onClick={() => openCopilot(true)}
            >
              <Sparkles size={16} />
              Plan this payday with AI
            </button>
            <p className="settings-note">
              Pay, commute and data changes recalculate the pockets. The
              suggestion protects feeding first (up to 45% of pay when
              available), then optional data and up to 15% savings. Manual
              pocket edits rebalance the others.
            </p>
            <div className="planner-top">
              <label className="field">
                <span>Payday month</span>
                <input
                  type="month"
                  value={draft.month}
                  onChange={(e) => {
                    if (e.target.value) updateDraft("month", e.target.value);
                  }}
                />
              </label>
              <Field
                label="Take-home salary"
                value={draft.salary}
                onChange={(v) => updateDraft("salary", v)}
              />
            </div>
            <section className="planner-section">
              <h3>
                <TrainFront size={18} />
                {accountNames.telecel} · commute & data
              </h3>
              <div className="planner-three">
                <Field
                  label="Daily in & out fare"
                  value={draft.daily}
                  onChange={(v) => updateDraft("daily", v)}
                />
                <label className="field">
                  <span>Days per week</span>
                  <input
                    aria-label="Days per week"
                    type="number"
                    min={0}
                    max={7}
                    value={draft.workWeek?.length ?? 0}
                    onChange={(e) =>
                      updateDraft(
                        "workWeek",
                        [1, 2, 3, 4, 5, 6, 0].slice(
                          0,
                          Math.max(
                            0,
                            Math.min(7, Math.floor(Number(e.target.value))),
                          ),
                        ),
                      )
                    }
                  />
                </label>
                <div className="locked-total">
                  <LockKeyhole size={16} />
                  <span>
                    Monthly transport<strong>{cash(transport(draft))}</strong>
                  </span>
                </div>
              </div>
              <div className="weekday-picker" aria-label="Work weekdays">
                {[
                  { day: 1, name: "Monday", short: "Mon" },
                  { day: 2, name: "Tuesday", short: "Tue" },
                  { day: 3, name: "Wednesday", short: "Wed" },
                  { day: 4, name: "Thursday", short: "Thu" },
                  { day: 5, name: "Friday", short: "Fri" },
                  { day: 6, name: "Saturday", short: "Sat" },
                  { day: 0, name: "Sunday", short: "Sun" },
                ].map((w) => (
                  <button
                    key={w.day}
                    type="button"
                    aria-pressed={draft.workWeek?.includes(w.day) ?? false}
                    aria-label={w.name}
                    onClick={() =>
                      updateDraft(
                        "workWeek",
                        (draft.workWeek ?? []).includes(w.day)
                          ? (draft.workWeek ?? []).filter((d) => d !== w.day)
                          : [...(draft.workWeek ?? []), w.day],
                      )
                    }
                  >
                    {w.short}
                  </button>
                ))}
              </div>
              <p className="calendar-summary">
                {monthlyWorkdays(draft)} scheduled workdays in{" "}
                {dateLabel(draft.month)} ? {cash(draft.daily)} ={" "}
                <strong>{cash(transport(draft))}</strong>. Calendar weekdays
                only; holidays and leave are not deducted.
              </p>
              {draft.pendingData && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDraft((d) => continueDataPlan(d))}
                >
                  Continue previous data plan ({draft.pendingData.remaining}{" "}
                  payday left)
                </button>
              )}
              <div className="data-toggle-row">
                <div>
                  <strong>Fund data this month?</strong>
                  <p>
                    Leave off if you have enough data or your company provides
                    it.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.data !== "company"}
                  aria-label="Fund data this month"
                  className={`data-switch ${draft.data !== "company" ? "on" : ""}`}
                  onClick={() =>
                    setDraft((d) =>
                      balancePlan({
                        ...d,
                        data: d.data === "company" ? "custom" : "company",
                        dataRequested: 0,
                        dataReserve: 0,
                        dataMonthsRemaining: d.data === "company" ? 1 : 0,
                        midnight: 0,
                      }),
                    )
                  }
                >
                  <span />
                </button>
              </div>
              {draft.data !== "company" && (
                <div className="data-funding-options">
                  <label className="field">
                    <span>Funding schedule</span>
                    <select
                      aria-label="Data funding schedule"
                      value={
                        (draft.dataMonthsRemaining ?? 1) + (draftLocked ? 1 : 0)
                      }
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          dataMonthsRemaining: Number(e.target.value),
                        }))
                      }
                    >
                      <option value={1}>This payday only</option>
                      <option value={2}>
                        This payday + next payday, then off
                      </option>
                    </select>
                  </label>
                  <Field
                    label="Requested monthly data reserve"
                    value={dataRequest(draft)}
                    onChange={(v) => updateDraft("dataRequested", v)}
                    hint="Choose any amount. GH 399 bundle / GH 200 split are optional shortcuts."
                  />
                  <div className="data-shortcuts">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setDraft((d) =>
                          balancePlan({
                            ...d,
                            data: "full",
                            dataRequested: 399,
                            dataMonthsRemaining: 1,
                          }),
                        )
                      }
                    >
                      Request full 399
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setDraft((d) =>
                          balancePlan({
                            ...d,
                            data: "half",
                            dataRequested: 200,
                            dataMonthsRemaining: 2,
                          }),
                        )
                      }
                    >
                      Request 200 for 2 paydays
                    </button>
                  </div>
                  <p className="data-actual">
                    Reserved in this plan:{" "}
                    <strong>{cash(dataCost(draft))}</strong>
                    {dataCost(draft) < dataRequest(draft) && (
                      <span>
                        {" "}
                        Your pay cannot cover the full request after commute and
                        feeding.
                      </span>
                    )}
                  </p>
                  <Field
                    label="Midnight download buffer (optional)"
                    value={draft.midnight}
                    max={50}
                    onChange={(v) => updateDraft("midnight", v)}
                    hint="Optional, and included only while data funding is on."
                  />
                  <p className="settings-note">
                    The switch funds only the selected paydays; it turns off for
                    the following payday. A lower affordable reserve may not
                    cover a full bundle. Review before saving.
                  </p>
                </div>
              )}
            </section>
            <section className="planner-section">
              <div className="savings-heading">
                <h3>
                  <ShieldCheck size={18} />
                  {accountNames.gcb} · pay future you first
                </h3>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    updateDraft("savings", balancePlan(draft).savings)
                  }
                >
                  Accept {cash(balancePlan(draft).savings)} suggestion
                </button>
              </div>
              <div className="range-row">
                <input
                  aria-label="Savings percentage"
                  type="range"
                  min={0}
                  max={Math.max(1, affordablePool(draft))}
                  step={1}
                  value={draft.savings}
                  onChange={(e) =>
                    updateDraft("savings", Number(e.target.value))
                  }
                />
                <Field
                  label={`Savings · ${draft.salary ? Math.round((draft.savings / draft.salary) * 100) : 0}%`}
                  value={draft.savings}
                  onChange={(v) => updateDraft("savings", v)}
                />
              </div>
              {vault.debt > 0 && view !== "settings" && view !== "copilot" && (
                <p className="danger-text">
                  {cash(Math.min(vault.debt, draft.savings))} will repay your
                  self-debt first.
                </p>
              )}
            </section>
            <section className="planner-section">
              <h3>
                <Utensils size={18} />
                {accountNames.momo} · feeding pocket
              </h3>
              <div className="planner-two">
                <Field
                  label="Bulk cooking foodstuffs"
                  value={draft.bulk}
                  sliderMax={draft.salary}
                  onChange={(v) => updateDraft("bulk", v)}
                />
                <Field
                  label="Buying food outside"
                  value={draft.outside}
                  sliderMax={draft.salary}
                  onChange={(v) => updateDraft("outside", v)}
                />
              </div>
            </section>
            <section className="planner-section">
              <h3>
                <Heart size={18} />
                {accountNames.first} · a little living
              </h3>
              <div className="planner-two">
                <Field
                  label="Wardrobe & upkeep"
                  value={draft.wardrobe}
                  sliderMax={draft.salary}
                  onChange={(v) => updateDraft("wardrobe", v)}
                />
                <Field
                  label="Partner & social buffer"
                  value={draft.partner}
                  sliderMax={draft.salary}
                  onChange={(v) => updateDraft("partner", v)}
                />
              </div>
              {draft.wishes
                .filter((w) => !w.bought)
                .map((w) => (
                  <div className="wish-allocation" key={w.id}>
                    <span>
                      <strong>{w.name}</strong>
                      <small>
                        {cash(w.funded)} saved · {cash(w.cost)} target
                      </small>
                    </span>
                    <Field
                      label="This payday"
                      value={w.contribution}
                      max={Math.max(0, w.cost - w.funded)}
                      onChange={(v) =>
                        updateDraft(
                          "wishes",
                          draft.wishes.map((item) =>
                            item.id === w.id
                              ? { ...item, contribution: v }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
            </section>
            <button
              type="button"
              className="secondary full-width"
              onClick={() => {
                try {
                  setDraft(balancePlan(draft));
                  notify(
                    transportDeficit(draft) > 0
                      ? "Commute exceeds pay. Review the shortfall below."
                      : "Affordable split recalculated. Review your amounts below.",
                  );
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            >
              <Sparkles size={16} />
              Suggest a balanced split · offline
            </button>
          </fieldset>
          {draft.salary > 0 && (
            <div
              className={`budget-reality ${transportDeficit(draft) > 0 ? "deficit" : ""}`}
              role="status"
            >
              <strong>
                {transportDeficit(draft) > 0
                  ? `Commute shortfall: ${cash(transportDeficit(draft))}`
                  : `After commute: ${cash(Math.max(0, draft.salary - transport(draft)))}`}
              </strong>
              <p>
                {transportDeficit(draft) > 0
                  ? `Your transport costs ${cash(transport(draft))}, more than your pay. All other pockets are zero. Reduce the commute cost or arrange extra support before saving this payday.`
                  : `Feeding gets ${cash(draft.bulk + draft.outside)}; savings gets ${cash(draft.savings)}. ${transport(draft) / draft.salary > 0.5 ? "Transport uses more than half your pay, so the other pockets are tight." : "Amounts scale automatically when pay or transport changes."}`}
              </p>
            </div>
          )}
          <p className="settings-note">
            The automatic split assigns all available money, so the remainder is
            zero. Reduce a pocket manually to leave money unallocated, or use
            the balanced-split button to distribute it again.
          </p>
          <div
            className={`planner-total ${remaining(draft) < 0 ? "over" : ""}`}
          >
            <span>
              {remaining(draft) < 0
                ? "Essential-cost shortfall"
                : "Unallocated money"}
            </span>
            <strong>{cash(Math.abs(remaining(draft)))}</strong>
          </div>
          <p className="settings-note">
            Saving payday records your allocations and funds wishlist goals. It
            does not move money between banks. Saved paydays are locked to
            prevent duplicate savings.
          </p>
          <div className="planner-actions">
            {draftLocked ? (
              <>
                <span className="positive-text">
                  <Check size={16} />
                  Payday saved
                </span>
                <button className="primary" onClick={nextMonth}>
                  Start next payday <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  className="secondary"
                  disabled={saving}
                  onClick={() => saveDraft(false)}
                >
                  Save draft
                </button>
                <button
                  className="primary"
                  disabled={saving || remaining(draft) < 0 || draft.salary <= 0}
                  onClick={() => saveDraft(true)}
                >
                  <Check size={16} />
                  Save payday
                </button>
              </>
            )}
          </div>
        </ModalFrame>
      )}
    </CurrencyProvider>
  );
}
