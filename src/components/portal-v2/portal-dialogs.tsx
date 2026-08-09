"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function visibleFocusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && !element.hasAttribute("aria-hidden");
  });
}

export function usePortalModalBehavior(locale: "ar" | "en") {
  useEffect(() => {
    if (typeof document === "undefined") return;
    let previousFocus: HTMLElement | null = null;
    let lastModal: HTMLElement | null = null;

    const topModal = () => {
      const modals = Array.from(document.querySelectorAll<HTMLElement>(".portal-modal-backdrop .portal-modal, .portal-v2-sheet-layer .portal-v2-sheet"));
      return modals.at(-1) ?? null;
    };

    const sync = () => {
      const modal = topModal();
      document.body.classList.toggle("portal-modal-open", Boolean(modal));
      if (modal === lastModal) return;

      if (!modal) {
        lastModal = null;
        const restore = previousFocus;
        previousFocus = null;
        if (restore?.isConnected) window.setTimeout(() => restore.focus({ preventScroll: true }), 0);
        return;
      }

      previousFocus = (document.activeElement instanceof HTMLElement ? document.activeElement : previousFocus);
      lastModal = modal;
      const close = modal.querySelector<HTMLElement>("header .icon-button, header .portal-v2-icon-button, [data-modal-close]");
      if (close && !close.getAttribute("aria-label")) close.setAttribute("aria-label", locale === "ar" ? "إغلاق" : "Close");
      window.setTimeout(() => {
        const focusables = visibleFocusable(modal);
        const preferred = modal.querySelector<HTMLElement>("[autofocus]") ?? focusables[0] ?? modal;
        if (!modal.hasAttribute("tabindex")) modal.setAttribute("tabindex", "-1");
        preferred.focus({ preventScroll: true });
      }, 0);
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    const onKeyDown = (event: KeyboardEvent) => {
      const modal = topModal();
      if (!modal) return;
      if (event.key === "Escape") {
        const close = modal.querySelector<HTMLButtonElement>("[data-modal-close], header .icon-button, header .portal-v2-icon-button");
        if (close) {
          event.preventDefault();
          close.click();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = visibleFocusable(modal);
      if (!focusables.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !modal.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.classList.remove("portal-modal-open");
    };
  }, [locale]);
}

type ConfirmOptions = {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

type ConfirmState = ConfirmOptions & { id: number };

export function usePortalConfirm(locale: "ar" | "en") {
  const [dialog, setDialog] = useState<ConfirmState | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setDialog({ ...options, id: Date.now() });
    });
  }, []);

  useEffect(() => () => resolver.current?.(false), []);

  const confirmDialog = dialog ? (
    <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) settle(false); }}>
      <section className="portal-modal compact-dialog portal-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`portal-confirm-${dialog.id}`}>
        <header>
          <div>
            <span className="eyebrow"><Icon name={dialog.tone === "danger" ? "info" : "check"} size={17}/>{locale === "ar" ? "تأكيد العملية" : "Confirm action"}</span>
            <h2 id={`portal-confirm-${dialog.id}`}>{dialog.title}</h2>
          </div>
          <button className="icon-button" data-modal-close type="button" onClick={() => settle(false)} aria-label={locale === "ar" ? "إغلاق" : "Close"}><Icon name="close"/></button>
        </header>
        <div className="portal-confirm-body">{dialog.body}</div>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={() => settle(false)}>{dialog.cancelLabel ?? (locale === "ar" ? "إلغاء" : "Cancel")}</button>
          <button className={dialog.tone === "danger" ? "button danger-button" : "button primary"} type="button" onClick={() => settle(true)}>{dialog.confirmLabel ?? (locale === "ar" ? "تأكيد" : "Confirm")}</button>
        </div>
      </section>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}


export function usePortalResponsiveTableLabels() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => {
      document.querySelectorAll<HTMLTableElement>(".portal-v2 table.portal-table").forEach((table) => {
        const labels = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map((cell) => cell.textContent?.trim() ?? "");
        table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            if (!(cell instanceof HTMLTableCellElement)) return;
            const label = labels[index] ?? "";
            if (label) cell.dataset.label = label;
            else delete cell.dataset.label;
          });
        });
      });
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => observer.disconnect();
  }, []);
}
