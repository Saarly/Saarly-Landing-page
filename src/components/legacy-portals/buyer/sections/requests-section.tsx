"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost, buyerUpload } from "@/components/buyer/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

type Tab = "offers" | "requests" | "rfq";
type OfferSort = "ranking" | "cheapest" | "nearest" | "coverage" | "rating";
type NewMode = "manual" | "image" | "pdf" | "voice";
type DraftItem = { name: string; quantity: number; unit: string; confidence?: number | null; needsReview?: boolean };

function initialItem(locale: "ar" | "en"): DraftItem { return { name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }; }

export function BuyerRequestsSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
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
  const [shippingBusy, setShippingBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    if (offerSort === "rating") return numberValue(right.average_rating ?? right.merchant_average_rating) - numberValue(left.average_rating ?? left.merchant_average_rating);
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
    setShippingBusy(true); setShippingResponse(response); setShippingOptions({}); setShippingCompanyId(""); setShippingWeight("1");
    try {
      const result = await buyerPost("rfq_shipping_options", { rfqResponseId: id });
      const options = Array.isArray(result) ? { companies: result } : row(result);
      const companies = rows(options.companies);
      setShippingOptions(options); setShippingCompanyId(text(companies[0]?.id));
    } catch (error) {
      setShippingResponse({}); notify(error instanceof Error ? error.message : "rfq_response_not_found", "error");
    } finally { setShippingBusy(false); }
  }

  function selectedShipping() {
    const companies = rows(shippingOptions.companies);
    const company = companies.find((item) => text(item.id) === shippingCompanyId) ?? companies[0];
    const weight = Math.max(0.001, numberValue(shippingWeight, 1));
    const batch = rows(company?.batches).find((item) => weight >= numberValue(item.min_weight_kg) && weight <= numberValue(item.max_weight_kg));
    return { companies, company, weight, cost: batch ? numberValue(batch.price) : null };
  }

  async function acceptRfqWithShipping() {
    const responseId = text(shippingResponse.id || shippingResponse.rfq_response_id);
    if (!responseId) return;
    const selected = selectedShipping();
    if (selected.companies.length && (!selected.company || selected.cost === null)) { notify("shipping_weight_not_covered", "error"); return; }
    setShippingBusy(true);
    try {
      await buyerPost("accept_rfq_response", {
        rfqResponseId: responseId,
        shippingCompanyId: text(selected.company?.id) || null,
        shippingCompanyName: text(selected.company?.name) || null,
        totalWeightKg: selected.companies.length ? selected.weight : null,
        shippingCost: selected.cost,
      });
      notify(locale === "ar" ? "تم قبول رد المتجر وإنشاء الطلب." : "The store response was accepted and the order was created.", "success");
      setShippingResponse({}); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_request_action_failed", "error"); }
    finally { setShippingBusy(false); }
  }

  async function action(id: string, task: string, body: Record<string, unknown> = {}) {
    setBusyId(`${task}:${id}`);
    try {
      await buyerPost(task, body);
      notify(locale === "ar" ? "تم تنفيذ العملية بنجاح." : "The action was completed.", "success"); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_request_action_failed", "error"); }
    finally { setBusyId(""); }
  }

  function offerItemQuantities(offerItems: PortalRow[]) {
    return offerItems
      .map((item) => ({
        offer_item_id: text(item.offer_item_id || item.id),
        quantity: numberValue(item.requested_quantity || item.requested_quantity_snapshot || item.quantity_snapshot || item.quantity, 1),
      }))
      .filter((item) => item.offer_item_id && item.quantity > 0);
  }

  return <div className="portal-section-stack">
    <div className="portal-subtabs"><button className={tab === "offers" ? "active" : ""} onClick={() => setTab("offers")}><Icon name="compare"/>{locale === "ar" ? `عروض مستلمة (${activeOffers.length})` : `Received offers (${activeOffers.length})`}</button><button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><Icon name="quote"/>{locale === "ar" ? `قيد التسعير (${requests.length})` : `Pricing (${requests.length})`}</button><button className={tab === "rfq" ? "active" : ""} onClick={() => setTab("rfq")}><Icon name="store"/>{locale === "ar" ? `ردود المتاجر (${rfqResponses.length})` : `Store responses (${rfqResponses.length})`}</button><button className="button primary compact" type="button" onClick={() => { setMode("manual"); setAnalysisQuoteId(""); setItems([initialItem(locale)]); setNewOpen(true); }}><Icon name="plus"/>{locale === "ar" ? "طلب جديد" : "New request"}</button></div>

    {tab === "requests" ? <PortalPanel title={locale === "ar" ? "طلبات التسعير" : "Quote requests"} subtitle={locale === "ar" ? "راجع حالة الطلب والعناصر أو اطلب ردودًا إضافية من المتاجر." : "Review request status and items, or ask stores for additional responses."}>
      {requests.length ? <div className="buyer-request-list">{requests.map((request) => { const id = text(request.id); const quoteItems = rows(request.quote_items); const direct = text(request.delivery_type) === "direct"; return <article key={id} data-record-id={id} className="buyer-request-card"><header><div><strong>{direct ? (locale === "ar" ? `طلب مخصوص: ${text(row(request.direct_contact).store_name, "متجر")}` : `Direct request: ${text(row(request.direct_contact).store_name, "Store")}`) : (locale === "ar" ? `طلب #${id.slice(0, 8)}` : `Request #${id.slice(0, 8)}`)}</strong><small>{dateLabel(request.created_at, locale)}</small></div><StatusBadge value={request.ai_review_status} locale={locale}/></header><div className="request-item-summary">{quoteItems.map((item) => <span key={text(item.id)}>{text(item.requested_name)} × {numberValue(item.quantity)} {text(item.unit)}</span>)}</div>{row(request.direct_contact).contact_mobile ? <Notice tone="success" title={locale === "ar" ? "بيانات التواصل متاحة" : "Contact is available"}>{locale === "ar" ? `المتجر: ${text(row(request.direct_contact).store_name)} — ${text(row(request.direct_contact).contact_mobile)}` : `Store: ${text(row(request.direct_contact).store_name)} — ${text(row(request.direct_contact).contact_mobile)}`}</Notice> : null}<footer><button className="button secondary compact" disabled={busyId === `generate_offers:${id}`} onClick={() => void action(id, "generate_offers", { quoteRequestId: id })}>{locale === "ar" ? "تحديث العروض" : "Refresh offers"}</button>{!direct ? <button className="button secondary compact" disabled={busyId === `create_rfq:${id}`} onClick={() => void action(id, "create_rfq", { quoteRequestId: id })}>{locale === "ar" ? "اطلب ردود متاجر" : "Ask stores"}</button> : null}<button className="button danger-button compact" disabled={busyId === `delete_quote:${id}`} onClick={() => void action(id, "delete_quote", { quoteRequestId: id })}>{locale === "ar" ? "حذف" : "Delete"}</button></footer></article>; })}</div> : <EmptyState icon="quote" title={locale === "ar" ? "مفيش طلبات تسعير" : "No quote requests"} body={locale === "ar" ? "أنشئ طلبًا يدويًا أو ارفع صورة أو PDF أو تسجيلًا صوتيًا." : "Create a manual request or upload an image, PDF, or voice file."}/>} 
    </PortalPanel> : null}

    {tab === "offers" ? <PortalPanel title={locale === "ar" ? "عروض مستلمة" : "Received offers"} subtitle={locale === "ar" ? "قارن التغطية والسعر والتوصيل قبل القبول." : "Compare coverage, price, and delivery before accepting."}>
      <div className="portal-toolbar offer-sort-toolbar"><label>{locale === "ar" ? "ترتيب العروض" : "Sort offers"}<select value={offerSort} onChange={(event) => setOfferSort(event.target.value as OfferSort)}><option value="ranking">{locale === "ar" ? "الترتيب الأنسب" : "Best match"}</option><option value="cheapest">{locale === "ar" ? "الأقل سعرًا" : "Lowest price"}</option><option value="nearest">{locale === "ar" ? "الأقرب" : "Nearest"}</option><option value="coverage">{locale === "ar" ? "أعلى تغطية" : "Highest coverage"}</option><option value="rating">{locale === "ar" ? "أعلى تقييم" : "Highest rating"}</option></select></label><span className="toolbar-count">{locale === "ar" ? `${sortedOffers.length} عرض` : `${sortedOffers.length} offers`}</span></div>
      {sortedOffers.length ? <div className="offer-card-grid">{sortedOffers.map((offer) => { const id = text(offer.id); const offerItems = rows(offer.items); const reason = row(offer.ranking_reason); const distance = numberValue(reason.distance_km, -1); return <article key={id} data-record-id={text(offer.quote_request_id || id)} className="offer-card"><header><div><strong>{text(offer.store_name, locale === "ar" ? "عرض متجر" : "Store offer")}</strong><small>{locale === "ar" ? `تغطية ${numberValue(offer.coverage_percentage)}%` : `${numberValue(offer.coverage_percentage)}% coverage`}</small></div><StatusBadge value={offer.status} locale={locale}/></header><div className="offer-comparison-strip"><span><Icon name="money" size={16}/>{money(offer.total_price_snapshot, currency, locale)}</span>{distance >= 0 ? <span><Icon name="location" size={16}/>{locale === "ar" ? `${distance.toFixed(1)} كم` : `${distance.toFixed(1)} km`}</span> : null}<span><Icon name="check" size={16}/>{numberValue(offer.coverage_percentage)}%</span></div><div className="request-item-summary">{offerItems.map((item) => <span className={item.is_available === false ? "unavailable" : ""} key={text(item.id)}>{text(item.matched_name_snapshot || item.requested_name)} — {money(item.line_total_snapshot, currency, locale)}</span>)}</div><footer><button className="button primary full" disabled={busyId === `accept_offer:${id}`} onClick={() => void action(id, "accept_offer", { offerId: id, itemQuantities: offerItemQuantities(offerItems) })}><Icon name="check"/>{locale === "ar" ? "قبول العرض" : "Accept offer"}</button></footer></article>; })}</div> : <EmptyState icon="compare" title={locale === "ar" ? "لا توجد عروض مستلمة حاليًا" : "No received offers right now"} body={locale === "ar" ? "حدّث عروض الطلب أو أرسل طلبًا للمتاجر." : "Refresh request offers or ask stores to respond."}/>} 
    </PortalPanel> : null}

    {tab === "rfq" ? <PortalPanel title={locale === "ar" ? "ردود المتاجر" : "Store responses"} subtitle={locale === "ar" ? "ردود التسعير اليدوية للطلبات العامة والمخصوصة." : "Manual store responses for broadcast and direct requests."}>
      {rfqResponses.length ? <div className="offer-card-grid">{rfqResponses.map((response) => { const id = text(response.id || response.rfq_response_id); return <article className="offer-card" key={id} data-record-id={text(response.quote_request_id || response.rfq_request_id || id)}><header><div><strong>{text(response.store_name, locale === "ar" ? "رد متجر" : "Store response")}</strong><small>{dateLabel(response.submitted_at || response.created_at, locale)}</small></div><StatusBadge value={response.status || "submitted"} locale={locale}/></header><div className="offer-total"><span>{locale === "ar" ? "الإجمالي" : "Total"}</span><strong>{money(response.total_price || response.total_price_snapshot, currency, locale)}</strong></div>{text(response.notes) ? <p>{text(response.notes)}</p> : null}<footer><button className="button primary full" disabled={shippingBusy && text(shippingResponse.id || shippingResponse.rfq_response_id) === id} onClick={() => void openRfqAcceptance(response)}>{locale === "ar" ? "مراجعة الشحن والقبول" : "Review shipping & accept"}</button></footer></article>; })}</div> : <EmptyState icon="store" title={locale === "ar" ? "لسه مفيش ردود" : "No responses yet"} body={locale === "ar" ? "هتظهر ردود المتاجر هنا أول ما يرسلوها." : "Store responses will appear here when submitted."}/>} 
    </PortalPanel> : null}

    {newOpen ? <div className="portal-modal-backdrop"><section className="portal-modal buyer-request-modal"><header><div><span className="eyebrow"><Icon name="quote"/>{locale === "ar" ? "طلب تسعير جديد" : "New quote request"}</span><h2>{locale === "ar" ? "اكتب أو ارفع قائمة المنتجات" : "Enter or upload your item list"}</h2><p>{locale === "ar" ? "راجع كل عنصر قبل الإرسال؛ الأسعار لا تُستخرج من الفاتورة." : "Review every item before sending; invoice prices are not extracted."}</p></div><button className="icon-button" onClick={() => setNewOpen(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={analysisQuoteId ? approveAnalysis : submitNew}>
      <div className="portal-subtabs request-source-tabs">{(["manual","image","pdf","voice"] as NewMode[]).map((source) => <button type="button" className={mode === source ? "active" : ""} key={source} onClick={() => { setMode(source); setAnalysisQuoteId(""); clearVoiceRecording(); setItems([initialItem(locale)]); }}>{source === "manual" ? (locale === "ar" ? "يدوي" : "Manual") : source === "image" ? (locale === "ar" ? "صورة" : "Image") : source.toUpperCase()}</button>)}</div>
      {mode !== "manual" && !analysisQuoteId && mode !== "voice" ? <label className="file-drop-zone"><Icon name="upload" size={28}/><strong>{locale === "ar" ? "اختار الملف" : "Choose file"}</strong><small>{mode === "image" ? "JPG, PNG, WEBP — 4MB" : "PDF — 18MB"}</small><input type="file" required accept={mode === "image" ? "image/jpeg,image/png,image/webp" : "application/pdf"} capture={mode === "image" ? "environment" : undefined} onChange={(event) => setFile(event.target.files?.[0] ?? null)}/>{file ? <span>{file.name}</span> : null}</label> : null}
      {mode === "voice" && !analysisQuoteId ? <section className="voice-recorder-panel"><span className={`voice-recorder-icon ${recording ? "recording" : ""}`}><Icon name="microphone" size={30}/></span><div><strong>{recording ? (locale === "ar" ? "جارٍ التسجيل" : "Recording") : file ? (locale === "ar" ? "التسجيل جاهز" : "Recording ready") : (locale === "ar" ? "سجّل طلبك بصوتك" : "Record your request")}</strong><small>{recording ? `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}` : file ? file.name : (locale === "ar" ? "يمكنك كمان رفع ملف صوت موجود." : "You can also upload an existing audio file.")}</small></div><div className="inline-actions">{!recording ? <button className="button primary compact" type="button" onClick={() => void startVoiceRecording()}><Icon name="microphone"/>{locale === "ar" ? "بدء التسجيل" : "Start recording"}</button> : <button className="button danger-button compact" type="button" onClick={stopVoiceRecording}><Icon name="stop"/>{locale === "ar" ? "إيقاف" : "Stop"}</button>}{file ? <button className="button secondary compact" type="button" onClick={clearVoiceRecording}>{locale === "ar" ? "مسح التسجيل" : "Clear"}</button> : null}</div><label className="button secondary compact voice-file-button"><Icon name="upload"/>{locale === "ar" ? "رفع ملف صوت" : "Upload audio"}<input type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/webm,audio/ogg" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/></label></section> : null}
      {analysisNote ? <Notice tone="info">{analysisNote}</Notice> : null}
      {(mode === "manual" || analysisQuoteId) ? <div className="request-items-editor">{items.map((item, index) => <div className={`request-item-row ${item.needsReview ? "needs-review" : ""}`} key={index}><label className="grow">{locale === "ar" ? "اسم المنتج" : "Item name"}<input required value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })}/></label><label>{locale === "ar" ? "الكمية" : "Quantity"}<input type="number" min="0.0001" step="any" required value={item.quantity} onChange={(event) => updateItem(index, { quantity: numberValue(event.target.value, 1) })}/></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input required value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })}/></label>{items.length > 1 ? <button className="icon-button danger" type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><Icon name="trash"/></button> : null}{item.confidence !== undefined && item.confidence !== null ? <small className="confidence-note">{locale === "ar" ? `ثقة التحليل: ${Math.round(item.confidence * 100)}%` : `Analysis confidence: ${Math.round(item.confidence * 100)}%`}</small> : null}</div>)}</div> : null}
      {(mode === "manual" || analysisQuoteId) ? <button className="button secondary" type="button" onClick={() => setItems((current) => [...current, initialItem(locale)])}><Icon name="plus"/>{locale === "ar" ? "إضافة منتج" : "Add item"}</button> : null}
      <div className="form-grid two"><label>{locale === "ar" ? "نطاق البحث" : "Search area"}<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="city">{locale === "ar" ? "نفس المدينة" : "Same city"}</option><option value="governorate">{locale === "ar" ? "نفس المحافظة" : "Same governorate"}</option><option value="country">{locale === "ar" ? "كل الدولة" : "Whole country"}</option></select></label><label>{locale === "ar" ? "الموقع" : "Location"}<select required value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">{locale === "ar" ? "اختر المدينة" : "Choose city"}</option>{locationOptions.map((item) => <option value={text(item.id)} key={text(item.id)}>{locale === "ar" ? `${text(item.country_ar)} - ${text(item.governorate_ar)} - ${text(item.name_ar)}` : `${text(item.country_en)} - ${text(item.governorate_en)} - ${text(item.name_en)}`}</option>)}</select></label></div>
      <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setNewOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ التنفيذ" : "Working") : analysisQuoteId ? (locale === "ar" ? "اعتماد وجلب العروض" : "Approve and get offers") : mode === "manual" ? (locale === "ar" ? "إنشاء الطلب" : "Create request") : (locale === "ar" ? "رفع وتحليل" : "Upload and analyze")}</button></div>
    </form></section></div> : null}

    {text(shippingResponse.id || shippingResponse.rfq_response_id) ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="store"/>{locale === "ar" ? "اختيار الشحن" : "Shipping selection"}</span><h2>{text(shippingResponse.store_name, locale === "ar" ? "رد المتجر" : "Store response")}</h2><p>{locale === "ar" ? "راجع شركة الشحن والوزن قبل قبول الرد." : "Review the shipping company and weight before accepting."}</p></div><button className="icon-button" type="button" onClick={() => setShippingResponse({})}><Icon name="close"/></button></header>{shippingBusy && !Object.keys(shippingOptions).length ? <p className="muted-copy">{locale === "ar" ? "جارٍ تحميل خيارات الشحن..." : "Loading shipping options..."}</p> : (() => { const selected = selectedShipping(); const total = numberValue(shippingResponse.total_price || shippingResponse.total_price_snapshot); const shippingCurrency = text(shippingOptions.currency_code, currency); return <div className="portal-form">{selected.companies.length ? <><label>{locale === "ar" ? "إجمالي الوزن (كجم)" : "Total weight (kg)"}<input type="number" min="0.001" step="any" value={shippingWeight} onChange={(event) => setShippingWeight(event.target.value)}/></label><label>{locale === "ar" ? "شركة الشحن" : "Shipping company"}<select value={text(selected.company?.id)} onChange={(event) => setShippingCompanyId(event.target.value)}>{selected.companies.map((company) => <option key={text(company.id)} value={text(company.id)}>{text(company.name)}</option>)}</select></label><div className="shipping-tier-list">{rows(selected.company?.batches).map((batch) => <span key={text(batch.id)}>{numberValue(batch.min_weight_kg)}–{numberValue(batch.max_weight_kg)} {locale === "ar" ? "كجم" : "kg"}: {money(batch.price, shippingCurrency, locale)}</span>)}</div>{selected.cost === null ? <Notice tone="warning">{locale === "ar" ? "الوزن المدخل غير مغطى في باقات الشركة." : "The entered weight is not covered by this company."}</Notice> : <div className="offer-comparison-strip"><span>{locale === "ar" ? "المنتجات" : "Products"}: {money(total, shippingCurrency, locale)}</span><span>{locale === "ar" ? "الشحن" : "Shipping"}: {money(selected.cost, shippingCurrency, locale)}</span><strong>{locale === "ar" ? "الإجمالي" : "Total"}: {money(total + selected.cost, shippingCurrency, locale)}</strong></div>}</> : <Notice tone="info">{locale === "ar" ? "المتجر لا يحتاج اختيار شركة شحن لهذا الرد." : "No shipping company selection is required for this response."}</Notice>}<div className="modal-actions"><button className="button secondary" type="button" onClick={() => setShippingResponse({})}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="button" disabled={shippingBusy || (selected.companies.length > 0 && selected.cost === null)} onClick={() => void acceptRfqWithShipping()}>{shippingBusy ? (locale === "ar" ? "جارٍ القبول" : "Accepting") : (locale === "ar" ? "موافقة على الرد" : "Accept response")}</button></div></div>; })()}</section></div> : null}
  </div>;
}
