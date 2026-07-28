"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type ItemAnswer = { rfq_item_id: string; decision: "priced" | "rejected"; unit_price: string; unit: string; note: string };

export function RequestsSection({ payload, locale, refresh, notify }: SectionProps) {
  const requests = rows(payload.data.requests);
  const currency = text(payload.account.currencyCode, "EGP");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<PortalRow | null>(null);
  const [answers, setAnswers] = useState<ItemAnswer[]>([]);
  const [saving, setSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const filtered = useMemo(() => requests.filter((request) => {
    if (filter === "all") return true;
    const expires = new Date(text(request.expires_at)).getTime();
    return filter === "expiring" ? Number.isFinite(expires) && expires - Date.now() < 24 * 3600000 : rows(request.items).length > 0;
  }), [requests, filter]);
  const visible = filtered.slice(0, visibleCount);

  function draftKey(requestId: string) { return `saarly-rfq-draft:${payload.account.merchantId}:${requestId}`; }

  function openRequest(request: PortalRow) {
    const defaults = rows(request.items).map((item) => ({
      rfq_item_id: text(item.id), decision: "priced" as const, unit_price: "", unit: text(item.unit_snapshot, locale === "ar" ? "قطعة" : "piece"), note: "",
    }));
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey(text(request.id))) || "null") as ItemAnswer[] | null;
      setAnswers(Array.isArray(saved) && saved.length === defaults.length ? saved : defaults);
    } catch { setAnswers(defaults); }
    setSelected(request);
  }

  function patchAnswer(index: number, patch: Partial<ItemAnswer>) {
    setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  const total = useMemo(() => {
    if (!selected) return 0;
    const items = rows(selected.items);
    return answers.reduce((sum, answer, index) => answer.decision === "priced" ? sum + numberValue(answer.unit_price) * numberValue(items[index]?.quantity_snapshot, 1) : sum, 0);
  }, [answers, selected]);

  function saveDraft() {
    if (!selected) return;
    localStorage.setItem(draftKey(text(selected.id)), JSON.stringify(answers));
    notify(locale === "ar" ? "تم حفظ المسودة على الجهاز." : "Draft saved on this device.", "success");
    setSelected(null);
  }

  async function submitResponse() {
    if (!selected) return;
    const invalid = answers.some((answer) => answer.decision === "priced" && (numberValue(answer.unit_price, -1) < 0 || !answer.unit.trim()));
    if (invalid) { notify(locale === "ar" ? "أكمل السعر والوحدة لكل بند تم تسعيره." : "Complete the price and unit for every priced item.", "error"); return; }
    setSaving(true);
    try {
      await portalPost("submit_rfq", { requestId: text(selected.id), itemResponses: answers.map((answer) => ({ ...answer, unit_price: answer.decision === "priced" ? Number(answer.unit_price) : null })) });
      localStorage.removeItem(draftKey(text(selected.id)));
      notify(locale === "ar" ? "تم إرسال رد التسعير." : "Quote response submitted.", "success");
      setSelected(null); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "submit_failed", "error"); }
    finally { setSaving(false); }
  }

  return <div className="portal-section-stack">
    <Notice>{locale === "ar" ? "طلبات الكتالوج قد تتجهز تلقائيًا، والطلبات التي تحتاج قرارًا يدويًا تظهر هنا. المسودة المحلية تفضل محفوظة على نفس الجهاز فقط." : "Catalog requests may be prepared automatically. Requests requiring a manual decision appear here. Local drafts stay on this device only."}</Notice>
    <PortalPanel title={locale === "ar" ? "طلبات التسعير المفتوحة" : "Open quote requests"} subtitle={locale === "ar" ? "سعّر كل بند أو وضح إنه غير متاح ثم أرسل العرض." : "Price each item or mark it unavailable, then submit the quote."}>
      <div className="portal-toolbar"><button className={`filter-chip ${filter === "all" ? "active" : ""}`} type="button" onClick={() => { setFilter("all"); setVisibleCount(12); }}>{locale === "ar" ? "الكل" : "All"}</button><button className={`filter-chip ${filter === "expiring" ? "active" : ""}`} type="button" onClick={() => { setFilter("expiring"); setVisibleCount(12); }}>{locale === "ar" ? "تنتهي قريبًا" : "Expiring soon"}</button><span className="toolbar-count">{locale === "ar" ? `ظاهر ${visible.length} من ${filtered.length}` : `Showing ${visible.length} of ${filtered.length}`}</span></div>
      {visible.length === 0 ? <EmptyState icon="quote" title={locale === "ar" ? "لا توجد طلبات مفتوحة" : "No open requests"} body={locale === "ar" ? "ستظهر هنا الطلبات العامة أو الموجهة للمتجر." : "General or direct requests targeted to the store will appear here."}/> : <><div className="request-card-grid">{visible.map((request) => {
        const items = rows(request.items); const deadline = new Date(text(request.expires_at)); const urgent = !Number.isNaN(deadline.getTime()) && deadline.getTime() - Date.now() < 24 * 3600000;
        return <article className="request-card" key={text(request.id)} data-record-id={text(request.id)}><header><span className={`status-badge ${urgent ? "warning" : "neutral"}`}>{urgent ? (locale === "ar" ? "ينتهي قريبًا" : "Expiring soon") : (locale === "ar" ? "طلب مفتوح" : "Open request")}</span><small>{dateLabel(request.expires_at, locale)}</small></header><h3>{locale === "ar" ? `طلب تسعير يحتوي على ${items.length} بند` : `Quote request with ${items.length} items`}</h3><ul>{items.slice(0, 4).map((item) => <li key={text(item.id)}><span>{text(item.requested_name_snapshot)}</span><strong>{numberValue(item.quantity_snapshot)} {text(item.unit_snapshot)}</strong></li>)}</ul>{items.length > 4 ? <small>{locale === "ar" ? `و${items.length - 4} بنود أخرى` : `${items.length - 4} more items`}</small> : null}<button className="button primary full" type="button" onClick={() => openRequest(request)}>{locale === "ar" ? "فتح وتسعير البنود" : "Open and price items"}<Icon name="arrow" size={18}/></button></article>;
      })}</div>{visible.length < filtered.length ? <div className="load-more-row"><button className="button secondary" type="button" onClick={() => setVisibleCount((count) => count + 12)}>{locale === "ar" ? "عرض المزيد" : "Show more"}</button></div> : null}</>}
    </PortalPanel>

    {selected ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal wide" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="quote" size={17}/>{locale === "ar" ? "تسعير يدوي" : "Manual quote"}</span><h2>{locale === "ar" ? "حدد رد المتجر لكل بند" : "Set the store response for each item"}</h2><p>{locale === "ar" ? `آخر موعد: ${dateLabel(selected.expires_at, locale)}` : `Deadline: ${dateLabel(selected.expires_at, locale)}`}</p></div><button className="icon-button" type="button" onClick={() => setSelected(null)}><Icon name="close"/></button></header><div className="rfq-editor-list">{rows(selected.items).map((item, index) => { const answer = answers[index]; return <article key={text(item.id)}><div className="rfq-item-title"><span>{index + 1}</span><div><strong>{text(item.requested_name_snapshot)}</strong><p>{numberValue(item.quantity_snapshot)} {text(item.unit_snapshot)} {text(item.reason) ? `· ${text(item.reason)}` : ""}</p></div></div><div className="decision-toggle"><button type="button" className={answer?.decision === "priced" ? "active" : ""} onClick={() => patchAnswer(index, { decision: "priced" })}><Icon name="money" size={17}/>{locale === "ar" ? "تسعير" : "Price"}</button><button type="button" className={answer?.decision === "rejected" ? "active danger" : ""} onClick={() => patchAnswer(index, { decision: "rejected" })}><Icon name="close" size={17}/>{locale === "ar" ? "غير متاح" : "Unavailable"}</button></div>{answer?.decision === "priced" ? <div className="form-grid three"><label>{locale === "ar" ? "سعر الوحدة" : "Unit price"}<input type="number" min="0" step="0.01" value={answer.unit_price} onChange={(event) => patchAnswer(index, { unit_price: event.target.value })}/></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input value={answer.unit} onChange={(event) => patchAnswer(index, { unit: event.target.value })}/></label><label>{locale === "ar" ? "ملاحظة" : "Note"}<input value={answer.note} onChange={(event) => patchAnswer(index, { note: event.target.value })}/></label></div> : <label>{locale === "ar" ? "سبب الاعتذار أو ملاحظة" : "Decline reason or note"}<input value={answer?.note ?? ""} onChange={(event) => patchAnswer(index, { note: event.target.value })}/></label>}</article>; })}</div><footer className="quote-total"><div><span>{locale === "ar" ? "إجمالي البنود المسعرة" : "Priced items total"}</span><strong>{money(total, currency, locale)}</strong></div><div className="modal-actions"><button className="button secondary" type="button" onClick={saveDraft}>{locale === "ar" ? "حفظ كمسودة محلية" : "Save local draft"}</button><button className="button primary" type="button" onClick={() => void submitResponse()} disabled={saving}>{saving ? (locale === "ar" ? "جارٍ الإرسال" : "Submitting") : (locale === "ar" ? "إرسال العرض" : "Submit quote")}</button></div></footer></section></div> : null}
  </div>;
}
