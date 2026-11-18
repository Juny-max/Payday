import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react";

type Step = {
  view: "overview" | "accounts" | "wishlist" | "history" | "copilot" | "settings";
  tab?: string;
  target: string;
  title: string;
  body: string;
};

type Placement = "top" | "right" | "bottom" | "left" | "floating";
type Layout = {
  left: number;
  top: number;
  width: number;
  height: number;
  popLeft: number;
  popTop: number;
  popWidth: number;
  popMaxHeight: number;
  placement: Placement;
};

const margin = 16;
const gap = 16;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export const tourSteps: Step[] = [
  { view: "overview", target: ".balance-card", title: "Start with your payday", body: "Allocate payday opens your plan. Enter the salary you actually received, choose the month, then enter your return fare and work weekdays. Transport uses that month's calendar. Nothing is transferred between banks." },
  { view: "overview", target: ".allocation-card", title: "Give every amount a purpose", body: "This chart shows how your salary is split and what is left to allocate. Suggestions adapt to your pay. Review the figures before saving; each payday can only be saved once." },
  { view: "accounts", target: ".bank-grid", title: "Your four money pockets", body: "Savings, commute and data, food, and lifestyle each have a breakdown. Open an account to see its split. The savings account also records borrowing and the amount you owe yourself. Account names can be changed in Settings." },
  { view: "wishlist", target: ".wishlist-add", title: "Fund something you want", body: "Add a goal with its price, then contribute through your payday plan. Funded money carries forward. Mark an item bought when you purchase it; bought items are archived instead of repeating next month." },
  { view: "history", target: ".history-layout", title: "Keep a record of your paydays", body: "History shows saved paydays, savings and recorded adjustments. The same monthly salary is fine: every payday is a separate record. You do not need to log every meal or journey." },
  { view: "copilot", target: ".chat-header", title: "Talk through your plan", body: "The optional AI co-pilot can answer questions using your selected budget or suggest an allocation. A key is needed only for AI. Messages are sent when you choose Send, and proposed budgets wait for your review." },
  { view: "settings", tab: "currency", target: "#settings-panel-currency", title: "Choose your currency view", body: "Choose GHS, USD or GBP here. USD and GBP show converted estimates using dated rates you refresh or enter manually. Your original records and editable inputs stay in GHS, and saved rates work offline." },
  { view: "settings", tab: "backup", target: "#settings-panel-backup", title: "Keep a backup", body: "Export an encrypted copy of your records before a major change. Restore replaces the current records with that backup. Backups work under the same Windows account and never include your Gemini key." },
  { view: "settings", tab: "updates", target: "#settings-panel-updates", title: "Know when an update is ready", body: "Payday occasionally checks for updates while open. An Update badge appears on Settings when a new version is found. You choose when to download, restart and install; updates keep your saved records." },
  { view: "settings", tab: "reset", target: "#settings-panel-reset", title: "You control your data", body: "Reset asks for confirmation before clearing records and your AI key. Uninstall opens the Windows wizard; keep data deletion selected to remove saved files too. You can restart this tour anytime from Help & getting started." },
];

const initialLayout: Layout = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  popLeft: margin,
  popTop: margin,
  popWidth: 360,
  popMaxHeight: 600,
  placement: "floating",
};

