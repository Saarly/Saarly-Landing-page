"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost } from "@/components/buyer/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { money, rows, text } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

type AlertFilter = "all" | "increased" | "unchanged" | "decreased" | "unavailable";

function matchesFilter(status: string, filter: AlertFilter) {
  if (filter === "all") return true;
  if (filter === "increased") return status === "price_up";
  if (filter === "decreased") return status === "price_down";
  if (filter === "unavailable") return status === "unavailable";
  return ["no_change", "waiting", "available"].includes(status);
}

export function BuyerAlertsSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const alerts = rows(payload.data.priceAlerts).filter((item) => item.is_active === true);
  const currency = payload.account.currencyCode || "EGP";
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [watchedText, setWatchedText] = useState("");
  const [adding, setAdding] = useState(false);
  const visible = useMemo(() => alerts.filter((alert) => matchesFilter(text(alert.last_price_status, "waiting"), filter)), [alerts, filter]);
  const count = (target: AlertFilter) => alerts.filter((alert) => matchesFilter(text(alert.last_price_status, "waiting"), target)).length;

  async function stop(alertId: string) {
    setBusy(alertId);
    try {
      await buyerPost("stop_price_alert", { alertId });
      notify(locale === "ar" ? "تم إيقاف التنبيه." : "Price alert stopped.", "success");
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "price_alert_failed", "error");
    } finally { setBusy(""); }
  }

  async function addAlert(event: FormEvent) {
    event.preventDefault();
    if (watchedText.trim().length < 2) return;
    setAdding(true);
    try {
      await buyerPost("create_text_price_alert", { watchedText });
      notify(locale === "ar" ? "تمت إضافة تنبيه السعر." : "Price alert added.", "success");
      setWatchedText(""); setAddOpen(false); await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "price_alert_failed", "error");
    } finally { setAdding(false); }
  }

  return <div className="portal-section-stack">
    <PortalPanel
      title={locale === "ar" ? `تنبيهات الأسعار (${alerts.length})` : `Price alerts (${alerts.length})`}
      subtitle={locale === "ar" ? "راقب أقل سعر لاسم منتج، أو تابع منتجًا محددًا من متجر بعينه." : "Watch the lowest price for a product phrase, or track a specific store product."}
      action={<button className="button primary compact" type="button" onClick={() => setAddOpen(true)}><Icon name="plus"/>{locale === "ar" ? "إضافة تنبيه" : "Add alert"}</button>}
    >
      <nav className="portal-subtabs compact-tabs" aria-label={locale === "ar" ? "فلترة تنبيهات الأسعار" : "Price alert filters"}>
        {([
          ["all", "الكل", "All"], ["increased", "زاد", "Increased"], ["unchanged", "ثابت", "Unchanged"],
          ["decreased", "انخفض", "Decreased"], ["unavailable", "غير متاح", "Unavailable"],
        ] as const).map(([key, ar, en]) => <button type="button" className={filter === key ? "active" : ""} onClick={() => setFilter(key)} key={key}>{locale === "ar" ? ar : en}<i>{count(key)}</i></button>)}
      </nav>
      {visible.length ? <div className="buyer-alert-list expanded">{visible.map((alert) => {
        const alertId = text(alert.id); const productId = text(alert.product_id);
        return <article key={alertId} data-record-id={productId || alertId}>
          <div><strong>{text(alert.title || alert.watched_product_text, locale === "ar" ? "تنبيه سعر" : "Price alert")}</strong><small>{text(alert.subtitle, productId ? (locale === "ar" ? "منتج محدد" : "Specific product") : (locale === "ar" ? "أقل سعر بين المتاجر" : "Lowest price across stores"))}</small></div>
          <div><span>{locale === "ar" ? "السعر المرجعي" : "Reference"}</span><strong>{alert.reference_price === null || alert.reference_price === undefined ? "—" : money(alert.reference_price, currency, locale)}</strong></div>
          <div><span>{locale === "ar" ? "السعر الحالي" : "Current"}</span><strong>{alert.current_price === null || alert.current_price === undefined ? "—" : money(alert.current_price, currency, locale)}</strong></div>
          <StatusBadge value={alert.last_price_status} locale={locale}/>
          <div className="inline-actions">{productId ? <Link className="button secondary compact" href={`/buyer/stores?product=${encodeURIComponent(productId)}`}>{locale === "ar" ? "تفاصيل المنتج" : "Product details"}</Link> : null}<button className="button danger-button compact" disabled={busy === alertId} onClick={() => void stop(alertId)}>{locale === "ar" ? "إيقاف" : "Stop"}</button></div>
        </article>;
      })}</div> : <EmptyState icon="bell" title={filter === "all" ? (locale === "ar" ? "مفيش تنبيهات أسعار" : "No price alerts") : (locale === "ar" ? "مفيش نتائج للفلتر ده" : "No alerts match this filter")} body={locale === "ar" ? "أضف اسم منتج للبحث عن أفضل سعر، أو فعّل التنبيه من صفحة المتاجر." : "Add a product phrase to watch the best price, or enable an alert from Stores."}/>}
    </PortalPanel>

    {addOpen ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="bell"/>{locale === "ar" ? "تنبيه سعر جديد" : "New price alert"}</span><h2>{locale === "ar" ? "تابع أقل سعر بين المتاجر" : "Watch the lowest price across stores"}</h2><p>{locale === "ar" ? "اكتب اسم المنتج أو وصفًا واضحًا. لتنبيه متجر محدد فعّل التنبيه من المنتج نفسه." : "Enter a product name or clear description. For a specific store, enable the alert from that product."}</p></div><button className="icon-button" type="button" onClick={() => setAddOpen(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={addAlert}><label>{locale === "ar" ? "اسم المنتج أو النص" : "Product name or text"}<input autoFocus required minLength={2} maxLength={240} value={watchedText} onChange={(event) => setWatchedText(event.target.value)} placeholder={locale === "ar" ? "مثال: كابل ٢ متر" : "e.g. 2m cable"}/></label><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setAddOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={adding}>{adding ? (locale === "ar" ? "جارٍ الإضافة" : "Adding") : (locale === "ar" ? "إضافة التنبيه" : "Add alert")}</button></div></form></section></div> : null}
  </div>;
}
