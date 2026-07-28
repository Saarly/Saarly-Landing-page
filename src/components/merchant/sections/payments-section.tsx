"use client";

import { Icon } from "@/components/icons";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, rows, statusLabel, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function PaymentsSection({ payload, locale }: SectionProps) {
  const ledger = rows(payload.data.ledger);
  const commissions = rows(payload.data.commissions);
  const settlements = rows(payload.data.settlements);
  const currency = text(payload.data.currencyCode || payload.account.currencyCode, "EGP");
  return <div className="portal-section-stack">
    <div className="metrics-grid">
      <article className="metric-card green"><span className="metric-icon"><Icon name="receipt"/></span><div><p>{locale === "ar" ? "حركات الحساب" : "Ledger entries"}</p><strong>{ledger.length}</strong><small>{locale === "ar" ? "أحدث السجلات المعروضة" : "Latest displayed records"}</small></div></article>
      <article className="metric-card gold"><span className="metric-icon"><Icon name="money"/></span><div><p>{locale === "ar" ? "العمولات" : "Commissions"}</p><strong>{commissions.length}</strong><small>{locale === "ar" ? "عمليات مسجلة" : "Recorded entries"}</small></div></article>
      <article className="metric-card blue"><span className="metric-icon"><Icon name="check"/></span><div><p>{locale === "ar" ? "التسويات" : "Settlements"}</p><strong>{settlements.length}</strong><small>{locale === "ar" ? "سجلات التسوية" : "Settlement records"}</small></div></article>
    </div>
    <PortalPanel title={locale === "ar" ? "السجل المحاسبي" : "Billing ledger"} subtitle={locale === "ar" ? "الرسوم والمدفوعات والخصومات مرتبة من الأحدث. الأعداد هنا هي عدد السجلات الظاهرة فعلًا." : "Charges, payments, and credits ordered by latest. Counts match the displayed records."}>
      {ledger.length === 0 ? <EmptyState icon="receipt" title={locale === "ar" ? "السجل فارغ" : "Ledger is empty"} body={locale === "ar" ? "ستظهر الحركات بعد بدء المحاسبة." : "Entries will appear once monetization starts."}/> : <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "النوع" : "Type"}</th><th>{locale === "ar" ? "الوصف" : "Description"}</th><th>{locale === "ar" ? "المبلغ" : "Amount"}</th><th>{locale === "ar" ? "الرصيد" : "Balance"}</th></tr></thead><tbody>{ledger.map((entry) => <tr key={text(entry.id)}><td>{dateLabel(entry.created_at, locale)}</td><td>{statusLabel(entry.entry_type, locale)}</td><td>{text(entry.description, locale === "ar" ? "بدون وصف" : "No description")}</td><td>{money(entry.amount, entry.currency || currency, locale)}</td><td>{money(entry.running_balance, entry.currency || currency, locale)}</td></tr>)}</tbody></table></div>}
    </PortalPanel>
    <div className="portal-two-columns">
      <PortalPanel title={locale === "ar" ? "العمولات" : "Commissions"}>{commissions.length === 0 ? <EmptyState icon="money" title={locale === "ar" ? "لا توجد عمولات" : "No commissions"} body={locale === "ar" ? "لا توجد عمولات مسجلة حاليًا." : "No commission entries are currently recorded."}/> : <div className="compact-table-wrap"><table className="portal-table compact"><thead><tr><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "القيمة" : "Amount"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th></tr></thead><tbody>{commissions.map((item) => <tr key={text(item.id)}><td>{dateLabel(item.created_at, locale)}</td><td>{money(item.commission_amount || item.amount, item.currency || currency, locale)}</td><td><StatusBadge value={item.status || "active"} locale={locale}/></td></tr>)}</tbody></table></div>}</PortalPanel>
      <PortalPanel title={locale === "ar" ? "التسويات" : "Settlements"}>{settlements.length === 0 ? <EmptyState icon="check" title={locale === "ar" ? "لا توجد تسويات" : "No settlements"} body={locale === "ar" ? "ستظهر تسويات العمولة هنا عند إنشائها." : "Commission settlements will appear here when created."}/> : <div className="compact-table-wrap"><table className="portal-table compact"><thead><tr><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "القيمة" : "Amount"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th></tr></thead><tbody>{settlements.map((item) => <tr key={text(item.id)}><td>{dateLabel(item.created_at, locale)}</td><td>{money(item.amount, item.currency || currency, locale)}</td><td><StatusBadge value={item.status} locale={locale}/></td></tr>)}</tbody></table></div>}</PortalPanel>
    </div>
  </div>;
}