export default function GuidedTour({
  index,
  onNext,
  onBack,
  onClose,
}: {
  index: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const step = tourSteps[index];
  const dialog = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(initialLayout);

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(step.target);
    target?.scrollIntoView({ block: "center", behavior: "instant" });

    const position = () => {
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxWidth = Math.min(380, viewportWidth - margin * 2);
      const maxHeight = Math.max(220, viewportHeight - margin * 2);
      const dialogHeight = Math.min(
        dialog.current?.scrollHeight ?? 360,
        maxHeight,
      );
      const rect = target?.getBoundingClientRect();
      const padding = 7;

      let next: Layout = {
        ...initialLayout,
        popWidth: maxWidth,
        popMaxHeight: maxHeight,
        popLeft: Math.max(margin, (viewportWidth - maxWidth) / 2),
        popTop: clamp(
          (viewportHeight - dialogHeight) / 2,
          margin,
          viewportHeight - dialogHeight - margin,
        ),
      };

      if (rect) {
        const left = clamp(rect.left - padding, 8, viewportWidth - 8);
        const top = clamp(rect.top - padding, 8, viewportHeight - 8);
        const width = Math.max(0, Math.min(rect.width + padding * 2, viewportWidth - left - 8));
        const height = Math.max(0, Math.min(rect.height + padding * 2, viewportHeight - top - 8));
        const roomBelow = viewportHeight - rect.bottom - gap - margin;
        const roomAbove = rect.top - gap - margin;
        const leftWidth = rect.left - gap - margin;
        const rightWidth = viewportWidth - rect.right - gap - margin;
        const minimumSideWidth = Math.min(240, maxWidth);

        next = { ...next, left, top, width, height };

        if (roomBelow >= dialogHeight) {
          next = {
            ...next,
            placement: "bottom",
            popLeft: clamp(rect.left, margin, viewportWidth - maxWidth - margin),
            popTop: rect.bottom + gap,
          };
        } else if (roomAbove >= dialogHeight) {
          next = {
            ...next,
            placement: "top",
            popLeft: clamp(rect.left, margin, viewportWidth - maxWidth - margin),
            popTop: rect.top - gap - dialogHeight,
          };
        } else if (Math.max(leftWidth, rightWidth) >= minimumSideWidth) {
          const useLeft = leftWidth >= rightWidth;
          const sideWidth = Math.min(maxWidth, useLeft ? leftWidth : rightWidth);
          next = {
            ...next,
            placement: useLeft ? "left" : "right",
            popLeft: useLeft ? rect.left - gap - sideWidth : rect.right + gap,
            popTop: clamp(
              rect.top + (rect.height - dialogHeight) / 2,
              margin,
              viewportHeight - dialogHeight - margin,
            ),
            popWidth: sideWidth,
          };
        } else {
          const useBelow = roomBelow >= roomAbove;
          const availableHeight = Math.max(220, Math.min(maxHeight, useBelow ? roomBelow : roomAbove));
          next = {
            ...next,
            placement: useBelow ? "bottom" : "top",
            popLeft: clamp(rect.left, margin, viewportWidth - maxWidth - margin),
            popTop: useBelow
              ? clamp(rect.bottom + gap, margin, viewportHeight - availableHeight - margin)
              : clamp(rect.top - gap - availableHeight, margin, viewportHeight - availableHeight - margin),
            popMaxHeight: availableHeight,
          };
        }
      }

      setLayout((previous) =>
        Object.keys(next).every(
          (key) => previous[key as keyof Layout] === next[key as keyof Layout],
        )
          ? previous
          : next,
      );
    };

    position();
    const frame = requestAnimationFrame(position);
    const observer = new ResizeObserver(position);
    if (target) observer.observe(target);
    if (dialog.current) observer.observe(dialog.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    dialog.current?.querySelector<HTMLButtonElement>("[data-tour-next]")?.focus({ preventScroll: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [index, step.target]);

  return (
    <div className="tour-layer">
      <div
        className="tour-spotlight"
        aria-hidden="true"
        style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
      />
      <div
        ref={dialog}
        className="tour-popover"
        data-placement={layout.placement}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
        style={{
          left: layout.popLeft,
          top: layout.popTop,
          width: layout.popWidth,
          maxHeight: layout.popMaxHeight,
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const buttons = [...dialog.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
            const first = buttons[0];
            const last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="tour-meta">
          <span>QUICK TOUR / {index + 1} OF {tourSteps.length}</span>
          <button className="icon-button" aria-label="Skip tour" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-description">{step.body}</p>
        <div className="tour-progress" aria-hidden="true">
          <i style={{ width: `${((index + 1) / tourSteps.length) * 100}%` }} />
        </div>
        <div className="tour-actions">
          <button className="secondary" disabled={index === 0} onClick={onBack}>
            <ArrowLeft size={15} />Back
          </button>
          <button data-tour-next className="primary" onClick={onNext}>
            {index === tourSteps.length - 1 ? "Finish tour" : "Next"}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
