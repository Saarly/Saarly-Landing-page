"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, rows, text, unitLabel, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type ItemAnswer = {
  rfq_item_id: string;
  decision: "priced" | "rejected";
  unit_price: string;
  unit: string;
  note: string;
  expected_duration: string;
  product_id: string;
  matched_name: string;
  catalog_choice_made: boolean;
};
type RequestFilter = "all" | "direct" | "broadcast" | "expiring";
type StoredDraft = { branchId?: string; answers?: ItemAnswer[] };

function requestDeliveryType(request: PortalRow) {
  return text(request.delivery_type || request.request_type, "broadcast");
}

export function RequestsSection({ payload, locale, refresh, notify }: SectionProps) {
  const requests = rows(payload.data.requests);
  const branches = rows(payload.data.branches);
  const products = rows(payload.data.products);
  const availability = rows(payload.data.availability);
  const currency = text(payload.data.currencyCode || payload.account.currencyCode, "EGP");
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [selected, setSelected] = useState<PortalRow | null>(null);
  const [answers, setAnswers] = useState<ItemAnswer[]>([]);
  const [branchId, setBranchId] = useState("");
  const [saving, setSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [now] = useState(() => Date.now());

  const branchAvailability = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of availability) map.set(`${text(item.branch_id)}:${text(item.product_id)}`, item.is_available !== false);
    return map;
  }, [availability]);

  const filtered = useMemo(() => requests.filter((request) => {
    if (filter === "all") return true;
    const deliveryType = requestDeliveryType(request);
    if (filter === "direct") return deliveryType === "direct";
    if (filter === "broadcast") return deliveryType !== "direct";
    const expires = new Date(text(request.expires_at)).getTime();
    return Number.isFinite(expires) && expires - now < 24 * 3600000;
  }), [requests, filter, now]);
  const visible = filtered.slice(0, visibleCount);

  function draftKey(requestId: string) { return `saarly-rfq-draft:${payload.account.merchantId}:${requestId}`; }

  function defaultAnswers(request: PortalRow): ItemAnswer[] {
    return rows(request.items).map((item) => ({
      rfq_item_id: text(item.id),
      decision: "priced",
      unit_price: "",
      unit: unitLabel(item.unit_snapshot, locale, locale === "ar" ? "قطعة" : "piece"),
      note: "",
      expected_duration: "",
      product_id: "",
      matched_name: "",
      catalog_choice_made: false,
    }));
  }

  function openRequest(request: PortalRow) {
    const defaults = defaultAnswers(request);
    let nextBranch = branches.length === 1 ? text(branches[0].id) : "";
    let nextAnswers = defaults;
    try {
      const raw = JSON.parse(localStorage.getItem(draftKey(text(request.id))) || "null") as StoredDraft | ItemAnswer[] | null;
      if (Array.isArray(raw) && raw.length === defaults.length) nextAnswers = raw;
      else if (raw && !Array.isArray(raw)) {
        if (text(raw.branchId)) nextBranch = text(raw.branchId);
        if (Array.isArray(raw.answers) && raw.answers.length === defaults.length) nextAnswers = raw.answers;
      }
    } catch { /* invalid local draft is ignored */ }
    setBranchId(nextBranch);
    setAnswers(nextAnswers);
    setSelected(request);
  }

  function patchAnswer(index: number, patch: Partial<ItemAnswer>) {
    setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function productFor(id: string) { return products.find((product) => text(product.id) === id); }

  function productCanFulfil(product: PortalRow, requestedQuantity: number) {
    if (product.is_active === false || product.is_available === false) return false;
    if (numberValue(product.quantity) < requestedQuantity) return false;
    if (branchId && branchAvailability.get(`${branchId}:${text(product.id)}`) === false) return false;
    return true;
  }

  function chooseCatalogProduct(index: number, value: string) {
    if (value === "__outside_catalog__") {
      patchAnswer(index, { product_id: "", matched_name: "", catalog_choice_made: true });
      return;
    }
    const product = productFor(value);
    if (!product) return;
    patchAnswer(index, {
      product_id: text(product.id),
      matched_name: text(product.free_name),
      catalog_choice_made: true,
      unit_price: String(numberValue(product.price)),
      unit: unitLabel(product.unit, locale, answers[index]?.unit || (locale === "ar" ? "قطعة" : "piece")),
    });
  }

  const total = useMemo(() => {
    if (!selected) return 0;
    const items = rows(selected.items);
    return answers.reduce((sum, answer, index) => answer.decision === "priced" ? sum + numberValue(answer.unit_price) * numberValue(items[index]?.quantity_snapshot, 1) : sum, 0);
  }, [answers, selected]);

  function saveDraft() {
    if (!selected) return;
    localStorage.setItem(draftKey(text(selected.id)), JSON.stringify({ branchId, answers } satisfies StoredDraft));
    notify(locale === "ar" ? "تم حفظ المسودة على الجهاز." : "Draft saved on this device.", "success");
    setSelected(null);
  }

  async function submitResponse() {
    if (!selected) return;
    if (!branchId) {
      notify(locale === "ar" ? "اختر الفرع الذي سيجهز الطلب." : "Choose the branch that will fulfil the request.", "error");
      return;
    }
    const requestItems = rows(selected.items);
    const invalidPrice = answers.some((answer) => answer.decision === "priced" && (numberValue(answer.unit_price) <= 0 || !answer.unit.trim()));
    if (invalidPrice) {
      notify(locale === "ar" ? "أدخل سعر وحدة أكبر من صفر ووحدة صحيحة لكل صنف متوفر." : "Enter a unit price greater than zero and a valid unit for every available item.", "error");
      return;
    }
    const missingCatalogChoice = answers.some((answer) => answer.decision === "priced" && !answer.catalog_choice_made);
    if (missingCatalogChoice) {
      notify(locale === "ar" ? "حدد لكل صنف متوفر منتجًا من الكتالوج أو اختر صراحةً بند خارج الكتالوج." : "For every available item, select a catalog product or explicitly choose outside catalog.", "error");
      return;
    }
    const invalidLinked = answers.some((answer, index) => {
      if (answer.decision !== "priced" || !answer.product_id) return false;
      const product = productFor(answer.product_id);
      return !product || !productCanFulfil(product, numberValue(requestItems[index]?.quantity_snapshot, 1));
    });
    if (invalidLinked) {
      notify(locale === "ar" ? "في منتج مرتبط بالكتالوج غير متاح بالكمية المطلوبة في الفرع المختار. حدّث المخزون أو اختر خارج الكتالوج." : "A linked catalog product cannot fulfil the requested quantity at the selected branch. Update stock or choose outside catalog.", "error");
      return;
    }

    setSaving(true);
    try {
      const itemResponses = answers.map((answer) => {
        if (answer.decision === "rejected") return { rfq_item_id: answer.rfq_item_id, decision: "rejected" };
        return {
          rfq_item_id: answer.rfq_item_id,
          decision: "priced",
          unit_price: Number(answer.unit_price),
          unit: answer.unit.trim(),
          ...(answer.product_id ? { product_id: answer.product_id, matched_name: answer.matched_name.trim() } : {}),
          ...(answer.note.trim() ? { note: answer.note.trim() } : {}),
          ...(answer.expected_duration.trim() ? { expected_duration: answer.expected_duration.trim() } : {}),
        };
      });
      await portalPost("submit_rfq", { requestId: text(selected.id), branchId, itemResponses });
      localStorage.removeItem(draftKey(text(selected.id)));
      notify(locale === "ar" ? "تم إرسال التسعير للعميل وفي انتظار موافقته." : "The quote was sent to the buyer and is awaiting approval.", "success");
      setSelected(null);
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "submit_failed", "error");
    } finally { setSaving(false); }
  }

  return <div className="portal-section-stack">
    <Notice>{locale === "ar" ? "طلبات الكتالوج قد تتجهز تلقائيًا، والطلبات التي تحتاج قرارًا يدويًا تظهر هنا. اختار الفرع، واربط المنتج بالكتالوج لو موجود؛ المخزون المرتبط يُراجع قبل إرسال الرد ويُخصم لاحقًا عند تأكيد الطلب." : "Catalog requests may be prepared automatically. Manual requests appear here. Choose the branch and link catalog products when available; linked stock is validated before submission and deducted later when the order is confirmed."}</Notice>

    <PortalPanel title={locale === "ar" ? "طلبات التسعير المفتوحة" : "Open quote requests"} subtitle={locale === "ar" ? "سعّر كل بند أو وضح إنه غير متاح ثم أرسل العرض." : "Price every item or mark it unavailable, then submit the quote."}>
      <div className="portal-toolbar">
        <button className={`filter-chip ${filter === "all" ? "active" : ""}`} type="button" onClick={() => { setFilter("all"); setVisibleCount(12); }}>{locale === "ar" ? "كل الطلبات" : "All requests"}</button>
        <button className={`filter-chip ${filter === "direct" ? "active" : ""}`} type="button" onClick={() => { setFilter("direct"); setVisibleCount(12); }}>{locale === "ar" ? "مخصوصة لك" : "Direct"}</button>
        <button className={`filter-chip ${filter === "broadcast" ? "active" : ""}`} type="button" onClick={() => { setFilter("broadcast"); setVisibleCount(12); }}>{locale === "ar" ? "مقارنة عامة" : "General"}</button>
        <button className={`filter-chip ${filter === "expiring" ? "active" : ""}`} type="button" onClick={() => { setFilter("expiring"); setVisibleCount(12); }}>{locale === "ar" ? "تنتهي قريبًا" : "Expiring soon"}</button>
        <span className="toolbar-count">{locale === "ar" ? `ظاهر ${visible.length} من ${filtered.length}` : `Showing ${visible.length} of ${filtered.length}`}</span>
      </div>

      {visible.length === 0 ? <EmptyState icon="quote" title={locale === "ar" ? "لا توجد طلبات مفتوحة" : "No open requests"} body={locale === "ar" ? "ستظهر هنا الطلبات العامة أو الموجهة للمتجر." : "General or direct requests targeted to the store will appear here."}/> : <>
        <div className="request-card-grid">{visible.map((request) => {
          const items = rows(request.items);
          const deadline = new Date(text(request.expires_at));
          const urgent = !Number.isNaN(deadline.getTime()) && deadline.getTime() - now < 24 * 3600000;
          const isDirect = requestDeliveryType(request) === "direct";
          return <article className="request-card" key={text(request.id)} data-record-id={text(request.id)}>
            <header><span className={`status-badge ${urgent ? "warn" : isDirect ? "good" : "neutral"}`}>{urgent ? (locale === "ar" ? "ينتهي قريبًا" : "Expiring soon") : isDirect ? (locale === "ar" ? "طلب مخصوص لك" : "Direct request") : (locale === "ar" ? "طلب مقارنة عام" : "General request")}</span><small>{dateLabel(request.expires_at, locale)}</small></header>
            <h3>{isDirect ? (locale === "ar" ? `طلب مخصوص لك #${text(request.id).slice(0, 8)}` : `Direct request for you #${text(request.id).slice(0, 8)}`) : (locale === "ar" ? `طلب مقارنة عام يحتوي على ${items.length} بند` : `General comparison request with ${items.length} items`)}</h3>
            {text(request.response_status) ? <div className="inline-actions"><StatusBadge value={request.response_status} locale={locale}/><small>{request.response_submitted_at ? dateLabel(request.response_submitted_at, locale) : ""}</small></div> : null}
            <ul>{items.slice(0, 4).map((item) => <li key={text(item.id)}><span>{text(item.requested_name_snapshot)}</span><strong>{numberValue(item.quantity_snapshot)} {unitLabel(item.unit_snapshot, locale)}</strong>{text(item.reason) ? <small>{text(item.reason)}</small> : null}</li>)}</ul>
            {items.length > 4 ? <small>{locale === "ar" ? `و${items.length - 4} بنود أخرى` : `${items.length - 4} more items`}</small> : null}
            <button className="button primary full" type="button" onClick={() => openRequest(request)}>{text(request.response_status) ? (locale === "ar" ? "مراجعة / تحديث الرد" : "Review / update response") : (locale === "ar" ? "فتح وتسعير البنود" : "Open and price items")}<Icon name="arrow" size={18}/></button>
          </article>;
        })}</div>
        {visible.length < filtered.length ? <div className="load-more-row"><button className="button secondary" type="button" onClick={() => setVisibleCount((count) => count + 12)}>{locale === "ar" ? "عرض المزيد" : "Show more"}</button></div> : null}
      </>}
    </PortalPanel>

    {selected ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal extra-wide rfq-response-modal" role="dialog" aria-modal="true">
      <header><div><span className="eyebrow"><Icon name="quote" size={17}/>{locale === "ar" ? "تسعير يدوي" : "Manual quote"}</span><h2>{locale === "ar" ? "حدد رد المتجر لكل بند" : "Set the store response for each item"}</h2><p>{locale === "ar" ? `آخر موعد: ${dateLabel(selected.expires_at, locale)}` : `Deadline: ${dateLabel(selected.expires_at, locale)}`}</p></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق رد التسعير" : "Close quote response"} title={locale === "ar" ? "إغلاق" : "Close"} onClick={() => setSelected(null)}><Icon name="close"/></button></header>

      <div className="rfq-response-toolbar">
        <label>{locale === "ar" ? "الفرع الذي سيجهز الطلب" : "Fulfilment branch"}<select value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={saving}><option value="">{locale === "ar" ? "اختر الفرع" : "Choose branch"}</option>{branches.map((branch) => <option key={text(branch.id)} value={text(branch.id)}>{text(branch.name)}</option>)}</select></label>
        <div className="rfq-response-summary"><span>{locale === "ar" ? "البنود" : "Items"}<strong>{rows(selected.items).length}</strong></span><span>{locale === "ar" ? "المسعر" : "Priced"}<strong>{answers.filter((answer) => answer.decision === "priced").length}</strong></span><span>{locale === "ar" ? "غير متاح" : "Unavailable"}<strong>{answers.filter((answer) => answer.decision === "rejected").length}</strong></span></div>
      </div>
      {!branches.length ? <Notice tone="warning">{locale === "ar" ? "لا يوجد فرع معتمد ومتاح لهذا الحساب. أضف/اعتمد فرعًا قبل إرسال التسعير." : "No approved accessible branch is available for this account. Add or approve a branch before submitting a quote."}</Notice> : null}

      <div className="rfq-editor-list">{rows(selected.items).map((item, index) => {
        const answer = answers[index];
        const requestedQuantity = numberValue(item.quantity_snapshot, 1);
        const linkedProduct = productFor(answer?.product_id || "");
        const linkedInvalid = !!linkedProduct && !productCanFulfil(linkedProduct, requestedQuantity);
        const lineTotal = answer?.decision === "priced" ? numberValue(answer.unit_price) * requestedQuantity : 0;
        return <article className={linkedInvalid ? "rfq-editor-item invalid" : "rfq-editor-item"} key={text(item.id)}>
          <div className="rfq-item-title"><span>{index + 1}</span><div><strong>{text(item.requested_name_snapshot)}</strong><p>{requestedQuantity} {unitLabel(item.unit_snapshot, locale)} {text(item.reason) ? `· ${text(item.reason)}` : ""}</p>{Object.keys((item.specifications_snapshot as object | null) ?? {}).length ? <small>{locale === "ar" ? "يوجد مواصفات إضافية محفوظة مع الطلب" : "Additional specifications are attached to this item"}</small> : null}</div></div>
          <div className="decision-toggle"><button type="button" className={answer?.decision === "priced" ? "active" : ""} disabled={saving} onClick={() => patchAnswer(index, { decision: "priced" })}><Icon name="money" size={17}/>{locale === "ar" ? "متوفر / تسعير" : "Available / price"}</button><button type="button" className={answer?.decision === "rejected" ? "active danger" : ""} disabled={saving} onClick={() => patchAnswer(index, { decision: "rejected" })}><Icon name="close" size={17}/>{locale === "ar" ? "غير متاح" : "Unavailable"}</button></div>
          {answer?.decision === "priced" ? <div className="rfq-item-fields">
            <label className="wide-field">{locale === "ar" ? "ربط بمنتج من الكتالوج" : "Link to catalog product"}<select value={answer.catalog_choice_made ? (answer.product_id || "__outside_catalog__") : ""} disabled={saving} onChange={(event) => chooseCatalogProduct(index, event.target.value)}><option value="">{locale === "ar" ? "حدد اختيارك" : "Choose explicitly"}</option><option value="__outside_catalog__">{locale === "ar" ? "بند خارج الكتالوج — بدون خصم مخزون" : "Outside catalog — no stock deduction"}</option>{products.map((product) => { const canFulfil = productCanFulfil(product, requestedQuantity); return <option key={text(product.id)} value={text(product.id)} disabled={!canFulfil}>{text(product.free_name)} — {numberValue(product.quantity)} {unitLabel(product.unit, locale)}{!canFulfil ? (locale === "ar" ? " (غير متاح بالكمية المطلوبة)" : " (insufficient/unavailable)") : ""}</option>; })}</select><small>{locale === "ar" ? "لو ربطت منتجًا من الكتالوج، سعره ووحدته يتعبّوا تلقائيًا ويُخصم المخزون بعد تأكيد الطلب." : "Linking a catalog product fills its price/unit and its stock is deducted after order confirmation."}</small></label>
            <div className="form-grid three"><label>{locale === "ar" ? `سعر الوحدة (${unitLabel(answer.unit || item.unit_snapshot, locale)})` : `Unit price (${unitLabel(answer.unit || item.unit_snapshot, locale)})`}<input type="number" min="0.01" step="0.01" value={answer.unit_price} disabled={saving} onChange={(event) => patchAnswer(index, { unit_price: event.target.value })}/></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input value={answer.unit} disabled={saving || !!answer.product_id} onChange={(event) => patchAnswer(index, { unit: event.target.value })}/></label><label>{locale === "ar" ? "إجمالي الصنف" : "Item total"}<output>{money(lineTotal, currency, locale)}</output></label></div>
            <div className="form-grid two"><label>{locale === "ar" ? "مدة التوفير المتوقعة (اختياري)" : "ETA (optional)"}<input value={answer.expected_duration} disabled={saving} placeholder={locale === "ar" ? "مثال: ساعتين، غداً" : "e.g. 2 hours, tomorrow"} onChange={(event) => patchAnswer(index, { expected_duration: event.target.value })}/></label><label>{locale === "ar" ? "ملاحظة للعميل (اختياري)" : "Note to buyer (optional)"}<input value={answer.note} disabled={saving} onChange={(event) => patchAnswer(index, { note: event.target.value })}/></label></div>
            {linkedInvalid ? <Notice tone="warning">{locale === "ar" ? "المنتج المرتبط غير متوفر بالكمية المطلوبة في الفرع المختار. حدّث المخزون أو اختر بندًا خارج الكتالوج." : "The linked product cannot fulfil the requested quantity at the selected branch. Update stock or choose outside catalog."}</Notice> : null}
          </div> : <Notice tone="info">{locale === "ar" ? "هذا البند سيُرسل للعميل على أنه غير متاح، بدون سعر." : "This item will be sent to the buyer as unavailable, without a price."}</Notice>}
        </article>;
      })}</div>

      <footer className="quote-total"><div><span>{locale === "ar" ? "إجمالي البنود المسعرة" : "Priced items total"}</span><strong>{money(total, currency, locale)}</strong></div><div className="modal-actions"><button className="button secondary" type="button" onClick={saveDraft} disabled={saving}>{locale === "ar" ? "حفظ كمسودة محلية" : "Save local draft"}</button><button className="button primary" type="button" onClick={() => void submitResponse()} disabled={saving || !branches.length}>{saving ? (locale === "ar" ? "جارٍ الإرسال" : "Submitting") : (locale === "ar" ? "إرسال الرد" : "Submit response")}</button></div></footer>
    </section></div> : null}
  </div>;
}
