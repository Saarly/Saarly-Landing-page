"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost, buyerUpload } from "@/components/buyer/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { usePortalConfirm } from "@/components/portal-v2/portal-dialogs";
import { MerchantTrustBadges } from "@/components/portal-v2/merchant-trust-badges";
import { dateLabel, money, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

type Tab = "offers" | "requests" | "rfq";
type OfferSort = "ranking" | "cheapest" | "nearest" | "coverage" | "rating";
type NewMode = "manual" | "image" | "pdf" | "voice";
type DraftItem = { name: string; quantity: number; unit: string; confidence?: number | null; needsReview?: boolean };
type OfferReviewState = { offer: PortalRow; preview: PortalRow; quantities: Record<string, string> };

function initialItem(locale: "ar" | "en"): DraftItem { return { name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }; }

function offerReasonNumber(reason: PortalRow, keys: string[]) {
  for (const key of keys) {
    const raw = reason[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
function offerReasonBool(reason: PortalRow, keys: string[]) {
  for (const key of keys) {
    const raw = reason[key];
    if (typeof raw === "boolean") return raw;
    if (raw === "true" || raw === 1 || raw === "1") return true;
    if (raw === "false" || raw === 0 || raw === "0") return false;
  }
  return null;
}
function offerReasonText(reason: PortalRow, keys: string[]) {
  for (const key of keys) { const result = text(reason[key]); if (result) return result; }
  return "";
}

export function BuyerRequestsSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const { confirm, confirmDialog } = usePortalConfirm(locale);
  const data = payload.data;
  const requests = rows(data.quotes);
  const offers = rows(data.offers);
  const rfqResponses = rows(data.rfqResponses);
  const location = row(data.location);
  const locationOptions = rows(data.locationOptions).filter((item) => item.is_country_marker !== true);
  const currency = payload.account.currencyCode || text(location.currency_code, "EGP");
  const [tab, setTab] = useState<Tab>("offers");
  const [newOpen, setNewOpen] = useState(false);
  const [mode, setMode] = useState<NewMode>("manual");
  const [items, setItems] = useState<DraftItem[]>([initialItem(locale)]);
  const [cityId, setCityId] = useState(text(location.city_id));
  const [scope, setScope] = useState("city");
  const [file, setFile] = useState<File | null>(null);
  const [analysisQuoteId, setAnalysisQuoteId] = useState("");
  const [analysisNote, setAnalysisNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [offerSort, setOfferSort] = useState<OfferSort>("ranking");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const [shippingResponse, setShippingResponse] = useState<PortalRow>({});
  const [shippingOptions, setShippingOptions] = useState<PortalRow>({});
  const [shippingCompanyId, setShippingCompanyId] = useState("");
  const [shippingWeight, setShippingWeight] = useState("1");
  const [fulfillmentMode, setFulfillmentMode] = useState<"pickup" | "delivery">("pickup");
  const [shippingBusy, setShippingBusy] = useState(false);
  const [offerReview, setOfferReview] = useState<OfferReviewState | null>(null);
  const [offerReviewBusy, setOfferReviewBusy] = useState(false);
  const [rejectResponse, setRejectResponse] = useState<PortalRow | null>(null);
  const [requestDetails, setRequestDetails] = useState<PortalRow | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedScope = window.localStorage.getItem("saarly_buyer_search_scope_v1");
      if (savedScope && ["city", "governorate", "country"].includes(savedScope)) setScope(savedScope);
    } catch { /* browser storage is optional */ }
    const requested = new URLSearchParams(window.location.search).get("new") as NewMode | null;
    if (!requested || !["manual", "image", "pdf", "voice"].includes(requested)) return;
    const timer = window.setTimeout(() => {
      setMode(requested);
      setNewOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);


  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      notify(locale === "ar" ? "المتصفح لا يدعم التسجيل الصوتي. ارفع ملف صوت بدلًا من ذلك." : "This browser cannot record audio. Upload an audio file instead.", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supported = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      discardRecordingRef.current = false;
      recordingStreamRef.current = stream; recorderRef.current = recorder; recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || supported || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        if (!discardRecordingRef.current && blob.size > 0) setFile(new File([blob], `saarly-voice-${Date.now()}.${extension}`, { type: mimeType }));
        discardRecordingRef.current = false;
        stream.getTracks().forEach((track) => track.stop()); recordingStreamRef.current = null; recorderRef.current = null;
      };
      recorder.start(500); setRecording(true); setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } catch {
      notify(locale === "ar" ? "تعذر تشغيل الميكروفون. راجع إذن الميكروفون في المتصفح." : "Could not start the microphone. Check browser permission.", "error");
    }
  }

  function stopVoiceRecording() {
    if (recordingTimerRef.current !== null) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  function clearVoiceRecording() {
    discardRecordingRef.current = true;
    if (recording) stopVoiceRecording();
    else discardRecordingRef.current = false;
    setFile(null); setRecordingSeconds(0); recordingChunksRef.current = [];
  }

  const activeOffers = useMemo(() => offers.filter((item) => text(item.status) === "active"), [offers]);
  const sortedOffers = useMemo(() => [...activeOffers].sort((left, right) => {
    if (offerSort === "cheapest") return numberValue(left.total_price_snapshot, Number.MAX_SAFE_INTEGER) - numberValue(right.total_price_snapshot, Number.MAX_SAFE_INTEGER);
    if (offerSort === "nearest") return numberValue(row(left.ranking_reason).distance_km, Number.MAX_SAFE_INTEGER) - numberValue(row(right.ranking_reason).distance_km, Number.MAX_SAFE_INTEGER);
    if (offerSort === "coverage") return numberValue(right.coverage_percentage) - numberValue(left.coverage_percentage);
    if (offerSort === "rating") return (offerReasonNumber(row(right.ranking_reason), ["rating", "merchant_rating", "store_rating"]) ?? -1) - (offerReasonNumber(row(left.ranking_reason), ["rating", "merchant_rating", "store_rating"]) ?? -1);
    return numberValue(left.ranking, Number.MAX_SAFE_INTEGER) - numberValue(right.ranking, Number.MAX_SAFE_INTEGER);
  }), [activeOffers, offerSort]);

  function selectedLocation() {
    const selected = locationOptions.find((item) => text(item.id) === cityId);
    return {
      city_id: cityId || text(location.city_id) || null,
      city: text(selected?.name_ar || location.city_ar || location.city),
      city_en: text(selected?.name_en || location.city_en),
      governorate: text(selected?.governorate_ar || location.governorate_ar || location.governorate),
      governorate_en: text(selected?.governorate_en || location.governorate_en),
      country: text(selected?.country_ar || location.country_ar || location.country, "مصر"),
      country_en: text(selected?.country_en || location.country_en, "Egypt"),
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
    };
  }

  function updateItem(index: number, patch: Partial<DraftItem>) { setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function cleanItems() { return items.filter((item) => item.name.trim() && item.quantity > 0).map((item) => ({ name: item.name.trim(), quantity: item.quantity, unit: item.unit.trim() || (locale === "ar" ? "قطعة" : "piece"), confidence: item.confidence })); }

  async function submitNew(event: FormEvent) {
    event.preventDefault();
    if (!cityId && !text(location.city_id)) { notify(locale === "ar" ? "حدد موقعك الأول عشان نجيب عروض مناسبة." : "Choose your location first to get relevant offers.", "error"); return; }
    setSaving(true);
    try {
      const searchScope = { scope, location: selectedLocation() };
      if (mode === "manual") {
        if (!cleanItems().length) throw new Error("quote_items_required");
        await buyerPost("create_manual_quote", { items: cleanItems(), searchScope });
        notify(locale === "ar" ? "تم إنشاء الطلب وجلب العروض المتاحة." : "The request was created and available offers were generated.", "success");
        setNewOpen(false); setItems([initialItem(locale)]); await refresh(); return;
      }
      if (!file) throw new Error("file_required");
      const uploaded = await buyerUpload(mode, file);
      const analyzed = row(await buyerPost("analyze_upload", { source: mode, file: uploaded, locale, searchScope, location: selectedLocation() }));
      const result = row(analyzed.result);
      const extracted = rows(result.items).map((item) => ({
        name: text(item.product_name), quantity: Math.max(0.0001, numberValue(item.quantity, 1)), unit: text(item.unit, locale === "ar" ? "قطعة" : "piece"),
        confidence: item.confidence === null || item.confidence === undefined ? null : numberValue(item.confidence), needsReview: item.needs_review === true,
      })).filter((item) => item.name);
      if (!extracted.length) throw new Error("analysis_failed");
      setItems(extracted); setAnalysisQuoteId(text(analyzed.quote_request_id));
      setAnalysisNote(text(result.summary, locale === "ar" ? "راجع العناصر قبل الاعتماد." : "Review the items before approval."));
      notify(locale === "ar" ? "تم تحليل الملف. راجع العناصر واضغط اعتماد الطلب." : "The file was analyzed. Review the items and approve the request.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_request_create_failed", "error"); }
    finally { setSaving(false); }
  }

  async function approveAnalysis(event: FormEvent) {
    event.preventDefault();
    if (!analysisQuoteId || !cleanItems().length) return;
    setSaving(true);
    try {
      await buyerPost("approve_analyzed_quote", { quoteRequestId: analysisQuoteId, items: cleanItems(), searchScope: { scope, location: selectedLocation() } });
      notify(locale === "ar" ? "تم اعتماد الطلب وجلب العروض." : "The request was approved and offers were generated.", "success");
      setNewOpen(false); setAnalysisQuoteId(""); clearVoiceRecording(); setItems([initialItem(locale)]); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "quote_approval_failed", "error"); }
    finally { setSaving(false); }
  }

  async function openRfqAcceptance(response: PortalRow) {
    const id = text(response.id || response.rfq_response_id);
    setShippingBusy(true); setShippingResponse(response); setShippingOptions({}); setShippingCompanyId(""); setShippingWeight("1"); setFulfillmentMode("pickup");
    try {
      const result = await buyerPost("rfq_shipping_options", { rfqResponseId: id, totalWeightKg: 1 });
      const options = Array.isArray(result) ? { companies: result } : row(result);
      const companies = rows(options.companies);
      setShippingOptions(options); setShippingCompanyId(text(companies[0]?.id));
      setFulfillmentMode(options.delivery_enabled === true ? "delivery" : "pickup");
    } catch (error) {
      setShippingResponse({}); notify(error instanceof Error ? error.message : "rfq_response_not_found", "error");
    } finally { setShippingBusy(false); }
  }

  function selectedShipping() {
    const companies = rows(shippingOptions.companies);
    const company = companies.find((item) => text(item.id) === shippingCompanyId) ?? companies[0];
    const weight = Math.max(0.001, numberValue(shippingWeight, 1));
    const batch = rows(company?.batches).find((item) => weight >= numberValue(item.min_weight_kg) && weight <= numberValue(item.max_weight_kg));
    if (fulfillmentMode === "pickup") return { companies, company: undefined, weight, cost: 0, branchDelivery: false };
    if (shippingOptions.free_delivery_eligible === true) return { companies, company: undefined, weight, cost: 0, branchDelivery: companies.length === 0 };
    if (companies.length) return { companies, company, weight, cost: batch ? numberValue(batch.price) : null, branchDelivery: false };
    const rawCost = shippingOptions.delivery_cost;
    return { companies, company: undefined, weight, cost: rawCost === null || rawCost === undefined ? null : numberValue(rawCost), branchDelivery: true };
  }

  async function refreshBranchWeightQuote(weightValue: string) {
    const responseId = text(shippingResponse.id || shippingResponse.rfq_response_id);
    if (!responseId || fulfillmentMode !== "delivery" || shippingOptions.requires_weight !== true || rows(shippingOptions.companies).length > 0) return;
    setShippingBusy(true);
    try {
      const result = await buyerPost("rfq_shipping_options", { rfqResponseId: responseId, totalWeightKg: Math.max(0.001, numberValue(weightValue, 1)) });
      setShippingOptions(Array.isArray(result) ? { companies: result } : row(result));
    } catch (error) { notify(error instanceof Error ? error.message : "delivery_price_not_available", "error"); }
    finally { setShippingBusy(false); }
  }

  async function acceptRfqWithShipping() {
    const responseId = text(shippingResponse.id || shippingResponse.rfq_response_id);
    if (!responseId) return;
    const selected = selectedShipping();
    if (fulfillmentMode === "delivery" && selected.cost === null) { notify("shipping_weight_not_covered", "error"); return; }
    setShippingBusy(true);
    try {
      await buyerPost("accept_rfq_response", {
        rfqResponseId: responseId,
        shippingCompanyId: fulfillmentMode === "delivery" ? (text(selected.company?.id) || null) : null,
        shippingCompanyName: fulfillmentMode === "delivery" ? (selected.branchDelivery ? "__branch_delivery__" : text(selected.company?.name) || null) : null,
        totalWeightKg: fulfillmentMode === "delivery" && shippingOptions.requires_weight === true ? selected.weight : null,
        shippingCost: fulfillmentMode === "delivery" ? selected.cost : 0,
      });
      notify(locale === "ar" ? "تم قبول رد المتجر وإنشاء الطلب." : "The store response was accepted and the order was created.", "success");
      setShippingResponse({}); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_request_action_failed", "error"); }
    finally { setShippingBusy(false); }
  }

  async function openOfferReview(offer: PortalRow) {
    const offerId = text(offer.id);
    if (!offerId) return;
    setOfferReviewBusy(true);
    try {
      const preview = row(await buyerPost("preview_offer_acceptance", { offerId }));
      const quantities: Record<string, string> = {};
      for (const item of rows(preview.items)) {
        const itemId = text(item.offer_item_id);
        if (itemId) quantities[itemId] = String(numberValue(item.requested_quantity, 1));
      }
      setOfferReview({ offer, preview, quantities });
    } catch (error) {
      notify(error instanceof Error ? error.message : "offer_preview_failed", "error");
    } finally { setOfferReviewBusy(false); }
  }

  function patchOfferQuantity(itemId: string, nextValue: string) {
    setOfferReview((current) => current ? { ...current, quantities: { ...current.quantities, [itemId]: nextValue } } : current);
  }

  function reviewedOfferTotals(review: OfferReviewState) {
    const previewItems = rows(review.preview.items);
    let productsTotal = 0;
    let invalid = false;
    for (const item of previewItems) {
      const id = text(item.offer_item_id);
      const requested = numberValue(item.requested_quantity, 1);
      const selected = Math.max(0, numberValue(review.quantities[id], requested));
      const available = item.available_quantity === null || item.available_quantity === undefined ? null : numberValue(item.available_quantity);
      const catalog = item.is_catalog_product === true;
      const availableNow = item.is_available_now === true;
      if (catalog && (!availableNow || selected <= 0 || available === null || selected > available)) invalid = true;
      if (availableNow || !catalog) productsTotal += numberValue(item.current_unit_price) * selected;
    }
    const freeEnabled = review.preview.free_delivery_enabled === true;
    const freeMinimum = review.preview.free_delivery_minimum === null || review.preview.free_delivery_minimum === undefined ? null : numberValue(review.preview.free_delivery_minimum);
    const freeEligible = freeEnabled && freeMinimum !== null && productsTotal >= freeMinimum;
    const baseDelivery = review.preview.delivery_cost === null || review.preview.delivery_cost === undefined ? null : numberValue(review.preview.delivery_cost);
    const deliveryMethod = text(review.preview.delivery_method);
    const quantitiesChanged = previewItems.some((item) => {
      const id = text(item.offer_item_id);
      return Math.abs(numberValue(review.quantities[id], numberValue(item.requested_quantity, 1)) - numberValue(item.requested_quantity, 1)) > 0.000001;
    });
    const deliveryCost = freeEligible ? 0 : deliveryMethod === "weight" && quantitiesChanged ? null : baseDelivery;
    return { productsTotal, invalid, freeEligible, freeMinimum, deliveryCost, estimatedTotal: productsTotal + (deliveryCost ?? 0) };
  }

  async function acceptReviewedOffer() {
    if (!offerReview) return;
    const totals = reviewedOfferTotals(offerReview);
    if (totals.invalid) {
      notify(locale === "ar" ? "عدّل الكميات بحيث لا تتجاوز المخزون المتاح." : "Adjust quantities so they do not exceed available stock.", "error");
      return;
    }
    const offerId = text(offerReview.offer.id);
    const itemQuantities = rows(offerReview.preview.items).map((item) => ({
      offer_item_id: text(item.offer_item_id),
      quantity: numberValue(offerReview.quantities[text(item.offer_item_id)], numberValue(item.requested_quantity, 1)),
    })).filter((item) => item.offer_item_id && item.quantity > 0);
    setOfferReviewBusy(true);
    try {
      await buyerPost("accept_offer", { offerId, itemQuantities });
      notify(locale === "ar" ? "تم قبول العرض، والطلب ظهر في الطلبات المقبولة." : "Offer accepted. The order is now in accepted orders.", "success");
      setOfferReview(null);
      await refresh();
    } catch (error) {
      try {
        const preview = row(await buyerPost("preview_offer_acceptance", { offerId }));
        const quantities: Record<string, string> = {};
        for (const item of rows(preview.items)) quantities[text(item.offer_item_id)] = String(numberValue(item.requested_quantity, 1));
        setOfferReview((current) => current ? { ...current, preview, quantities } : current);
      } catch { /* keep the existing preview if refresh also fails */ }
      notify(error instanceof Error ? error.message : "accept_offer_failed", "error");
    } finally { setOfferReviewBusy(false); }
  }

  async function requestManualPricingForOffer() {
    if (!offerReview) return;
    const offerId = text(offerReview.offer.id);
    const quoteItemIds = rows(offerReview.offer.items).map((item) => text(item.quote_item_id)).filter(Boolean);
    if (!offerId || !quoteItemIds.length) return;
    setOfferReviewBusy(true);
    try {
      await buyerPost("create_direct_rfq_from_offer", { offerId, quoteItemIds });
      notify(locale === "ar" ? "تم إرسال قائمة الطلب كاملة للتسعير اليدوي." : "The full request was sent for manual pricing.", "success");
      setOfferReview(null);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "manual_rfq_failed", "error"); }
    finally { setOfferReviewBusy(false); }
  }

  async function confirmRejectRfqResponse() {
    if (!rejectResponse) return;
    const responseId = text(rejectResponse.id || rejectResponse.rfq_response_id);
    if (!responseId) return;
    setBusyId(`reject_rfq_response:${responseId}`);
    try {
      await buyerPost("reject_rfq_response", { rfqResponseId: responseId });
      notify(locale === "ar" ? "تم رفض العرض السعري." : "The quote was rejected.", "success");
      setRejectResponse(null);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "rfq_reject_failed", "error"); }
    finally { setBusyId(""); }
  }

  async function action(id: string, task: string, body: Record<string, unknown> = {}) {
    if (task === "delete_quote" && !(await confirm({ title: locale === "ar" ? "حذف طلب التسعير" : "Delete quote request", body: locale === "ar" ? "سيتم حذف الطلب من قائمتك ولن يظهر ضمن السجل الحالي." : "This quote request will be removed from your current history.", confirmLabel: locale === "ar" ? "حذف الطلب" : "Delete request", tone: "danger" }))) return;
    setBusyId(`${task}:${id}`);
    try {
      await buyerPost(task, body);
      notify(locale === "ar" ? "تم تنفيذ العملية بنجاح." : "The action was completed.", "success"); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_request_action_failed", "error"); }
    finally { setBusyId(""); }
  }



  return <div className="portal-section-stack">
    <div className="portal-subtabs"><button className={tab === "offers" ? "active" : ""} onClick={() => setTab("offers")}><Icon name="compare"/>{locale === "ar" ? `عروض مستلمة (${activeOffers.length})` : `Received offers (${activeOffers.length})`}</button><button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><Icon name="quote"/>{locale === "ar" ? `قيد التسعير (${requests.length})` : `Pricing (${requests.length})`}</button><button className={tab === "rfq" ? "active" : ""} onClick={() => setTab("rfq")}><Icon name="store"/>{locale === "ar" ? `ردود المتاجر (${rfqResponses.length})` : `Store responses (${rfqResponses.length})`}</button><button className="button primary compact" type="button" onClick={() => { setMode("manual"); setAnalysisQuoteId(""); setItems([initialItem(locale)]); setNewOpen(true); }}><Icon name="plus"/>{locale === "ar" ? "طلب جديد" : "New request"}</button></div>

    {tab === "requests" ? <PortalPanel title={locale === "ar" ? "طلبات التسعير" : "Quote requests"} subtitle={locale === "ar" ? "راجع حالة الطلب والعناصر أو اطلب ردودًا إضافية من المتاجر." : "Review request status and items, or ask stores for additional responses."}>
      {requests.length ? <div className="buyer-request-list">{requests.map((request) => { const id = text(request.id); const quoteItems = rows(request.quote_items); const direct = text(request.delivery_type) === "direct"; return <article key={id} data-record-id={id} className="buyer-request-card"><header><div><strong>{direct ? (locale === "ar" ? `طلب مخصوص: ${text(row(request.direct_contact).store_name, "متجر")}` : `Direct request: ${text(row(request.direct_contact).store_name, "Store")}`) : (locale === "ar" ? `طلب #${id.slice(0, 8)}` : `Request #${id.slice(0, 8)}`)}</strong><small>{dateLabel(request.created_at, locale)}</small></div><StatusBadge value={request.ai_review_status} locale={locale}/></header><div className="request-item-summary">{quoteItems.map((item) => <span key={text(item.id)}>{text(item.requested_name)} × {numberValue(item.quantity)} {text(item.unit)}</span>)}</div>{row(request.direct_contact).contact_mobile ? <Notice tone="success" title={locale === "ar" ? "بيانات التواصل متاحة" : "Contact is available"}>{locale === "ar" ? `المتجر: ${text(row(request.direct_contact).store_name)} — ${text(row(request.direct_contact).contact_mobile)}` : `Store: ${text(row(request.direct_contact).store_name)} — ${text(row(request.direct_contact).contact_mobile)}`}</Notice> : null}<footer><button className="button secondary compact" type="button" onClick={() => setRequestDetails(request)}><Icon name="info" size={16}/>{locale === "ar" ? "التفاصيل" : "Details"}</button><button className="button secondary compact" disabled={busyId === `generate_offers:${id}`} onClick={() => void action(id, "generate_offers", { quoteRequestId: id })}>{locale === "ar" ? "تحديث العروض" : "Refresh offers"}</button>{!direct ? <button className="button secondary compact" disabled={busyId === `create_rfq:${id}`} onClick={() => void action(id, "create_rfq", { quoteRequestId: id })}>{locale === "ar" ? "اطلب ردود متاجر" : "Ask stores"}</button> : null}<button className="button danger-button compact" disabled={busyId === `delete_quote:${id}`} onClick={() => void action(id, "delete_quote", { quoteRequestId: id })}>{locale === "ar" ? "حذف" : "Delete"}</button></footer></article>; })}</div> : <EmptyState icon="quote" title={locale === "ar" ? "مفيش طلبات تسعير" : "No quote requests"} body={locale === "ar" ? "أنشئ طلبًا يدويًا أو ارفع صورة أو PDF أو تسجيلًا صوتيًا." : "Create a manual request or upload an image, PDF, or voice file."}/>} 
    </PortalPanel> : null}

    {tab === "offers" ? <PortalPanel title={locale === "ar" ? "عروض مستلمة" : "Received offers"} subtitle={locale === "ar" ? "قارن التغطية والسعر والتوصيل، ثم افتح العرض لمراجعة المخزون والكميات قبل القبول." : "Compare coverage, price, and delivery, then review current stock and quantities before accepting."}>
      <div className="portal-toolbar offer-sort-toolbar"><label>{locale === "ar" ? "ترتيب العروض" : "Sort offers"}<select value={offerSort} onChange={(event) => setOfferSort(event.target.value as OfferSort)}><option value="ranking">{locale === "ar" ? "الترتيب الأنسب" : "Best match"}</option><option value="cheapest">{locale === "ar" ? "الأقل سعرًا" : "Lowest price"}</option><option value="nearest">{locale === "ar" ? "الأقرب" : "Nearest"}</option><option value="coverage">{locale === "ar" ? "أعلى تغطية" : "Highest coverage"}</option><option value="rating">{locale === "ar" ? "أعلى تقييم" : "Highest rating"}</option></select></label><span className="toolbar-count">{locale === "ar" ? `${sortedOffers.length} عرض` : `${sortedOffers.length} offers`}</span></div>
      {sortedOffers.length ? <div className="offer-card-grid">{sortedOffers.map((offer) => {
        const id = text(offer.id);
        const offerItems = rows(offer.items);
        const reason = row(offer.ranking_reason);
        const distance = offerReasonNumber(reason, ["distance_km", "distanceKm", "distance"]);
        const rating = offerReasonNumber(reason, ["rating", "merchant_rating", "store_rating"]);
        const openToday = offerReasonBool(reason, ["is_open", "open_today", "open_now", "was_open_at_offer_generation", "merchant_open"]);
        const deliveryAvailable = offerReasonBool(reason, ["delivery_available", "shipping_available"]);
        const freeDeliveryEligible = offerReasonBool(reason, ["free_delivery_eligible"]) === true;
        const freeDeliveryEnabled = offerReasonBool(reason, ["free_delivery_enabled"]) === true;
        const freeDeliveryMinimum = offerReasonNumber(reason, ["free_delivery_minimum"]);
        const deliveryCost = offerReasonNumber(reason, ["delivery_cost", "delivery_fee", "delivery_price", "delivery_total"]);
        const locationFallback = offerReasonBool(reason, ["location_fallback"]) === true;
        const area = offerReasonText(reason, ["area", "zone", "city", "governorate", "location_label"]);
        const unavailable = offerItems.filter((item) => item.is_available === false).length;
        return <article key={id} data-record-id={text(offer.quote_request_id || id)} className="offer-card">
          <header><div><strong>{text(offer.merchant_name || offer.store_name, locale === "ar" ? "عرض متجر" : "Store offer")}</strong><MerchantTrustBadges founderEnabled={offer.founder_badge_enabled === true} trustedEnabled={offer.trusted_badge_enabled === true} locale={locale} compact/><small>{locale === "ar" ? `صالحة حتى ${dateLabel(offer.expires_at, locale)}` : `Valid until ${dateLabel(offer.expires_at, locale)}`}</small></div><StatusBadge value={offer.status} locale={locale}/></header>
          <div className="offer-comparison-strip"><span><Icon name="money" size={16}/>{money(offer.total_price_snapshot, currency, locale)}</span><span><Icon name="check" size={16}/>{numberValue(offer.coverage_percentage)}%</span>{distance !== null ? <span><Icon name="location" size={16}/>{locale === "ar" ? `${distance.toFixed(1)} كم` : `${distance.toFixed(1)} km`}</span> : null}{rating !== null ? <span><Icon name="star" size={16}/>{rating.toFixed(1)}</span> : null}{freeDeliveryEligible ? <span><Icon name="truck" size={16}/>{locale === "ar" ? "توصيل مجاني" : "Free delivery"}</span> : deliveryCost !== null ? <span><Icon name="truck" size={16}/>{money(deliveryCost, currency, locale)}</span> : deliveryAvailable !== null ? <span><Icon name="truck" size={16}/>{deliveryAvailable ? (locale === "ar" ? "التوصيل متاح" : "Delivery available") : (locale === "ar" ? "لا يوجد توصيل" : "No delivery")}</span> : null}{openToday !== null ? <span><Icon name="clock" size={16}/>{openToday ? (locale === "ar" ? "متاح اليوم" : "Open today") : (locale === "ar" ? "غير متاح اليوم" : "Closed today")}</span> : null}</div>
          {freeDeliveryEnabled && !freeDeliveryEligible && freeDeliveryMinimum !== null ? <Notice tone="info">{locale === "ar" ? `أضف منتجات حتى ${money(freeDeliveryMinimum, currency, locale)} للحصول على توصيل مجاني من هذا الفرع.` : `Add products until ${money(freeDeliveryMinimum, currency, locale)} to receive free delivery from this branch.`}</Notice> : null}
          {openToday === false ? <Notice tone="warning">{locale === "ar" ? "المتجر مطابق لكنه غير متاح اليوم، وقد يتأخر التأكيد." : "This store matches your request but is not available today, so confirmation may be delayed."}</Notice> : null}
          {locationFallback ? <Notice tone="warning">{locale === "ar" ? `لم نجد عرضًا مطابقًا في منطقتك، فظهر هذا العرض من ${area || "منطقة أخرى"}.` : `No matching offer was found in your area, so this result is from ${area || "another area"}.`}</Notice> : null}
          {unavailable ? <Notice tone="warning">{locale === "ar" ? `${unavailable} بند غير متوفر؛ تقدر تطلب تسعير يدوي للقائمة كاملة من التفاصيل.` : `${unavailable} item(s) unavailable; you can request manual pricing for the full list from details.`}</Notice> : null}
          <div className="request-item-summary">{offerItems.map((item) => <span className={item.is_available === false ? "unavailable" : ""} key={text(item.id)}>{text(item.matched_name_snapshot || item.requested_name_snapshot || item.requested_name)} — {money(item.line_total_snapshot, currency, locale)}</span>)}</div>
          <footer><button className="button primary full" disabled={offerReviewBusy} onClick={() => void openOfferReview(offer)}><Icon name="info"/>{locale === "ar" ? "تفاصيل العرض" : "Offer details"}</button></footer>
        </article>;
      })}</div> : <EmptyState icon="compare" title={locale === "ar" ? "لا توجد عروض مستلمة حاليًا" : "No received offers right now"} body={locale === "ar" ? "حدّث عروض الطلب أو أرسل طلبًا للمتاجر." : "Refresh request offers or ask stores to respond."}/>} 

      {rfqResponses.length ? <div className="offer-card-grid">{rfqResponses.map((response) => { const id = text(response.id || response.rfq_response_id); return <article className="offer-card" key={id} data-record-id={text(response.quote_request_id || response.rfq_request_id || id)}><header><div><strong>{text(response.store_name || response.merchant_name, locale === "ar" ? "رد متجر" : "Store response")}</strong><small>{dateLabel(response.submitted_at || response.created_at, locale)}</small></div><StatusBadge value={response.status || "submitted"} locale={locale}/></header><div className="offer-total"><span>{locale === "ar" ? "الإجمالي" : "Total"}</span><strong>{money(response.grand_total || response.total_price || response.total_price_snapshot, currency, locale)}</strong></div>{text(response.branch_name) ? <p>{locale === "ar" ? `الفرع: ${text(response.branch_name)}` : `Branch: ${text(response.branch_name)}`}</p> : null}{text(response.selected_shipping_company_name) ? <p>{locale === "ar" ? `الشحن: ${text(response.selected_shipping_company_name)}` : `Shipping: ${text(response.selected_shipping_company_name)}`}</p> : null}<footer><button className="button danger-button" disabled={busyId === `reject_rfq_response:${id}`} onClick={() => setRejectResponse(response)}>{locale === "ar" ? "رفض العرض" : "Reject quote"}</button><button className="button primary" disabled={shippingBusy && text(shippingResponse.id || shippingResponse.rfq_response_id) === id} onClick={() => void openRfqAcceptance(response)}>{locale === "ar" ? "مراجعة الشحن والقبول" : "Review shipping & accept"}</button></footer></article>; })}</div> : <EmptyState icon="store" title={locale === "ar" ? "لسه مفيش ردود" : "No responses yet"} body={locale === "ar" ? "هتظهر ردود المتاجر هنا أول ما يرسلوها." : "Store responses will appear here when submitted."}/>} 
    </PortalPanel> : null}

    {requestDetails ? (() => {
      const request = requestDetails;
      const id = text(request.id);
      const direct = text(request.delivery_type) === "direct";
      const contact = row(request.direct_contact);
      const quoteItems = rows(request.quote_items);
      return <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal request-details-modal" role="dialog" aria-modal="true" aria-labelledby="buyer-request-details-title">
        <header><div><span className="eyebrow"><Icon name="quote" size={17}/>{locale === "ar" ? "تفاصيل طلب التسعير" : "Quote request details"}</span><h2 id="buyer-request-details-title">{direct ? text(contact.store_name, locale === "ar" ? "طلب مخصوص" : "Direct request") : (locale === "ar" ? `طلب #${id.slice(0, 8)}` : `Request #${id.slice(0, 8)}`)}</h2><p>{dateLabel(request.created_at, locale)}</p></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق التفاصيل" : "Close details"} onClick={() => setRequestDetails(null)}><Icon name="close"/></button></header>
        <div className="detail-list"><div><span>{locale === "ar" ? "نوع الطلب" : "Request type"}</span><strong>{direct ? (locale === "ar" ? "طلب مخصوص لمتجر" : "Direct store request") : (locale === "ar" ? "طلب عام" : "Marketplace request")}</strong></div><div><span>{locale === "ar" ? "حالة المراجعة" : "Review status"}</span><StatusBadge value={request.ai_review_status} locale={locale}/></div>{text(request.response_deadline_at) ? <div><span>{locale === "ar" ? "مهلة الرد" : "Response deadline"}</span><strong>{dateLabel(request.response_deadline_at, locale)}</strong></div> : null}{direct && text(contact.store_name) ? <div><span>{locale === "ar" ? "المتجر" : "Store"}</span><strong>{text(contact.store_name)}</strong></div> : null}{direct && text(contact.contact_mobile) ? <div><span>{locale === "ar" ? "رقم التواصل" : "Contact number"}</span><a href={`tel:${text(contact.contact_mobile)}`}>{text(contact.contact_mobile)}</a></div> : null}</div>
        <section className="request-details-items"><h3>{locale === "ar" ? "المنتجات المطلوبة" : "Requested items"}</h3>{quoteItems.length ? quoteItems.map((item) => <article key={text(item.id)}><div><strong>{text(item.requested_name, locale === "ar" ? "منتج" : "Item")}</strong>{typeof item.specifications === "string" && text(item.specifications) ? <small>{text(item.specifications)}</small> : null}</div><span>{numberValue(item.quantity)} {text(item.unit)}</span></article>) : <p className="muted-copy">{locale === "ar" ? "لا توجد بنود محفوظة في هذا الطلب." : "No saved items in this request."}</p>}</section>
        <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setRequestDetails(null)}>{locale === "ar" ? "إغلاق" : "Close"}</button>{direct && text(contact.contact_mobile) ? <a className="button primary" href={`tel:${text(contact.contact_mobile)}`}><Icon name="phone" size={17}/>{locale === "ar" ? "اتصال بالمتجر" : "Call store"}</a> : null}</div>
      </section></div>;
    })() : null}

    {offerReview ? (() => {
      const review = offerReview;
      const totals = reviewedOfferTotals(review);
      const reason = row(review.offer.ranking_reason);
      const previewItems = rows(review.preview.items);
      const offerItems = rows(review.offer.items);
      const unavailableOfferItems = offerItems.filter((item) => item.is_available === false);
      const deliveryAvailable = review.preview.delivery_available === true;
      const deliveryWeight = review.preview.delivery_weight_kg === null || review.preview.delivery_weight_kg === undefined ? null : numberValue(review.preview.delivery_weight_kg);
      const deliveryLabel = text(review.preview.delivery_method) === "weight" && deliveryWeight !== null ? (locale === "ar" ? `تكلفة التوصيل بالوزن (${deliveryWeight} كجم)` : `Weight delivery (${deliveryWeight} kg)`) : (locale === "ar" ? "تكلفة التوصيل" : "Delivery cost");
      return <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal wide offer-review-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="compare"/>{locale === "ar" ? "تفاصيل العرض" : "Offer details"}</span><h2>{text(review.offer.merchant_name || review.offer.store_name, locale === "ar" ? "عرض متجر" : "Store offer")}</h2><MerchantTrustBadges founderEnabled={review.offer.founder_badge_enabled === true} trustedEnabled={review.offer.trusted_badge_enabled === true} locale={locale}/><p>{locale === "ar" ? "تم التحقق من المخزون الحالي قبل الموافقة. عدّل الكمية عند الحاجة." : "Current stock was checked before acceptance. Adjust quantities if needed."}</p></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق تفاصيل العرض" : "Close offer details"} onClick={() => setOfferReview(null)}><Icon name="close"/></button></header>
        <div className="offer-review-summary"><div><span>{locale === "ar" ? "إجمالي المنتجات" : "Items total"}</span><strong>{money(totals.productsTotal, currency, locale)}</strong></div><div><span>{deliveryLabel}</span><strong>{totals.freeEligible ? (locale === "ar" ? "مجاني" : "Free") : !deliveryAvailable ? (locale === "ar" ? "غير متاح" : "Not available") : totals.deliveryCost === null ? (locale === "ar" ? "يُحدّد عند الموافقة" : "Calculated on acceptance") : money(totals.deliveryCost, currency, locale)}</strong></div><div><span>{locale === "ar" ? "الإجمالي المتوقع" : "Estimated total"}</span><strong>{money(totals.estimatedTotal, currency, locale)}</strong></div><div><span>{locale === "ar" ? "نسبة التغطية" : "Coverage"}</span><strong>{numberValue(review.offer.coverage_percentage)}%</strong></div></div>
        {reason.is_open === false || reason.open_today === false || reason.was_open_at_offer_generation === false ? <Notice tone="warning">{locale === "ar" ? "المتجر غير متاح اليوم، لذلك قد يتأخر التأكيد." : "The store is not available today, so confirmation may be delayed."}</Notice> : null}
        {reason.location_fallback === true ? <Notice tone="warning">{locale === "ar" ? "هذا العرض من منطقة أخرى لأن النظام لم يجد عرضًا مطابقًا في منطقتك. بيانات المتجر والفرع تظهر بعد القبول." : "This offer is from another area because no matching local offer was found. Store and branch details appear after acceptance."}</Notice> : null}
        <section className="offer-review-items"><h3>{locale === "ar" ? "بنود العرض" : "Offer items"}</h3>{previewItems.map((item) => { const id = text(item.offer_item_id); const requested = numberValue(item.requested_quantity, 1); const available = item.available_quantity === null || item.available_quantity === undefined ? null : numberValue(item.available_quantity); const selected = offerReview.quantities[id] ?? String(requested); const invalid = item.is_catalog_product === true && (item.is_available_now !== true || numberValue(selected) <= 0 || available === null || numberValue(selected) > available); return <article className={invalid ? "offer-review-item invalid" : "offer-review-item"} key={id}><div><strong>{text(item.product_name, locale === "ar" ? "منتج" : "Product")}</strong><small>{locale === "ar" ? `المطلوب ${requested} ${text(item.unit)}` : `Requested ${requested} ${text(item.unit)}`}</small>{item.is_catalog_product === true ? <small>{locale === "ar" ? `المتاح الآن: ${available ?? 0} ${text(item.unit)}` : `Available now: ${available ?? 0} ${text(item.unit)}`}</small> : <small>{locale === "ar" ? "بند خارج الكتالوج" : "Outside catalog item"}</small>}</div><div className="offer-review-price"><span>{money(item.current_unit_price, currency, locale)}</span>{item.is_catalog_product === true ? <label>{locale === "ar" ? "الكمية" : "Quantity"}<input type="number" min="0.0001" max={available ?? undefined} step="any" value={selected} onChange={(event) => patchOfferQuantity(id, event.target.value)}/></label> : null}</div></article>; })}</section>
        {totals.invalid ? <Notice tone="warning">{locale === "ar" ? "عدّل الكميات المعلّمة بحيث تكون مساوية للمخزون الحالي أو أقل قبل الموافقة." : "Adjust highlighted quantities so they do not exceed current stock before accepting."}</Notice> : null}
        {unavailableOfferItems.length ? <Notice tone="warning" title={locale === "ar" ? "في بنود غير متوفرة" : "Some items are unavailable"}>{locale === "ar" ? "تقدر تبعت قائمة الطلب كاملة لنفس المتجر علشان يسعّرها يدويًا." : "You can send the full request to the same store for manual pricing."}</Notice> : null}
        <div className="modal-actions">{unavailableOfferItems.length ? <button className="button secondary" type="button" disabled={offerReviewBusy || reason.manual_rfq_pending === true} onClick={() => void requestManualPricingForOffer()}><Icon name="quote"/>{reason.manual_rfq_pending === true ? (locale === "ar" ? "في انتظار رد المتجر" : "Waiting for store response") : (locale === "ar" ? "اطلب تسعير يدوي" : "Request manual pricing")}</button> : null}<button className="button secondary" type="button" onClick={() => setOfferReview(null)}>{locale === "ar" ? "إغلاق" : "Close"}</button><button className="button primary" type="button" disabled={offerReviewBusy || totals.invalid || !previewItems.length} onClick={() => void acceptReviewedOffer()}>{offerReviewBusy ? (locale === "ar" ? "جارٍ القبول" : "Accepting") : (locale === "ar" ? "موافقة على العرض" : "Accept offer")}</button></div>
      </section></div>;
    })() : null}

    {rejectResponse ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal compact-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="close"/>{locale === "ar" ? "رفض العرض" : "Reject quote"}</span><h2>{locale === "ar" ? "رفض العرض؟" : "Reject this quote?"}</h2></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق" : "Close"} onClick={() => setRejectResponse(null)}><Icon name="close"/></button></header><p>{text(rejectResponse.delivery_type) === "direct" ? (locale === "ar" ? "رفض العرض سينهي الطلب المخصوص. تقدر ترسل طلب جديد لاحقًا للحصول على سعر جديد." : "Rejecting this quote will finish the direct request. You can send a new request later for another price.") : (locale === "ar" ? "لن يتم إنشاء طلب من هذا العرض، وتقدر تراجع عروض المتاجر الأخرى." : "No order will be created from this quote. You can review other store offers.")}</p><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setRejectResponse(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button danger-button" type="button" disabled={busyId.startsWith("reject_rfq_response:")} onClick={() => void confirmRejectRfqResponse()}>{locale === "ar" ? "تأكيد الرفض" : "Confirm rejection"}</button></div></section></div> : null}

    {newOpen ? <div className="portal-modal-backdrop"><section className="portal-modal buyer-request-modal"><header><div><span className="eyebrow"><Icon name="quote"/>{locale === "ar" ? "طلب تسعير جديد" : "New quote request"}</span><h2>{locale === "ar" ? "اكتب أو ارفع قائمة المنتجات" : "Enter or upload your item list"}</h2><p>{locale === "ar" ? "راجع كل عنصر قبل الإرسال؛ الأسعار لا تُستخرج من الفاتورة." : "Review every item before sending; invoice prices are not extracted."}</p></div><button className="icon-button" data-modal-close aria-label={locale === "ar" ? "إغلاق" : "Close"} onClick={() => setNewOpen(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={analysisQuoteId ? approveAnalysis : submitNew}>
      <div className="portal-subtabs request-source-tabs">{(["manual","image","pdf","voice"] as NewMode[]).map((source) => <button type="button" className={mode === source ? "active" : ""} key={source} onClick={() => { setMode(source); setAnalysisQuoteId(""); clearVoiceRecording(); setItems([initialItem(locale)]); }}>{source === "manual" ? (locale === "ar" ? "يدوي" : "Manual") : source === "image" ? (locale === "ar" ? "صورة" : "Image") : source.toUpperCase()}</button>)}</div>
      {mode !== "manual" && !analysisQuoteId && mode !== "voice" ? <label className="file-drop-zone"><Icon name="upload" size={28}/><strong>{locale === "ar" ? "اختار الملف" : "Choose file"}</strong><small>{mode === "image" ? "JPG, PNG, WEBP — 4MB" : "PDF — 18MB"}</small><input type="file" required accept={mode === "image" ? "image/jpeg,image/png,image/webp" : "application/pdf"} capture={mode === "image" ? "environment" : undefined} onChange={(event) => setFile(event.target.files?.[0] ?? null)}/>{file ? <span>{file.name}</span> : null}</label> : null}
      {mode === "voice" && !analysisQuoteId ? <section className="voice-recorder-panel"><span className={`voice-recorder-icon ${recording ? "recording" : ""}`}><Icon name="microphone" size={30}/></span><div><strong>{recording ? (locale === "ar" ? "جارٍ التسجيل" : "Recording") : file ? (locale === "ar" ? "التسجيل جاهز" : "Recording ready") : (locale === "ar" ? "سجّل طلبك بصوتك" : "Record your request")}</strong><small>{recording ? `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}` : file ? file.name : (locale === "ar" ? "يمكنك كمان رفع ملف صوت موجود." : "You can also upload an existing audio file.")}</small></div><div className="inline-actions">{!recording ? <button className="button primary compact" type="button" onClick={() => void startVoiceRecording()}><Icon name="microphone"/>{locale === "ar" ? "بدء التسجيل" : "Start recording"}</button> : <button className="button danger-button compact" type="button" onClick={stopVoiceRecording}><Icon name="stop"/>{locale === "ar" ? "إيقاف" : "Stop"}</button>}{file ? <button className="button secondary compact" type="button" onClick={clearVoiceRecording}>{locale === "ar" ? "مسح التسجيل" : "Clear"}</button> : null}</div><label className="button secondary compact voice-file-button"><Icon name="upload"/>{locale === "ar" ? "رفع ملف صوت" : "Upload audio"}<input type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/webm,audio/ogg" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/></label></section> : null}
      {analysisNote ? <Notice tone="info">{analysisNote}</Notice> : null}
      {(mode === "manual" || analysisQuoteId) ? <div className="request-items-editor">{items.map((item, index) => <div className={`request-item-row ${item.needsReview ? "needs-review" : ""}`} key={index}><label className="grow">{locale === "ar" ? "اسم المنتج" : "Item name"}<input required value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })}/></label><label>{locale === "ar" ? "الكمية" : "Quantity"}<input type="number" min="0.0001" step="any" required value={item.quantity} onChange={(event) => updateItem(index, { quantity: numberValue(event.target.value, 1) })}/></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input required value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })}/></label>{items.length > 1 ? <button className="icon-button danger" type="button" aria-label={locale === "ar" ? "حذف البند" : "Remove item"} title={locale === "ar" ? "حذف البند" : "Remove item"} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><Icon name="trash"/></button> : null}{item.confidence !== undefined && item.confidence !== null ? <small className="confidence-note">{locale === "ar" ? `ثقة التحليل: ${Math.round(item.confidence * 100)}%` : `Analysis confidence: ${Math.round(item.confidence * 100)}%`}</small> : null}</div>)}</div> : null}
      {(mode === "manual" || analysisQuoteId) ? <button className="button secondary" type="button" onClick={() => setItems((current) => [...current, initialItem(locale)])}><Icon name="plus"/>{locale === "ar" ? "إضافة منتج" : "Add item"}</button> : null}
      <div className="form-grid two"><label>{locale === "ar" ? "نطاق البحث" : "Search area"}<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="city">{locale === "ar" ? "نفس المدينة" : "Same city"}</option><option value="governorate">{locale === "ar" ? "نفس المحافظة" : "Same governorate"}</option><option value="country">{locale === "ar" ? "كل الدولة" : "Whole country"}</option></select></label><label>{locale === "ar" ? "الموقع" : "Location"}<select required value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">{locale === "ar" ? "اختر المدينة" : "Choose city"}</option>{locationOptions.map((item) => <option value={text(item.id)} key={text(item.id)}>{locale === "ar" ? `${text(item.country_ar)} - ${text(item.governorate_ar)} - ${text(item.name_ar)}` : `${text(item.country_en)} - ${text(item.governorate_en)} - ${text(item.name_en)}`}</option>)}</select></label></div>
      <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setNewOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ التنفيذ" : "Working") : analysisQuoteId ? (locale === "ar" ? "اعتماد وجلب العروض" : "Approve and get offers") : mode === "manual" ? (locale === "ar" ? "إنشاء الطلب" : "Create request") : (locale === "ar" ? "رفع وتحليل" : "Upload and analyze")}</button></div>
    </form></section></div> : null}

    {text(shippingResponse.id || shippingResponse.rfq_response_id) ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal rfq-acceptance-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="store"/>{locale === "ar" ? "تفاصيل رد التسعير" : "Pricing response details"}</span><h2>{text(shippingResponse.store_name || shippingResponse.anonymous_store_label_ar || shippingResponse.anonymous_store_label_en, locale === "ar" ? "رد المتجر" : "Store response")}</h2><p>{locale === "ar" ? "راجع البنود ثم اختر الاستلام من المتجر أو التوصيل قبل القبول." : "Review priced items, then choose store pickup or delivery before accepting."}</p></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق" : "Close"} onClick={() => setShippingResponse({})}><Icon name="close"/></button></header>{shippingBusy && !Object.keys(shippingOptions).length ? <p className="muted-copy">{locale === "ar" ? "جارٍ تحميل تفاصيل الرد..." : "Loading response details..."}</p> : (() => { const selected = selectedShipping(); const productsTotal = numberValue(shippingResponse.total_price || shippingResponse.total_price_snapshot); const shippingCurrency = text(shippingOptions.currency_code, currency); const details = rows(shippingResponse.detailed_item_responses); const deliveryEnabled = shippingOptions.delivery_enabled === true; return <div className="portal-form rfq-acceptance-content"><div className="detail-list"><div><span>{locale === "ar" ? "الفرع" : "Branch"}</span><strong>{text(shippingOptions.branch_name || shippingResponse.branch_name, locale === "ar" ? "الفرع المحدد" : "Selected branch")}</strong></div><div><span>{locale === "ar" ? "إجمالي المنتجات" : "Products subtotal"}</span><strong>{money(productsTotal, shippingCurrency, locale)}</strong></div></div>{details.length ? <section className="request-details-items"><h3>{locale === "ar" ? "البنود المسعرة" : "Priced items"}</h3>{details.map((item) => <article key={text(item.rfq_item_id || item.quote_item_id)}><div><strong>{text(item.matched_name || item.requested_name, locale === "ar" ? "منتج" : "Item")}</strong><small>{numberValue(item.quantity)} {text(item.unit)}{text(item.note) ? ` · ${text(item.note)}` : ""}</small></div><span>{text(item.decision) === "priced" ? money(item.line_total, shippingCurrency, locale) : (locale === "ar" ? "غير متوفر" : "Unavailable")}</span></article>)}</section> : null}{deliveryEnabled ? <><div className="fulfillment-choice" role="group" aria-label={locale === "ar" ? "طريقة الاستلام" : "Fulfillment method"}><button className={fulfillmentMode === "pickup" ? "active" : ""} type="button" onClick={() => setFulfillmentMode("pickup")}><Icon name="store" size={17}/><span><strong>{locale === "ar" ? "استلام من المتجر" : "Store pickup"}</strong><small>{locale === "ar" ? "بدون تكلفة توصيل" : "No delivery fee"}</small></span></button><button className={fulfillmentMode === "delivery" ? "active" : ""} type="button" onClick={() => setFulfillmentMode("delivery")}><Icon name="truck" size={17}/><span><strong>{shippingOptions.free_delivery_eligible === true ? (locale === "ar" ? "توصيل مجاني" : "Free delivery") : (locale === "ar" ? "توصيل" : "Delivery")}</strong><small>{shippingOptions.free_delivery_minimum ? (locale === "ar" ? `المجاني يبدأ من ${money(shippingOptions.free_delivery_minimum, shippingCurrency, locale)}` : `Free from ${money(shippingOptions.free_delivery_minimum, shippingCurrency, locale)}`) : (locale === "ar" ? "حسب إعدادات الفرع" : "Based on branch settings")}</small></span></button></div>{fulfillmentMode === "delivery" ? <>{shippingOptions.requires_weight === true ? <label>{locale === "ar" ? "إجمالي الوزن (كجم)" : "Total weight (kg)"}<input type="number" min="0.001" step="any" value={shippingWeight} onChange={(event) => setShippingWeight(event.target.value)} onBlur={(event) => void refreshBranchWeightQuote(event.target.value)}/></label> : null}{selected.companies.length && shippingOptions.free_delivery_eligible !== true ? <><label>{locale === "ar" ? "شركة الشحن" : "Shipping company"}<select value={text(selected.company?.id)} onChange={(event) => setShippingCompanyId(event.target.value)}>{selected.companies.map((company) => <option key={text(company.id)} value={text(company.id)}>{text(company.name)}</option>)}</select></label><div className="shipping-tier-list">{rows(selected.company?.batches).map((batch) => <span key={text(batch.id)}>{numberValue(batch.min_weight_kg)}–{numberValue(batch.max_weight_kg)} {locale === "ar" ? "كجم" : "kg"}: {money(batch.price, shippingCurrency, locale)}</span>)}</div></> : null}{selected.cost === null ? <Notice tone="warning">{locale === "ar" ? "لا يوجد سعر توصيل متاح للوزن أو الموقع المحدد." : "No delivery price is available for the selected weight or location."}</Notice> : <div className="offer-comparison-strip"><span>{locale === "ar" ? "المنتجات" : "Products"}: {money(productsTotal, shippingCurrency, locale)}</span><span>{locale === "ar" ? "التوصيل" : "Delivery"}: {money(selected.cost, shippingCurrency, locale)}</span><strong>{locale === "ar" ? "الإجمالي" : "Total"}: {money(productsTotal + selected.cost, shippingCurrency, locale)}</strong></div>}</> : <div className="offer-comparison-strip"><span>{locale === "ar" ? "المنتجات" : "Products"}: {money(productsTotal, shippingCurrency, locale)}</span><span>{locale === "ar" ? "الاستلام" : "Pickup"}: {locale === "ar" ? "من المتجر" : "At store"}</span><strong>{locale === "ar" ? "الإجمالي" : "Total"}: {money(productsTotal, shippingCurrency, locale)}</strong></div>}</> : <Notice tone="info">{locale === "ar" ? "التوصيل غير متاح لهذا الفرع؛ الاستلام من المتجر متاح." : "Delivery is unavailable for this branch; store pickup is available."}</Notice>}<div className="modal-actions"><button className="button secondary" type="button" onClick={() => setShippingResponse({})}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="button" disabled={shippingBusy || (fulfillmentMode === "delivery" && selected.cost === null)} onClick={() => void acceptRfqWithShipping()}>{shippingBusy ? (locale === "ar" ? "جارٍ القبول" : "Accepting") : (locale === "ar" ? "موافقة على الرد" : "Accept response")}</button></div></div>; })()}</section></div> : null}
    {confirmDialog}
  </div>;
}
